'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import ModelSelect from '@/components/ModelSelect';
import { ModelSelectorGate } from '@/components/ModelSelectorGate';
import { PromptImageThumbnails } from '@/components/PromptImageAttachments';
import { MAX_PROMPT_IMAGES, PROMPT_IMAGE_ACCEPT } from '@/lib/prompt-images';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export default function HomeComposer({
  value,
  onChange,
  scrapperEnabled,
  onToggleMode,
  selectedModel,
  onModelChange,
  promptImages,
  onAddFiles,
  onRemoveImage,
  onSubmit,
  isSearching,
  hasSearchResults,
  onSearchAgain,
  isValidUrl,
  extendBrandStyles,
  onExtendBrandStylesChange,
  brandInstructions,
  onBrandInstructionsChange,
}: {
  value: string;
  onChange: (value: string) => void;
  scrapperEnabled: boolean;
  onToggleMode: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  promptImages: string[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveImage: (index: number) => void;
  onSubmit: () => void;
  isSearching: boolean;
  hasSearchResults: boolean;
  onSearchAgain: () => void;
  isValidUrl: boolean;
  extendBrandStyles: boolean;
  onExtendBrandStylesChange: (value: boolean) => void;
  brandInstructions: string;
  onBrandInstructionsChange: (value: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modeOpen, setModeOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const modeRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const canSubmit = value.trim().length > 0 || (!scrapperEnabled && promptImages.length > 0);
  const modeLabel = scrapperEnabled ? 'Reference' : 'Chat';

  const updateModeMenuPosition = () => {
    const el = modeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  };

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = Math.min(window.innerHeight * 0.42, 320);
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  };

  useEffect(() => {
    resizeTextarea();
  }, [value, scrapperEnabled]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const inTrigger = modeRef.current?.contains(target);
      const inMenu = modeMenuRef.current?.contains(target);
      if (!inTrigger && !inMenu) setModeOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!modeOpen) return;
    updateModeMenuPosition();
    const onReposition = () => updateModeMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [modeOpen]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const startVoice = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      toast.error('El dictado por voz no está disponible en este navegador.');
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        onChange(value ? `${value.trim()} ${transcript}` : transcript);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <div className="home-composer mx-entra" style={{ ['--mx-orden' as string]: 1 }}>
      {hasSearchResults ? (
        <div className="home-composer__select-row">
          <p className="home-composer__select-text">
            Elige qué sitio clonar entre los resultados de abajo
          </p>
          <button type="button" className="home-composer__ghost-btn" onClick={onSearchAgain}>
            Buscar de nuevo
          </button>
        </div>
      ) : (
        <>
          {scrapperEnabled ? (
            <input
              className="home-composer__field"
              placeholder="Pide una referencia web o pega una URL para clonar..."
              type="text"
              value={value}
              disabled={isSearching}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSearching) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
            />
          ) : (
            <textarea
              ref={textareaRef}
              className="home-composer__field home-composer__field--area"
              placeholder="Pide a la IA que construya una web app que..."
              value={value}
              rows={2}
              onChange={(e) => {
                onChange(e.target.value);
                requestAnimationFrame(resizeTextarea);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files).filter((file) =>
                  file.type.startsWith('image/')
                );
                if (files.length) {
                  e.preventDefault();
                  onAddFiles(files);
                }
              }}
              onDrop={(e) => {
                const files = Array.from(e.dataTransfer.files).filter((file) =>
                  file.type.startsWith('image/')
                );
                if (files.length) {
                  e.preventDefault();
                  onAddFiles(files);
                }
              }}
              onDragOver={(e) => e.preventDefault()}
            />
          )}

          {!scrapperEnabled && (
            <PromptImageThumbnails images={promptImages} onRemove={onRemoveImage} />
          )}

          {scrapperEnabled && isValidUrl && (
            <div className="home-composer__brand">
              <button
                type="button"
                className={`home-composer__chip ${extendBrandStyles ? 'is-on' : ''}`}
                onClick={() => onExtendBrandStylesChange(!extendBrandStyles)}
              >
                Extender estilos de marca
              </button>
              {extendBrandStyles && (
                <textarea
                  value={brandInstructions}
                  onChange={(e) => onBrandInstructionsChange(e.target.value)}
                  placeholder="Describe la funcionalidad nueva con los estilos de esta marca..."
                  className="home-composer__brand-input"
                  rows={2}
                />
              )}
            </div>
          )}
        </>
      )}

      <div className="home-composer__toolbar">
        <div className="home-composer__left">
          <input
            ref={fileRef}
            type="file"
            accept={PROMPT_IMAGE_ACCEPT}
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) {
                onAddFiles(event.target.files);
              }
              event.target.value = '';
            }}
          />
          <button
            type="button"
            className="home-composer__icon-btn"
            aria-label="Adjuntar imagen"
            title={
              promptImages.length >= MAX_PROMPT_IMAGES
                ? `Máximo ${MAX_PROMPT_IMAGES} imágenes`
                : 'Adjuntar imagen'
            }
            disabled={scrapperEnabled || promptImages.length >= MAX_PROMPT_IMAGES}
            onClick={() => fileRef.current?.click()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <ModelSelectorGate>
            <ModelSelect
              value={selectedModel}
              onChange={onModelChange}
              className="home-composer__model"
              variant="light"
            />
          </ModelSelectorGate>
        </div>

        <div className="home-composer__right">
          <div className="relative" ref={modeRef}>
            <button
              type="button"
              className="home-composer__mode"
              aria-expanded={modeOpen}
              onClick={() => {
                if (modeOpen) {
                  setModeOpen(false);
                  return;
                }
                updateModeMenuPosition();
                setModeOpen(true);
              }}
            >
              <span>{modeLabel}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
                className={modeOpen ? 'home-composer__mode-chevron is-open' : 'home-composer__mode-chevron'}
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {modeOpen &&
              menuPos &&
              createPortal(
                <div
                  ref={modeMenuRef}
                  className="home-composer__mode-menu"
                  style={{ top: menuPos.top, right: menuPos.right }}
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className={!scrapperEnabled ? 'is-active' : ''}
                    onClick={() => {
                      if (scrapperEnabled) onToggleMode();
                      setModeOpen(false);
                    }}
                  >
                    Chat
                    <span>Modo prompt</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={scrapperEnabled ? 'is-active' : ''}
                    onClick={() => {
                      if (!scrapperEnabled) onToggleMode();
                      setModeOpen(false);
                    }}
                  >
                    Reference
                    <span>Modo scrapper</span>
                  </button>
                </div>,
                document.body,
              )}
          </div>

          <button
            type="button"
            className={`home-composer__icon-btn ${listening ? 'is-listening' : ''}`}
            aria-label={listening ? 'Detener dictado' : 'Dictar por voz'}
            title="Dictar por voz"
            onClick={startVoice}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path
                d="M5 11a7 7 0 0014 0M12 18v3"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <button
            type="button"
            className={`home-composer__send ${canSubmit && !isSearching ? 'is-ready' : ''}`}
            aria-label="Enviar"
            disabled={isSearching || !canSubmit}
            onClick={onSubmit}
          >
            {isSearching ? (
              <span className="home-composer__spinner" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 19V5M5 12l7-7 7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
