import type { SandboxProvider } from './types';

export interface UploadedPromptImage {
  /** Path relative to project root, e.g. public/uploads/user-1.jpg */
  path: string;
  /** URL usable in Vite React, e.g. /uploads/user-1.jpg */
  publicUrl: string;
  /** JS module exporting the data URL as default — always available even if binary write fails */
  modulePath: string;
  /** import specifier from typical src/components/* files */
  importFromComponents: string;
  /** Variable-friendly id, e.g. userUpload1 */
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

export function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer; ext: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const ext = EXT_BY_MIME[mime] || 'jpg';
  try {
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length) return null;
    return { mime, buffer, ext };
  } catch {
    return null;
  }
}

export function isLogoSwapRequest(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return /(logo|logotipo|favicon|brand\s*mark)/i.test(p)
    || /(cambia|reemplaz|sustitu|pon|usar|usa|quiero).{0,40}(logo|imagen|este|esta)/i.test(p)
    || /(por este|por esta|con este|con esta).{0,20}(logo|imagen)/i.test(p);
}

/**
 * Persist user images so the model can reference real assets (not redraw logos with fonts).
 * Always writes a JS module with the data URL (works with string writeFile).
 * Also tries binary under public/uploads for cleaner <img src="/uploads/...">.
 */
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
    const exportName = `userUpload${n}`;
    const fileName = `user-${stamp}-${n}.${parsed.ext}`;
    const relativePath = `public/uploads/${fileName}`;
    const publicUrl = `/uploads/${fileName}`;
    const modulePath = `src/assets/uploads/user-${stamp}-${n}.js`;
    const importFromComponents = `../assets/uploads/user-${stamp}-${n}.js`;

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
      // 1) Always write JS module (string) — most reliable across providers
      try {
        const moduleSource =
          `// Auto-generated from user chat attachment. Do not recreate this logo with fonts/CSS.\n` +
          `export default ${JSON.stringify(dataUrl)};\n`;
        await provider.writeFile(modulePath, moduleSource);
        console.log('[upload-prompt-images] Wrote module', modulePath);
      } catch (error) {
        console.error('[upload-prompt-images] Failed to write module', modulePath, error);
      }

      // 2) Best-effort binary for public URL
      try {
        if (typeof (provider as any).writeBinaryFile === 'function') {
          await (provider as any).writeBinaryFile(relativePath, parsed.buffer);
        } else {
          const b64 = parsed.buffer.toString('base64');
          await provider.runCommand('mkdir -p public/uploads');
          const result = await provider.runCommand(
            [
              'python3 - <<\'PY\'',
              'import base64, pathlib',
              `path = pathlib.Path(${JSON.stringify(relativePath)})`,
              'path.parent.mkdir(parents=True, exist_ok=True)',
              `path.write_bytes(base64.b64decode(${JSON.stringify(b64)}))`,
              'print("wrote", path)',
              'PY',
            ].join('\n')
          );
          if (!result.success) {
            throw new Error(result.stderr || result.stdout || 'Failed to write image');
          }
        }
        console.log('[upload-prompt-images] Wrote binary', relativePath);
      } catch (error) {
        console.error('[upload-prompt-images] Binary write failed (module still available):', relativePath, error);
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
  options?: { logoSwap?: boolean }
): string {
  if (!uploaded.length) return '';

  const logoSwap = options?.logoSwap ?? false;
  const primary = uploaded[0];

  const list = uploaded
    .map((image, index) => {
      return `${index + 1}. REAL ASSET (use this file, do not redraw):
   - Preferred: <img src="${image.publicUrl}" alt="Logo" className="h-10 w-auto object-contain" />
   - Or: import ${image.exportName} from '${image.importFromComponents}'; then <img src={${image.exportName}} alt="Logo" className="h-10 w-auto object-contain" />
   - Module path: ${image.modulePath}`;
    })
    .join('\n');

  return `
USER-UPLOADED IMAGES — ALREADY IN THE PROJECT (use the real pixels, never invent a logo):
${list}

ABSOLUTE RULES:
- These are REAL image files. You MUST display them with <img src=...>.
- FORBIDDEN: recreating/faking the logo with fonts, "Coca-Cola"-style script text, SVG lettering, CSS text gradients, canvas drawing, or emoji.
- FORBIDDEN: keeping old brand text (e.g. MIXMOTOR) as the logo mark.
- If the user asks to replace a brand/logo with the upload, swap EVERY logo/brand-mark occurrence in Header/Nav/Hero for the <img> above.
- Example (copy this pattern exactly):
\`\`\`jsx
import ${primary.exportName} from '${primary.importFromComponents}';
// ...
<a href="/" className="flex items-center">
  <img src={${primary.exportName}} alt="Logo" className="h-10 w-auto object-contain" />
</a>
\`\`\`
${logoSwap ? `
LOGO SWAP REQUEST DETECTED:
- Replace the existing brand mark/text logo with the uploaded image in Header AND Hero (and anywhere else the brand mark appears).
- Remove leftover old brand names next to/near the logo when they act as the logo.
- Output full <file> blocks for every modified component. Do not only change colors or fonts.
` : ''}
`;
}
