'use client';

import { useEffect, useRef, useState } from 'react';
import { appConfig } from '@/config/app.config';
import type { OpenRouterModel } from '@/lib/openrouter-models';

let modelsCache: OpenRouterModel[] | null = null;
let modelsPromise: Promise<OpenRouterModel[]> | null = null;

async function loadOpenRouterModels(): Promise<OpenRouterModel[]> {
  if (modelsCache) return modelsCache;
  if (modelsPromise) return modelsPromise;

  modelsPromise = fetch('/api/openrouter-models')
    .then(async (response) => {
      const data = await response.json();
      const models: OpenRouterModel[] = Array.isArray(data.models) ? data.models : [];
      modelsCache = models;
      return models;
    })
    .catch((error) => {
      console.error('Failed to load OpenRouter models:', error);
      return fallbackModels();
    })
    .finally(() => {
      modelsPromise = null;
    });

  return modelsPromise;
}

function fallbackModels(): OpenRouterModel[] {
  return appConfig.ai.availableModels.map((id) => ({
    id,
    name: appConfig.ai.modelDisplayNames[id] || id,
    vision: true,
    created: 0,
    pricePrompt: 0,
    priceCompletion: 0,
  }));
}

function formatPrice(model: OpenRouterModel) {
  if (!model.pricePrompt && !model.priceCompletion) return '';
  const input = `$${model.pricePrompt.toFixed(model.pricePrompt < 1 ? 2 : 0)}`;
  const output = `$${model.priceCompletion.toFixed(model.priceCompletion < 1 ? 2 : 0)}`;
  return `${input} / ${output}`;
}

export default function ModelSelect({
  value,
  onChange,
  className = '',
  variant = 'light',
}: {
  value: string;
  onChange: (model: string) => void;
  className?: string;
  variant?: 'light' | 'dark';
}) {
  const [models, setModels] = useState<OpenRouterModel[]>(modelsCache || fallbackModels());
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadOpenRouterModels().then(setModels);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const selected = models.find((model) => model.id === value);
  const selectedLabel = selected?.name || value || 'Modelo';
  const selectedPrice = selected ? formatPrice(selected) : '';
  const isDark = variant === 'dark';

  const selectModel = (modelId: string) => {
    onChange(modelId);
    localStorage.setItem('selectedModel', modelId);
    setOpen(false);
  };

  return (
    <div className={`relative min-w-0 ${className}`} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={
          isDark
            ? 'home-composer__model-trigger'
            : 'mxr-select w-full text-left flex items-center gap-8 normal-case'
        }
        aria-label="Modelo de IA"
        aria-expanded={open}
      >
        <span className="flex-1 truncate min-w-0">{selectedLabel}</span>
        {selectedPrice && (
          <span
            className={
              isDark
                ? 'home-composer__model-price'
                : 'text-[10px] text-[#aaa] whitespace-nowrap'
            }
          >
            {selectedPrice}
          </span>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-50 shrink-0">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className={
            isDark
              ? 'absolute left-0 bottom-[calc(100%+8px)] z-[50] w-[min(300px,80vw)] rounded-20 overflow-hidden bg-[#2a2a2d] border border-white/10 shadow-[0_18px_44px_rgba(0,0,0,.35)]'
              : 'absolute right-0 top-[calc(100%+6px)] z-[50] w-[min(340px,80vw)] bg-[#eee] border border-[#ccc] overflow-hidden'
          }
        >
          <div className="max-h-[320px] overflow-y-auto py-4">
            {models.map((model) => {
              const price = formatPrice(model);
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => selectModel(model.id)}
                  className={`w-full px-10 py-8 text-left flex items-center gap-10 ${
                    isDark
                      ? model.id === value
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:bg-white/8 hover:text-white'
                      : model.id === value
                        ? 'bg-white text-[#444]'
                        : 'text-[#666] hover:bg-[#4B5CF0] hover:text-white'
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium truncate">{model.name}</span>
                  </span>
                  {price && (
                    <span className="text-[10px] whitespace-nowrap opacity-70">{price}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div
            className={`px-10 py-6 text-[10px] border-t ${
              isDark ? 'text-white/40 border-white/10' : 'text-[#aaa] border-[#ddd]'
            }`}
          >
            USD por 1M tokens · entrada / salida
          </div>
        </div>
      )}
    </div>
  );
}

export function getStoredModel() {
  if (!appConfig.ui.showModelSelector) {
    return appConfig.ai.lockedModel;
  }
  if (typeof window === 'undefined') return appConfig.ai.defaultModel;
  return localStorage.getItem('selectedModel') || appConfig.ai.defaultModel;
}
