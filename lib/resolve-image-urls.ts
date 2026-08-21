/**
 * Resolve image URLs found in chat prompts (direct files or Wikipedia/Commons pages)
 * into data:image/... URLs that can be uploaded into the sandbox.
 */

const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/gi;
const MAX_IMAGE_BYTES = 4_500_000;

function stripTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:!?)]+$/g, '');
}

export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(URL_RE) || [];
  const unique: string[] = [];
  for (const raw of matches) {
    const url = stripTrailingPunctuation(raw);
    if (!unique.includes(url)) unique.push(url);
  }
  return unique.slice(0, 4);
}

function looksLikeDirectImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    // Wikipedia/Commons file *pages* end in .svg/.png but are HTML, not binaries
    if (/\/wiki\/(archivo|file|image|media):/i.test(pathname)) return false;
    if (pathname.includes('/wiki/') && !pathname.includes('special:filepath')) return false;
    return /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?|$)/i.test(pathname);
  } catch {
    return false;
  }
}

function parseWikiFileTitle(url: string): { apiOrigin: string; title: string } | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = decodeURIComponent(parsed.pathname);

    // https://es.wikipedia.org/wiki/Archivo:Heineken_logo.svg
    // https://commons.wikimedia.org/wiki/File:Heineken_logo.svg
    const wikiMatch = path.match(/\/wiki\/(Archivo|File|Image|Media):(.+)$/i);
    if (wikiMatch) {
      const name = wikiMatch[2].replace(/_/g, ' ');
      const title = `File:${name}`;
      if (host.includes('commons.wikimedia.org')) {
        return { apiOrigin: 'https://commons.wikimedia.org', title };
      }
      // Language Wikipedia — try that wiki first, then Commons
      return { apiOrigin: `${parsed.protocol}//${parsed.host}`, title };
    }

    // Special:FilePath/Name.svg
    const specialMatch = path.match(/\/wiki\/Special:FilePath\/(.+)$/i);
    if (specialMatch) {
      const name = decodeURIComponent(specialMatch[1]).replace(/_/g, ' ');
      const origin = host.includes('commons.wikimedia.org')
        ? 'https://commons.wikimedia.org'
        : `${parsed.protocol}//${parsed.host}`;
      return { apiOrigin: origin, title: `File:${name}` };
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchWikiImageUrl(apiOrigin: string, title: string): Promise<string | null> {
  const api = new URL(`${apiOrigin}/w/api.php`);
  api.searchParams.set('action', 'query');
  api.searchParams.set('format', 'json');
  api.searchParams.set('origin', '*');
  api.searchParams.set('redirects', '1');
  api.searchParams.set('prop', 'imageinfo');
  api.searchParams.set('iiprop', 'url|mime');
  api.searchParams.set('titles', title);

  const response = await fetch(api.toString(), {
    headers: {
      'User-Agent': 'MXROpenLovable/1.0 (local-dev; image-url-resolver)',
      Accept: 'application/json',
    },
  });
  if (!response.ok) return null;

  const data = await response.json();
  const pages = data?.query?.pages;
  if (!pages) return null;

  for (const page of Object.values(pages) as any[]) {
    const info = page?.imageinfo?.[0];
    if (info?.url) return info.url as string;
  }
  return null;
}

async function resolveToDirectImageUrl(url: string): Promise<string | null> {
  if (looksLikeDirectImageUrl(url)) {
    return url;
  }

  const wiki = parseWikiFileTitle(url);
  if (wiki) {
    // Prefer Commons for File: pages (most logos live there)
    const commonsUrl = await fetchWikiImageUrl('https://commons.wikimedia.org', wiki.title);
    if (commonsUrl) return commonsUrl;

    if (wiki.apiOrigin !== 'https://commons.wikimedia.org') {
      const localUrl = await fetchWikiImageUrl(wiki.apiOrigin, wiki.title);
      if (localUrl) return localUrl;
    }

    // Fallback: Special:FilePath redirects to the binary
    const fileName = wiki.title.replace(/^File:/i, '').replace(/ /g, '_');
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
  }

  // Last resort: try Open Graph image on HTML pages
  try {
    const page = await fetch(url, {
      headers: {
        'User-Agent': 'MXROpenLovable/1.0 (local-dev; image-url-resolver)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    const contentType = page.headers.get('content-type') || '';
    if (contentType.startsWith('image/')) {
      return page.url;
    }
    if (contentType.includes('text/html')) {
      const html = await page.text();
      const og =
        html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
        html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
      if (og?.[1]) {
        return new URL(og[1], page.url).toString();
      }
    }
  } catch (error) {
    console.warn('[resolve-image-urls] HTML og:image fallback failed:', error);
  }

  return null;
}

function mimeFromUrlOrHeader(url: string, contentType: string | null): string {
  const header = (contentType || '').split(';')[0].trim().toLowerCase();
  if (header.startsWith('image/')) return header;

  const lower = url.toLowerCase();
  if (lower.includes('.svg')) return 'image/svg+xml';
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif')) return 'image/gif';
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

export async function downloadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const direct = await resolveToDirectImageUrl(url);
    if (!direct) {
      console.warn('[resolve-image-urls] Could not resolve image URL:', url);
      return null;
    }

    const response = await fetch(direct, {
      headers: {
        'User-Agent': 'MXROpenLovable/1.0 (local-dev; image-url-resolver)',
        Accept: 'image/*,*/*',
      },
      redirect: 'follow',
    });
    if (!response.ok) {
      console.warn('[resolve-image-urls] Download failed:', response.status, direct);
      return null;
    }

    const contentType = response.headers.get('content-type');
    const mime = mimeFromUrlOrHeader(direct, contentType);
    if (!mime.startsWith('image/')) {
      console.warn('[resolve-image-urls] Not an image content-type:', contentType, direct);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
      console.warn('[resolve-image-urls] Image empty or too large:', buffer.length);
      return null;
    }

    // Guard against HTML error pages served with a wrong content-type
    const head = buffer.slice(0, 64).toString('utf8').toLowerCase();
    if (head.includes('<!doctype html') || head.includes('<html')) {
      console.warn('[resolve-image-urls] Downloaded HTML instead of image:', direct);
      return null;
    }

    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('[resolve-image-urls] Error downloading', url, error);
    return null;
  }
}

/**
 * Merge chat attachments with images referenced by URL in the prompt text.
 */
export async function collectPromptImageDataUrls(
  prompt: string,
  attachedDataUrls: string[] = []
): Promise<{ dataUrls: string[]; resolvedFromUrls: string[] }> {
  const attached = attachedDataUrls
    .filter((image) => typeof image === 'string' && image.startsWith('data:image/'))
    .slice(0, 4);

  const urls = extractUrlsFromText(prompt);
  const resolvedFromUrls: string[] = [];
  const fromUrls: string[] = [];

  for (const url of urls) {
    if (attached.length + fromUrls.length >= 4) break;
    const dataUrl = await downloadImageAsDataUrl(url);
    if (dataUrl) {
      fromUrls.push(dataUrl);
      resolvedFromUrls.push(url);
    }
  }

  return {
    dataUrls: [...attached, ...fromUrls].slice(0, 4),
    resolvedFromUrls,
  };
}
