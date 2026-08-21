import type { SandboxProvider } from './types';
import { isLogoSwapRequest } from '@/lib/prompt-images';

export { isLogoSwapRequest };

export interface UploadedPromptImage {
  path: string;
  publicUrl: string;
  modulePath: string;
  importFromComponents: string;
  exportName: string;
  mime: string;
  dataUrl: string;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function parseDataUrl(
  dataUrl: string
): { mime: string; buffer: Buffer; ext: string } | null {
  const prefix = 'data:';
  const marker = ';base64,';
  if (!dataUrl.startsWith(prefix) || !dataUrl.includes(marker)) {
    return null;
  }

  const metaAndData = dataUrl.slice(prefix.length);
  const markerIndex = metaAndData.indexOf(marker);
  if (markerIndex < 0) return null;

  const mime = metaAndData.slice(0, markerIndex).toLowerCase();
  if (!mime.startsWith('image/')) return null;

  const base64 = metaAndData.slice(markerIndex + marker.length);
  const ext = EXT_BY_MIME[mime] || 'jpg';

  try {
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) return null;
    return { mime, buffer, ext };
  } catch {
    return null;
  }
}

export async function uploadPromptImagesToSandbox(
  images: string[],
  provider: SandboxProvider | null | undefined
): Promise<UploadedPromptImage[]> {
  if (!images.length) return [];

  const uploaded: UploadedPromptImage[] = [];
  const stamp = Date.now();

  for (let index = 0; index < images.length; index++) {
    const dataUrl = images[index];
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      console.warn('[upload-prompt-images] Skipping invalid data URL at index', index);
      continue;
    }

    const n = index + 1;
    const exportName = 'userUpload' + n;
    const fileName = 'user-' + stamp + '-' + n + '.' + parsed.ext;
    const relativePath = 'public/uploads/' + fileName;
    const publicUrl = '/uploads/' + fileName;
    const modulePath = 'src/assets/uploads/user-' + stamp + '-' + n + '.js';
    const importFromComponents = '../assets/uploads/user-' + stamp + '-' + n + '.js';

    const entry: UploadedPromptImage = {
      path: relativePath,
      publicUrl,
      modulePath,
      importFromComponents,
      exportName,
      mime: parsed.mime,
      dataUrl,
    };

    if (provider) {
      try {
        const moduleSource =
          '// Auto-generated from user chat attachment.\n' +
          'export default ' +
          JSON.stringify(dataUrl) +
          ';\n';
        await provider.writeFile(modulePath, moduleSource);
        console.log('[upload-prompt-images] Wrote module', modulePath);
      } catch (error) {
        console.error('[upload-prompt-images] Failed to write module', modulePath, error);
      }

      try {
        if (typeof (provider as any).writeBinaryFile === 'function') {
          await (provider as any).writeBinaryFile(relativePath, parsed.buffer);
        } else {
          const b64 = parsed.buffer.toString('base64');
          await provider.runCommand('mkdir -p public/uploads');
          const py = [
            "python3 - <<'PY'",
            'import base64, pathlib',
            'path = pathlib.Path(' + JSON.stringify(relativePath) + ')',
            'path.parent.mkdir(parents=True, exist_ok=True)',
            'path.write_bytes(base64.b64decode(' + JSON.stringify(b64) + '))',
            'print("wrote", path)',
            'PY',
          ].join('\n');
          const result = await provider.runCommand(py);
          if (!result.success) {
            throw new Error(result.stderr || result.stdout || 'Failed to write image');
          }
        }
        console.log('[upload-prompt-images] Wrote binary', relativePath);
      } catch (error) {
        console.error(
          '[upload-prompt-images] Binary write failed (module still available):',
          relativePath,
          error
        );
      }
    } else {
      console.warn('[upload-prompt-images] No sandbox provider; module/public files not written yet');
    }

    uploaded.push(entry);
  }

  return uploaded;
}

export function buildUploadedImagesPromptSection(
  uploaded: UploadedPromptImage[],
  options?: { logoSwap?: boolean; userPrompt?: string }
): string {
  if (!uploaded.length) return '';

  const logoSwap = options?.logoSwap ?? false;
  const userPrompt = (options?.userPrompt || '').trim().replace(/"/g, '\\"');
  const primary = uploaded[0];

  const list = uploaded
    .map((image, index) => {
      return [
        String(index + 1) + '. Available asset:',
        '   - Public URL: ' + image.publicUrl,
        '   - Or: import ' +
          image.exportName +
          " from '" +
          image.importFromComponents +
          "'; then use src={" +
          image.exportName +
          '}',
        '   - Module path: ' + image.modulePath,
      ].join('\n');
    })
    .join('\n');

  const lines: string[] = [
    'USER-ATTACHED IMAGES (saved in the project - use them ONLY as the user prompt describes):',
    list,
    '',
    'GENERAL RULES:',
    '- The USER PROMPT decides what each image is for (reference, screenshot, moodboard, icon, photo, logo, etc.).',
    '- Do NOT assume an attached image is a logo unless the user asks for a logo / brand-mark change.',
    '- When the prompt asks to show/use an attached image in the UI, use a real img tag with the asset above - do not redraw it with fonts/SVG text.',
    '- Follow the user request precisely: "' + userPrompt + '"',
  ];

  if (logoSwap) {
    lines.push(
      '',
      'LOGO / BRAND-MARK REQUEST (prompt asked for this explicitly):',
      '- Replace existing logo/brand-mark text with the uploaded image using an img tag, e.g.:',
      '  import ' + primary.exportName + " from '" + primary.importFromComponents + "';",
      '  img: src={' + primary.exportName + '} alt="Logo" className="h-10 w-auto object-contain"',
      '- FORBIDDEN for this request: faking the logo with fonts, script text, SVG lettering, or CSS-only wordmarks.',
      '- Update Header/Nav/Hero (and any other brand mark) as needed. Output full file blocks.'
    );
  } else {
    lines.push(
      '- If this is only a visual reference (style/layout/colors), extract inspiration - do not force the image into the header as a logo.'
    );
  }

  return '\n' + lines.join('\n') + '\n';
}
