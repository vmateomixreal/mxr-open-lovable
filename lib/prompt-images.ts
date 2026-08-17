export const MAX_PROMPT_IMAGES = 4;
export const PROMPT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

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
  quality = 0.78
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
