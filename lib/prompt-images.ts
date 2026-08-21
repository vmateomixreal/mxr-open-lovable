export const MAX_PROMPT_IMAGES = 4;
export const PROMPT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

/**
 * True only when the user prompt clearly asks to use an image as a logo / brand mark.
 * Attaching an image alone is NOT enough — the prompt decides the role of each image.
 */
export function isLogoSwapRequest(prompt: string): boolean {
  const p = prompt.toLowerCase();
  const mentionsLogo = /\b(logo|logotipo|brand\s*mark|favicon)\b/i.test(p);
  if (!mentionsLogo) return false;

  return (
    /(cambia|reemplaz|sustitu|pon|poner|usa|usar|quiero|met[ea]|actualiz)/i.test(p) ||
    /(por|con)\s+(este|esta|la|el)\s+(logo|imagen|foto)/i.test(p) ||
    /(logo|logotipo).{0,40}(por|con)\s+(este|esta|la imagen|la foto)/i.test(p)
  );
}

let pendingPromptImages: string[] = [];

export function setPendingPromptImages(images: string[]) {
  pendingPromptImages = images;
}

export function takePendingPromptImages(): string[] {
  const images = pendingPromptImages;
  pendingPromptImages = [];
  return images;
}

export function isPromptImageFile(file: File) {
  return file.type.startsWith('image/');
}

export async function compressImageFile(
  file: File,
  maxSize = 1280,
  quality = 0.85
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    let { width, height } = image;

    if (width > maxSize || height > maxSize) {
      const scale = maxSize / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not read image');
    }

    // Keep transparency for PNG/WebP logos instead of forcing JPEG
    const preferLossless =
      file.type === 'image/png' ||
      file.type === 'image/webp' ||
      file.type === 'image/gif';

    if (preferLossless) {
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL('image/png');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function filesToPromptImages(
  files: FileList | File[],
  existingCount = 0
): Promise<string[]> {
  const remaining = Math.max(0, MAX_PROMPT_IMAGES - existingCount);
  const imageFiles = Array.from(files)
    .filter(isPromptImageFile)
    .slice(0, remaining);

  const images: string[] = [];
  for (const file of imageFiles) {
    images.push(await compressImageFile(file));
  }
  return images;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load image'));
    image.src = src;
  });
}
