'use client';

import { useRef } from 'react';
import { MAX_PROMPT_IMAGES, PROMPT_IMAGE_ACCEPT } from '@/lib/prompt-images';

export function PromptImageThumbnails({
  images,
  onRemove,
}: {
  images: string[];
  onRemove: (index: number) => void;
}) {
  if (images.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-8">
      {images.map((src, index) => (
        <div
          key={`${src.slice(0, 24)}-${index}`}
          className="relative w-56 h-56 rounded-8 overflow-hidden border border-black-alpha-8 bg-black-alpha-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute top-2 right-2 w-16 h-16 rounded-full bg-black/70 text-white text-[11px] leading-none flex items-center justify-center"
            aria-label="Remove image"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function PromptImageAttachButton({
  disabled = false,
  remaining = MAX_PROMPT_IMAGES,
  onFiles,
}: {
  disabled?: boolean;
  remaining?: number;
  onFiles: (files: FileList) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDisabled = disabled || remaining <= 0;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={PROMPT_IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) {
            onFiles(event.target.files);
          }
          event.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => inputRef.current?.click()}
        title={remaining <= 0 ? `Maximum ${MAX_PROMPT_IMAGES} images` : 'Attach images'}
        className={`w-36 h-36 rounded-8 flex items-center justify-center transition-colors ${
          isDisabled
            ? 'text-black-alpha-24 cursor-not-allowed'
            : 'text-black-alpha-48 hover:text-accent-black hover:bg-black-alpha-4'
        }`}
        aria-label="Attach images"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4.5" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7.25" cy="8.25" r="1.25" fill="currentColor" />
          <path d="M4.5 14L8.5 10.5L11 13L13 11.5L16.5 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  );
}
