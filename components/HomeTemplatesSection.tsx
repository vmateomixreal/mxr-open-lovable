'use client';

import { useEffect, useState } from 'react';

export type TemplateCard = {
  id: string;
  title: string;
  description: string;
  image: string | null;
  gradient: string;
  url?: string;
  markdown?: string;
};

export const TEMPLATE_PLACEHOLDERS: TemplateCard[] = [
  {
    id: 'ph-1',
    title: 'Canvas de moodboard IA',
    description: 'Arrastra imágenes y añade notas de texto',
    image: null,
    gradient: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #8b5cf6 100%)',
  },
  {
    id: 'ph-2',
    title: 'Presentaciones Mixreal',
    description: 'Constructor de slides impulsado por código',
    image: null,
    gradient: 'linear-gradient(135deg, #fb7185 0%, #f472b6 40%, #fb923c 100%)',
  },
  {
    id: 'ph-3',
    title: 'Hub de campañas',
    description: 'Checklists, UTMs y embudos de marketing',
    image: null,
    gradient: 'linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
  },
  {
    id: 'ph-4',
    title: 'Registro de eventos',
    description: 'Landing limpia para inscripciones',
    image: null,
    gradient: 'linear-gradient(135deg, #e0f2fe 0%, #f8fafc 50%, #dbeafe 100%)',
  },
  {
    id: 'ph-5',
    title: 'Tienda homeware',
    description: 'Catálogo elegante con hero fotográfico',
    image: null,
    gradient: 'linear-gradient(135deg, #d6d3d1 0%, #fafaf9 40%, #a8a29e 100%)',
  },
  {
    id: 'ph-6',
    title: 'Dashboard SaaS',
    description: 'Métricas, tablas y paneles de control',
    image: null,
    gradient: 'linear-gradient(135deg, #312e81 0%, #1d4ed8 50%, #0ea5e9 100%)',
  },
  {
    id: 'ph-7',
    title: 'Portfolio creativo',
    description: 'Galería minimalista para proyectos',
    image: null,
    gradient: 'linear-gradient(135deg, #111827 0%, #374151 60%, #9ca3af 100%)',
  },
  {
    id: 'ph-8',
    title: 'App de productividad',
    description: 'Tareas, notas y foco diario',
    image: null,
    gradient: 'linear-gradient(135deg, #064e3b 0%, #059669 45%, #34d399 100%)',
  },
];

type SearchResult = {
  url: string;
  title: string;
  description: string;
  screenshot: string | null;
  markdown: string;
};

export default function HomeTemplatesSection({
  scrapperEnabled,
  isSearching,
  hasSearched,
  searchResults,
  onUseResult,
  onUsePlaceholder,
}: {
  scrapperEnabled: boolean;
  isSearching: boolean;
  hasSearched: boolean;
  searchResults: SearchResult[];
  onUseResult: (result: SearchResult) => void;
  onUsePlaceholder: (template: TemplateCard) => void;
}) {
  const [browseAllOpen, setBrowseAllOpen] = useState(false);
  const [preview, setPreview] = useState<TemplateCard | null>(null);

  const showingResults = scrapperEnabled && hasSearched && searchResults.length > 0 && !isSearching;

  const cards: TemplateCard[] = showingResults
    ? searchResults.slice(0, 8).map((result, index) => ({
        id: `result-${index}-${result.url}`,
        title: result.title || result.url,
        description: result.description || result.url,
        image: result.screenshot,
        gradient: 'linear-gradient(135deg, #e5e7eb 0%, #f3f4f6 100%)',
        url: result.url,
        markdown: result.markdown,
      }))
    : TEMPLATE_PLACEHOLDERS;

  const overlayLabel = !scrapperEnabled
    ? null
    : isSearching
      ? 'Realizando búsqueda...'
      : !hasSearched
        ? 'Esperando búsqueda...'
        : null;

  useEffect(() => {
    if (!browseAllOpen && !preview) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreview(null);
        setBrowseAllOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [browseAllOpen, preview]);

  const openCard = (card: TemplateCard) => {
    setPreview(card);
  };

  const useCard = (card: TemplateCard) => {
    if (card.url) {
      onUseResult({
        url: card.url,
        title: card.title,
        description: card.description,
        screenshot: card.image,
        markdown: card.markdown || '',
      });
    } else {
      onUsePlaceholder(card);
    }
    setPreview(null);
    setBrowseAllOpen(false);
  };

  const renderGrid = (items: TemplateCard[]) => (
    <div className="tpl-grid">
      {items.map((card) => (
        <button
          key={card.id}
          type="button"
          className="tpl-card"
          onClick={() => openCard(card)}
        >
          <div
            className="tpl-card__thumb"
            style={card.image ? undefined : { backgroundImage: card.gradient }}
          >
            {card.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.image} alt="" loading="lazy" />
            ) : null}
          </div>
          <div className="tpl-card__meta">
            <h3 className="tpl-card__title">{card.title}</h3>
            <p className="tpl-card__desc">{card.description}</p>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <section className="templates-section mx-entra" style={{ ['--mx-orden' as string]: 2 }}>
        <div className="tpl-panel">
          <div className="tpl-toolbar">
            <div className="tpl-tabs" role="tablist" aria-label="Secciones">
              <button type="button" className="tpl-tab is-active" role="tab" aria-selected>
                Plantillas
              </button>
              <span className="tpl-tab is-muted" aria-hidden>
                Mis proyectos
              </span>
              <span className="tpl-tab is-muted" aria-hidden>
                Vistos recientemente
              </span>
            </div>
            <button
              type="button"
              className="tpl-browse"
              onClick={() => setBrowseAllOpen(true)}
            >
              Ver Todas
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M3 7h8M7.5 3.5L11 7l-3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="tpl-stage">
            {renderGrid(cards)}
            {overlayLabel && (
              <div className="tpl-overlay" aria-live="polite">
                <p className="tpl-overlay__text">{overlayLabel}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {browseAllOpen && (
        <div
          className="tpl-modal-root"
          role="dialog"
          aria-modal="true"
          aria-label="Todas las plantillas"
        >
          <button
            type="button"
            className="tpl-modal-backdrop"
            aria-label="Cerrar"
            onClick={() => setBrowseAllOpen(false)}
          />
          <div className="tpl-browse-sheet">
            <div className="tpl-browse-sheet__head">
              <div>
                <h2>Plantillas</h2>
                <p>Empieza desde una plantilla para tu próximo proyecto</p>
              </div>
              <button
                type="button"
                className="tpl-modal-close"
                onClick={() => setBrowseAllOpen(false)}
                aria-label="Cerrar"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="tpl-browse-sheet__body">{renderGrid(cards)}</div>
          </div>
        </div>
      )}

      {preview && (
        <div className="tpl-modal-root" role="dialog" aria-modal="true" aria-label={preview.title}>
          <button
            type="button"
            className="tpl-modal-backdrop"
            aria-label="Cerrar"
            onClick={() => setPreview(null)}
          />
          <div className="tpl-preview">
            <div className="tpl-preview__bar">
              <p className="tpl-preview__label">
                <span className="tpl-preview__label-text">{preview.title}</span>
                {preview.description ? (
                  <>
                    <span className="tpl-preview__dot" aria-hidden />
                    <span className="tpl-preview__label-text">{preview.description}</span>
                  </>
                ) : null}
              </p>
              <button
                type="button"
                className="tpl-preview__cta"
                onClick={() => useCard(preview)}
              >
                Usar plantilla
              </button>
            </div>
            <div className="tpl-preview__frame">
              {preview.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.image} alt={preview.title} />
              ) : (
                <div
                  className="tpl-preview__placeholder"
                  style={{ backgroundImage: preview.gradient }}
                  aria-hidden
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
