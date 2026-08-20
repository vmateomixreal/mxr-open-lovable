import type { SandboxProvider } from './types';
import type { UploadedPromptImage } from './upload-prompt-images';

const CANDIDATE_FILES = [
  'src/components/Header.jsx',
  'src/components/Header.tsx',
  'src/components/Navbar.jsx',
  'src/components/Navbar.tsx',
  'src/components/Nav.jsx',
  'src/components/Hero.jsx',
  'src/components/Hero.tsx',
  'src/App.jsx',
  'src/App.tsx',
];

function ensureImport(
  content: string,
  exportName: string,
  importFromComponents: string
): string {
  if (content.includes(exportName) || content.includes(importFromComponents)) {
    return content;
  }
  const importLine = `import ${exportName} from '${importFromComponents}';\n`;
  const importBlock = content.match(/^(?:import[\s\S]*?;\s*)+/m);
  if (importBlock) {
    return content.replace(importBlock[0], `${importBlock[0]}${importLine}`);
  }
  return importLine + content;
}

/**
 * If the model faked a logo with fonts/text, rewrite brand marks to use the real uploaded <img>.
 */
export async function forceUploadedLogoIntoApp(
  provider: SandboxProvider,
  uploaded: Pick<UploadedPromptImage, 'publicUrl' | 'importFromComponents' | 'exportName' | 'modulePath'>[]
): Promise<string[]> {
  if (!uploaded.length) return [];

  const primary = uploaded[0];
  const imgTag = `<img src={${primary.exportName}} alt="Logo" className="h-10 w-auto object-contain" />`;
  const updated: string[] = [];

  for (const filePath of CANDIDATE_FILES) {
    let content: string;
    try {
      content = await provider.readFile(filePath);
    } catch {
      continue;
    }
    if (!content || content.length < 20) continue;

    const alreadyUsesRealImage =
      (/<img\b/i.test(content)) &&
      (
        content.includes(primary.publicUrl) ||
        content.includes(primary.modulePath) ||
        content.includes(`{${primary.exportName}}`) ||
        /src=\{[^}]*userUpload\d+/i.test(content) ||
        /src=["']\/uploads\//i.test(content)
      );

    if (alreadyUsesRealImage) continue;

    const mentionsBrandOrLogo =
      /mixmotor|coca-?cola|logo|brand/i.test(content) ||
      /className=["'][^"']*logo[^"']*["']/i.test(content);

    if (!mentionsBrandOrLogo) continue;

    let next = ensureImport(content, primary.exportName, primary.importFromComponents);

    const patterns: RegExp[] = [
      /<(h1|h2|span|div|a|p)([^>]*)>([^<]*MIXMOTOR[^<]*)<\/\1>/gi,
      /<(h1|h2|span|div|a|p)([^>]*)>([^<]*Coca-?Cola[^<]*)<\/\1>/gi,
      /<(h1|h2|span|div|a)([^>]*className=["'][^"']*logo[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    ];

    let didReplace = false;
    for (const pattern of patterns) {
      const before = next;
      next = next.replace(pattern, imgTag);
      if (next !== before) didReplace = true;
    }

    // Header/Nav: replace first short all-caps / title-case brand word near the top of JSX
    if (!didReplace && /Header|Nav/i.test(filePath)) {
      next = next.replace(
        /<(span|div|a)([^>]*className=["'][^"']*(?:logo|brand|font|tracking|text-(?:xl|2xl|3xl)|uppercase)[^"']*["'][^>]*)>([^<]{2,40})<\/\1>/i,
        imgTag
      );
      if (next !== content && next.includes(imgTag)) didReplace = true;
    }

    // Hero eyebrow brand text
    if (/Hero/i.test(filePath)) {
      const before = next;
      next = next.replace(
        /<(span|p|div)([^>]*)>([^<]*MIXMOTOR[^<]*)<\/\1>/gi,
        imgTag
      );
      if (next !== before) didReplace = true;
    }

    if (didReplace && next.includes(primary.exportName) && /<img\b/i.test(next)) {
      await provider.writeFile(filePath, next);
      updated.push(filePath);
      console.log('[force-logo] Patched', filePath, 'to use real upload', primary.exportName);
    }
  }

  return updated;
}
