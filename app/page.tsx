"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from '@/config/app.config';
import { isLikelyUrl } from '@/lib/url';
import { toast } from "sonner";
import { filesToPromptImages, MAX_PROMPT_IMAGES, setPendingPromptImages } from "@/lib/prompt-images";
import { PromptImageAttachButton, PromptImageThumbnails } from "@/components/PromptImageAttachments";

import { HeaderProvider } from "@/components/shared/header/HeaderContext";

// Import hero section components
import HeroInputSubmitButton from "@/components/app/(home)/sections/hero-input/Button/Button";
import ModelSelect, { getStoredModel } from "@/components/ModelSelect";
import { ModelSelectorGate } from "@/components/ModelSelectorGate";
import HomeHeroTitle from "@/components/app/(home)/sections/hero/Title/Title";

interface SearchResult {
  url: string;
  title: string;
  description: string;
  screenshot: string | null;
  markdown: string;
}

export default function HomePage() {
  const [url, setUrl] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>(appConfig.ai.defaultModel);
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false);
  const [showSearchTiles, setShowSearchTiles] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [showSelectMessage, setShowSelectMessage] = useState<boolean>(false);
  const [showInstructionsForIndex, setShowInstructionsForIndex] = useState<number | null>(null);
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [extendBrandStyles, setExtendBrandStyles] = useState<boolean>(false);
  const [scrapperEnabled, setScrapperEnabled] = useState<boolean>(true);
  const [promptImages, setPromptImages] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const storedScrapper = localStorage.getItem('scrapperEnabled') ?? localStorage.getItem('firecrawlEnabled');
    if (storedScrapper === 'false') {
      setScrapperEnabled(false);
    }
    setSelectedModel(getStoredModel());
  }, []);

  const toggleScrapper = () => {
    const next = !scrapperEnabled;
    setScrapperEnabled(next);
    localStorage.setItem('scrapperEnabled', String(next));
    if (!next) {
      setSearchResults([]);
      setHasSearched(false);
      setShowSearchTiles(false);
      setShowSelectMessage(false);
      setIsSearching(false);
      setExtendBrandStyles(false);
      setIsValidUrl(false);
    } else {
      setPromptImages([]);
      setIsValidUrl(validateUrl(url));
    }
  };

  const addPromptFiles = async (files: FileList | File[]) => {
    try {
      const next = await filesToPromptImages(files, promptImages.length);
      if (next.length) {
        setPromptImages((current) => [...current, ...next].slice(0, MAX_PROMPT_IMAGES));
      }
    } catch (error) {
      console.error('Failed to attach image:', error);
      toast.error('No se pudo adjuntar esa imagen. Prueba con otro archivo.');
    }
  };
  
  // Simple URL validation
  const validateUrl = (urlString: string) => {
    if (!urlString) return false;
    // Basic URL pattern - accepts domains with or without protocol
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    return urlPattern.test(urlString.toLowerCase());
  };

  const isURL = (str: string): boolean => isLikelyUrl(str);

  const handleSubmit = async (selectedResult?: SearchResult) => {
    const inputValue = url.trim();

    if (!inputValue && (scrapperEnabled || promptImages.length === 0)) {
      toast.error(scrapperEnabled ? "Introduce una URL o un término de búsqueda" : "Describe lo que quieres crear o adjunta una imagen");
      return;
    }

    if (!scrapperEnabled) {
      const promptText = inputValue || 'Crea una app React inspirada en las imágenes de referencia adjuntas.';
      setPendingPromptImages(promptImages);
      sessionStorage.setItem('directPrompt', promptText);
      sessionStorage.setItem('directPromptMode', 'true');
      sessionStorage.setItem('selectedModel', appConfig.ui.showModelSelector ? selectedModel : appConfig.ai.lockedModel);
      sessionStorage.setItem('autoStart', 'true');
      sessionStorage.removeItem('selectedStyle');
      sessionStorage.removeItem('additionalInstructions');
      router.push('/generation');
      return;
    }

    // Validate brand extension mode requirements
    if (extendBrandStyles && isURL(inputValue) && !additionalInstructions.trim()) {
      toast.error("Describe lo que quieres crear con los estilos de esta marca");
      return;
    }
    
    // If it's a search result being selected, fade out and redirect
    if (selectedResult) {
      setIsFadingOut(true);
      
      // Wait for fade animation
      setTimeout(() => {
        sessionStorage.setItem('targetUrl', selectedResult.url);
        sessionStorage.setItem('selectedModel', appConfig.ui.showModelSelector ? selectedModel : appConfig.ai.lockedModel);
        sessionStorage.setItem('autoStart', 'true');
        if (selectedResult.markdown) {
          sessionStorage.setItem('siteMarkdown', selectedResult.markdown);
        }
        router.push('/generation');
      }, 500);
      return;
    }
    
    // If it's a URL, check if we're extending brand styles or cloning
    if (isURL(inputValue)) {
      if (extendBrandStyles) {
        // Brand extension mode - extract brand styles and use them with the prompt
        sessionStorage.setItem('targetUrl', inputValue);
        sessionStorage.setItem('selectedModel', appConfig.ui.showModelSelector ? selectedModel : appConfig.ai.lockedModel);
        sessionStorage.setItem('autoStart', 'true');
        sessionStorage.setItem('brandExtensionMode', 'true');
        sessionStorage.setItem('brandExtensionPrompt', additionalInstructions || '');
        router.push('/generation');
      } else {
        // Normal clone mode
        sessionStorage.setItem('targetUrl', inputValue);
        sessionStorage.setItem('selectedModel', appConfig.ui.showModelSelector ? selectedModel : appConfig.ai.lockedModel);
        sessionStorage.setItem('autoStart', 'true');
        router.push('/generation');
      }
    } else {
      // It's a search term, fade out if results exist, then search
      if (hasSearched && searchResults.length > 0) {
        setIsFadingOut(true);
        
        setTimeout(async () => {
          setSearchResults([]);
          setIsFadingOut(false);
          setShowSelectMessage(true);
          
          // Perform new search
          await performSearch(inputValue);
          setHasSearched(true);
          setShowSearchTiles(true);
          setShowSelectMessage(false);
          
          // Smooth scroll to carousel
          setTimeout(() => {
            const carouselSection = document.querySelector('.carousel-section');
            if (carouselSection) {
              carouselSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 300);
        }, 500);
      } else {
        // First search, no fade needed
        setShowSelectMessage(true);
        setIsSearching(true);
        setHasSearched(true);
        setShowSearchTiles(true);
        
        // Scroll to carousel area immediately
        setTimeout(() => {
          const carouselSection = document.querySelector('.carousel-section');
          if (carouselSection) {
            carouselSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        
        await performSearch(inputValue);
        setShowSelectMessage(false);
        setIsSearching(false);
        
        // Smooth scroll to carousel
        setTimeout(() => {
          const carouselSection = document.querySelector('.carousel-section');
          if (carouselSection) {
            carouselSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    }
  };

  // Perform search when user types
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || isURL(searchQuery)) {
      setSearchResults([]);
      setShowSearchTiles(false);
      return;
    }

    setIsSearching(true);
    setShowSearchTiles(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (response.ok) {
        const data = await response.json();
        const results = data.results || [];
        setSearchResults(results);
        setShowSearchTiles(true);
        if (results.length === 0) {
          toast.error('No se encontraron sitios. Prueba con otra búsqueda.');
        }
      } else {
        toast.error('La búsqueda falló. Revisa la API key del scrapper e inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('La búsqueda falló. Inténtalo de nuevo.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <HeaderProvider>
      <div className="mx-home-shell">
        <div className="meshBg" aria-hidden>
          <div className="meshTint" />
        </div>

        <section className="mx-home-hero overflow-x-clip" id="home-hero">
          <div className="mx-contenedor mx-entra" style={{ ["--mx-orden" as string]: 0 }}>
            <HomeHeroTitle />
            <p className="mx-texto--guia text-center mx-auto mt-[clamp(18px,2vw,28px)]">
              {scrapperEnabled
                ? 'Clona o reimagina cualquier web con calidad de producto, en segundos.'
                : 'Describe tu idea y genera una app React lista para iterar, en segundos.'}
            </p>
            <div className="flex justify-center mt-[clamp(20px,2.4vw,32px)]">
              <button
                type="button"
                className={`mx-btn ${scrapperEnabled ? 'mx-btn--claro' : 'mx-btn--oscuro'} mx-btn--compacto`}
                onClick={toggleScrapper}
              >
                {scrapperEnabled ? 'Scrapper activado' : 'Modo prompt'}
              </button>
            </div>
          </div>
        </section>

          {/* Mini Playground Input */}
          <div className="relative z-[2] px-[clamp(24px,7vw,140px)] pb-[clamp(48px,6vw,96px)] -mt-4">
            <div className="mx-home-input mx-entra" style={{ ["--mx-orden" as string]: 1 }}>

                <div className={`mx-home-input__body ${scrapperEnabled ? 'items-center' : 'items-start'}`}>
                  {/* Show different UI when search results are displayed */}
                  {hasSearched && searchResults.length > 0 && !isFadingOut ? (
                    <>
                      {/* Selection mode icon */}
                      <svg 
                        width="20" 
                        height="20" 
                        viewBox="0 0 20 20" 
                        fill="none" 
                        xmlns="http://www.w3.org/2000/svg"
                        className="opacity-40 flex-shrink-0"
                      >
                        <rect x="2" y="4" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                        <rect x="11" y="4" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                        <rect x="2" y="11" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                        <rect x="11" y="11" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                      
                      {/* Selection message */}
                      <div className="flex-1 text-body-input text-accent-black">
                        Elige qué sitio clonar entre los resultados de abajo
                      </div>
                      
                      {/* Search again button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setIsFadingOut(true);
                          setTimeout(() => {
                            setSearchResults([]);
                            setHasSearched(false);
                            setShowSearchTiles(false);
                            setIsFadingOut(false);
                            setUrl('');
                          }, 500);
                        }}
                        className="button relative rounded-10 px-12 py-8 text-label-medium font-medium flex items-center justify-center gap-6 bg-gray-100 hover:bg-gray-200 text-gray-700 active:scale-[0.995] transition-all"
                      >
                        <svg 
                          width="16" 
                          height="16" 
                          viewBox="0 0 16 16" 
                          fill="none" 
                          xmlns="http://www.w3.org/2000/svg"
                          className="opacity-60"
                        >
                          <path d="M14 14L10 10M11 6.5C11 9 9 11 6.5 11C4 11 2 9 2 6.5C2 4 4 2 6.5 2C9 2 11 4 11 6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <span>Buscar de nuevo</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {scrapperEnabled ? (
                        isURL(url) ? (
                        // Scrape icon for URLs
                        <svg 
                          width="20" 
                          height="20" 
                          viewBox="0 0 20 20" 
                          fill="none" 
                          xmlns="http://www.w3.org/2000/svg"
                          className="opacity-40 flex-shrink-0"
                        >
                          <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M7 10L9 12L13 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        ) : (
                        // Search icon for search terms
                        <svg 
                          width="20" 
                          height="20" 
                          viewBox="0 0 20 20" 
                          fill="none" 
                          xmlns="http://www.w3.org/2000/svg"
                          className="opacity-40 flex-shrink-0"
                        >
                          <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M12.5 12.5L16.5 16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        )
                      ) : (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="opacity-40 flex-shrink-0 mt-2"
                        >
                          <path d="M4 16L5.5 11.5L12.5 4.5C13.3284 3.67157 14.6716 3.67157 15.5 4.5C16.3284 5.32843 16.3284 6.67157 15.5 7.5L8.5 14.5L4 16Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M11.5 5.5L14.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      )}
                      {scrapperEnabled ? (
                      <input
                        className="flex-1 bg-transparent text-body-input text-accent-black placeholder:text-black-alpha-48 focus:outline-none focus:ring-0 focus:border-transparent"
                        placeholder="Introduce una URL o un término de búsqueda..."
                        type="text"
                        value={url}
                        disabled={isSearching}
                        onChange={(e) => {
                          const value = e.target.value;
                          setUrl(value);
                          setIsValidUrl(validateUrl(value));
                          // Reset search state when input changes
                          if (value.trim() === "") {
                            setShowSearchTiles(false);
                            setHasSearched(false);
                            setSearchResults([]);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !isSearching) {
                            e.preventDefault();
                            handleSubmit();
                          }
                        }}
                        onFocus={() => {
                          if (url.trim() && !isURL(url) && searchResults.length > 0) {
                            setShowSearchTiles(true);
                          }
                        }}
                      />
                      ) : (
                      <>
                      <div className="flex-1 min-w-0 flex flex-col gap-10">
                        <textarea
                          className="w-full bg-transparent text-body-input text-accent-black placeholder:text-black-alpha-48 focus:outline-none focus:ring-0 focus:border-transparent resize-none min-h-[48px] leading-6"
                          placeholder="Describe lo que quieres crear, o adjunta una imagen de referencia..."
                          value={url}
                          rows={2}
                          onChange={(e) => {
                            setUrl(e.target.value);
                            setIsValidUrl(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSubmit();
                            }
                          }}
                          onPaste={(e) => {
                            const files = Array.from(e.clipboardData.files).filter((file) => file.type.startsWith('image/'));
                            if (files.length) {
                              e.preventDefault();
                              void addPromptFiles(files);
                            }
                          }}
                          onDrop={(e) => {
                            const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
                            if (files.length) {
                              e.preventDefault();
                              void addPromptFiles(files);
                            }
                          }}
                          onDragOver={(e) => e.preventDefault()}
                        />
                        <PromptImageThumbnails
                          images={promptImages}
                          onRemove={(index) => setPromptImages((current) => current.filter((_, i) => i !== index))}
                        />
                      </div>
                      <div className="self-end">
                        <PromptImageAttachButton
                          remaining={MAX_PROMPT_IMAGES - promptImages.length}
                          onFiles={(files) => void addPromptFiles(files)}
                        />
                      </div>
                      </>
                      )}
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          if (!isSearching) {
                            handleSubmit();
                          }
                        }}
                        className={`${isSearching ? 'pointer-events-none' : ''} ${!scrapperEnabled ? 'self-end' : ''}`}
                      >
                        <HeroInputSubmitButton 
                          dirty={url.length > 0 || (!scrapperEnabled && promptImages.length > 0)} 
                          buttonText={
                            !scrapperEnabled
                              ? 'Generar'
                              : isURL(url)
                                ? 'Extraer sitio'
                                : 'Buscar'
                          } 
                          disabled={isSearching}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="px-[28px] pb-[16px]">
                  <div className="border-t border-gray-100">
                    <div
                      className="py-8 grid grid-cols-2 items-center gap-12 group cursor-pointer"
                      onClick={toggleScrapper}
                    >
                      <div className="flex select-none">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-black-alpha-72 transition-all group-hover:text-accent-black">
                            Usar Scrapper
                          </div>
                          <div className="text-[11px] text-black-alpha-48 mt-2">
                            {scrapperEnabled
                              ? 'Buscar y clonar sitios web'
                              : 'Escribe un prompt y genera desde cero'}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          className="transition-all relative rounded-full group bg-black-alpha-10"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleScrapper();
                          }}
                          aria-pressed={scrapperEnabled}
                          aria-label={scrapperEnabled ? 'Desactivar Scrapper' : 'Activar Scrapper'}
                          style={{
                            width: '50px',
                            height: '20px',
                            boxShadow: 'rgba(0, 0, 0, 0.02) 0px 6px 12px 0px inset, rgba(0, 0, 0, 0.02) 0px 0.75px 0.75px 0px inset, rgba(0, 0, 0, 0.04) 0px 0.25px 0.25px 0px inset'
                          }}
                        >
                          <div
                            className={`overlay transition-opacity ${scrapperEnabled ? 'opacity-100' : 'opacity-0'}`}
                            style={{ backgroundColor: 'var(--mx-menu)' }}
                          />
                          <div
                            className="top-[2px] left-[2px] transition-all absolute rounded-full bg-accent-white"
                            style={{
                              width: '28px',
                              height: '16px',
                              boxShadow: 'rgba(0, 0, 0, 0.06) 0px 6px 12px -3px, rgba(0, 0, 0, 0.06) 0px 3px 6px -1px, rgba(0, 0, 0, 0.04) 0px 1px 2px 0px, rgba(0, 0, 0, 0.08) 0px 0.5px 0.5px 0px',
                              transform: scrapperEnabled ? 'translateX(16px)' : 'none'
                            }}
                          />
                        </button>
                      </div>
                    </div>
                    <ModelSelectorGate>
                    <div className="py-8 grid grid-cols-2 items-center gap-12">
                      <div className="text-xs font-medium text-black-alpha-72">
                        Modelo
                      </div>
                      <div className="flex justify-end">
                        <ModelSelect value={selectedModel} onChange={setSelectedModel} />
                      </div>
                    </div>
                    </ModelSelectorGate>
                  </div>
                </div>

                {/* Options Section - brand extension when cloning a URL */}
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  scrapperEnabled && isValidUrl ? (extendBrandStyles ? 'max-h-[400px]' : 'max-h-[80px]') + ' opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="px-[28px] pt-0 pb-[28px]">
                    <div className="bg-white">
                      {scrapperEnabled && (
                      <>
                      <div className={`transition-all duration-300 transform ${
                        isValidUrl ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
                      }`} style={{ transitionDelay: '50ms' }}>
                        <div className="py-8 grid grid-cols-2 items-center gap-12 group cursor-pointer" onClick={() => setExtendBrandStyles(!extendBrandStyles)}>
                          <div className="flex select-none">
                            <div className="flex lg-max:flex-col whitespace-nowrap flex-wrap min-w-0 gap-8 lg:justify-between flex-1">
                              <div className="text-xs font-medium text-black-alpha-72 transition-all group-hover:text-accent-black relative">
                                Extender estilos de marca
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button
                              className="transition-all relative rounded-full group bg-black-alpha-10"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExtendBrandStyles(!extendBrandStyles);
                              }}
                              style={{
                                width: '50px',
                                height: '20px',
                                boxShadow: 'rgba(0, 0, 0, 0.02) 0px 6px 12px 0px inset, rgba(0, 0, 0, 0.02) 0px 0.75px 0.75px 0px inset, rgba(0, 0, 0, 0.04) 0px 0.25px 0.25px 0px inset'
                              }}
                            >
                              <div
                                className={`overlay transition-opacity ${extendBrandStyles ? 'opacity-100' : 'opacity-0'}`}
                                style={{ backgroundColor: '#4B5CF0' }}
                              />
                              <div
                                className="top-[2px] left-[2px] transition-all absolute rounded-full bg-accent-white"
                                style={{
                                  width: '28px',
                                  height: '16px',
                                  boxShadow: 'rgba(0, 0, 0, 0.06) 0px 6px 12px -3px, rgba(0, 0, 0, 0.06) 0px 3px 6px -1px, rgba(0, 0, 0, 0.04) 0px 1px 2px 0px, rgba(0, 0, 0, 0.08) 0px 0.5px 0.5px 0px',
                                  transform: extendBrandStyles ? 'translateX(16px)' : 'none'
                                }}
                              />
                            </button>
                          </div>
                        </div>
                      </div>

                      {extendBrandStyles && (
                        <div className="pb-10 transition-all duration-300 opacity-100">
                          <textarea
                            value={additionalInstructions}
                            onChange={(e) => setAdditionalInstructions(e.target.value)}
                            placeholder="Describe la nueva funcionalidad que quieres crear con los estilos de esta marca..."
                            className="w-full px-4 py-10 text-xs font-medium text-gray-700 bg-gray-50 rounded border border-gray-200 focus:border-[var(--mx-menu)] focus:outline-none focus:ring-1 focus:ring-[var(--mx-menu)] placeholder:text-gray-400 min-h-[80px] resize-none"
                          />
                        </div>
                      )}
                      </>
                      )}
                    </div>
                  </div>
                </div>

            </div>
          </div>

        {/* Full-width oval carousel section */}
        {scrapperEnabled && showSearchTiles && hasSearched && (
          <section className={`carousel-section mx-seccion--alt relative w-full overflow-hidden mt-16 mb-16 transition-opacity duration-500 ${
            isFadingOut ? 'opacity-0' : 'opacity-100'
          }`}>
            <div className="absolute inset-0 bg-[var(--mx-fondo-alt)] rounded-[50%] transform scale-x-150 -translate-y-24 opacity-80" />
            
            {isSearching ? (
              // Loading state with animated scrolling skeletons
              <div className="relative h-[250px] overflow-hidden">
                {/* Edge fade overlays */}
                <div className="absolute left-0 top-0 bottom-0 w-[120px] z-20 pointer-events-none" style={{background: 'linear-gradient(to right, white 0%, white 20%, transparent 100%)'}} />
                <div className="absolute right-0 top-0 bottom-0 w-[120px] z-20 pointer-events-none" style={{background: 'linear-gradient(to left, white 0%, white 20%, transparent 100%)'}} />
                
                <div className="carousel-container absolute left-0 flex gap-12 py-4">
                  {/* Duplicate skeleton tiles for continuous scroll */}
                  {[...Array(10), ...Array(10)].map((_, index) => (
                    <div
                      key={`loading-${index}`}
                      className="flex-shrink-0 w-[400px] h-[240px] rounded-lg overflow-hidden border-2 border-gray-200/30 bg-white relative"
                    >
                      <div className="absolute inset-0 skeleton-shimmer">
                        <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 skeleton-gradient" />
                      </div>
                      
                      {/* Fake browser UI - 5x bigger */}
                      <div className="absolute top-0 left-0 right-0 h-40 bg-gray-100 border-b border-gray-200/50 flex items-center px-6 gap-4">
                        <div className="flex gap-3">
                          <div className="w-5 h-5 rounded-full bg-gray-300 animate-pulse" />
                          <div className="w-5 h-5 rounded-full bg-gray-300 animate-pulse" style={{ animationDelay: '0.1s' }} />
                          <div className="w-5 h-5 rounded-full bg-gray-300 animate-pulse" style={{ animationDelay: '0.2s' }} />
                        </div>
                        <div className="flex-1 h-8 bg-gray-200 rounded-md mx-6 animate-pulse" />
                      </div>
                      
                      {/* Content skeleton - positioned just below nav bar */}
                      <div className="absolute top-44 left-4 right-4">
                        <div className="h-3 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
                        <div className="h-3 bg-gray-150 rounded w-1/2 mb-2 animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <div className="h-3 bg-gray-150 rounded w-2/3 animate-pulse" style={{ animationDelay: '0.3s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : searchResults.length > 0 ? (
              // Actual results
              <div className="relative h-[250px] overflow-hidden">
                {/* Edge fade overlays */}
                <div className="absolute left-0 top-0 bottom-0 w-[120px] z-20 pointer-events-none" style={{background: 'linear-gradient(to right, white 0%, white 20%, transparent 100%)'}} />
                <div className="absolute right-0 top-0 bottom-0 w-[120px] z-20 pointer-events-none" style={{background: 'linear-gradient(to left, white 0%, white 20%, transparent 100%)'}} />
                
                <div className="carousel-container absolute left-0 flex gap-12 py-4">
                  {/* Duplicate results for infinite scroll */}
                  {[...searchResults, ...searchResults].map((result, index) => (
                    <div
                      key={`${result.url}-${index}`}
                      className="group flex-shrink-0 w-[400px] h-[240px] rounded-lg overflow-hidden border-2 border-gray-200/50 transition-all duration-300 hover:shadow-2xl bg-white relative"
                      onMouseLeave={() => {
                        if (showInstructionsForIndex === index) {
                          setShowInstructionsForIndex(null);
                          setAdditionalInstructions('');
                        }
                      }}
                    >
                      {/* Hover overlay with clone buttons or instructions input */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex flex-col items-center justify-center p-6">
                        {showInstructionsForIndex === index ? (
                          /* Instructions input view - matching main input style exactly */
                          <div className="w-full max-w-[380px]">
                            <div className="bg-white rounded-20" style={{
                              boxShadow: "0px 0px 44px 0px rgba(0, 0, 0, 0.02), 0px 88px 56px -20px rgba(0, 0, 0, 0.03), 0px 56px 56px -20px rgba(0, 0, 0, 0.02), 0px 32px 32px -20px rgba(0, 0, 0, 0.03), 0px 16px 24px -12px rgba(0, 0, 0, 0.03), 0px 0px 0px 1px rgba(0, 0, 0, 0.05)"
                            }}>
                              {/* Input area matching main search */}
                              <div className="p-16 flex gap-12 items-start w-full relative">
                                {/* Instructions icon */}
                                <div className="mt-2 flex-shrink-0">
                                  <svg 
                                    width="20" 
                                    height="20" 
                                    viewBox="0 0 20 20" 
                                    fill="none" 
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="opacity-40"
                                  >
                                    <path d="M5 5H15M5 10H15M5 15H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                  </svg>
                                </div>
                                
                                <textarea
                                  value={additionalInstructions}
                                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                                  placeholder="Describe tus personalizaciones..."
                                  className="flex-1 bg-transparent text-body-input text-accent-black placeholder:text-black-alpha-48 focus:outline-none focus:ring-0 focus:border-transparent resize-none min-h-[60px]"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      e.stopPropagation();
                                      setShowInstructionsForIndex(null);
                                      setAdditionalInstructions('');
                                    }
                                  }}
                                />
                              </div>
                              
                              {/* Divider */}
                              <div className="border-t border-black-alpha-5" />
                              
                              {/* Buttons area matching main style */}
                              <div className="p-10 flex justify-between items-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowInstructionsForIndex(null);
                                    setAdditionalInstructions('');
                                  }}
                                  className="button relative rounded-10 px-8 py-8 text-label-medium font-medium flex items-center justify-center bg-black-alpha-4 hover:bg-black-alpha-6 text-black-alpha-48 active:scale-[0.995] transition-all"
                                >
                                  <svg 
                                    width="20" 
                                    height="20" 
                                    viewBox="0 0 20 20" 
                                    fill="none" 
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path d="M12 5L7 10L12 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (additionalInstructions.trim()) {
                                      sessionStorage.setItem('additionalInstructions', additionalInstructions);
                                      handleSubmit(result);
                                    }
                                  }}
                                  disabled={!additionalInstructions.trim()}
                                  className={`
                                    button relative rounded-10 px-8 py-8 text-label-medium font-medium
                                    flex items-center justify-center gap-6
                                    ${additionalInstructions.trim() 
                                      ? 'button-primary text-accent-white active:scale-[0.995]' 
                                      : 'bg-black-alpha-4 text-black-alpha-24 cursor-not-allowed'
                                    }
                                  `}
                                >
                                  {additionalInstructions.trim() && <div className="button-background absolute inset-0 rounded-10 pointer-events-none" />}
                                  <span className="px-6 relative">Aplicar y clonar</span>
                                  <svg 
                                    width="20" 
                                    height="20" 
                                    viewBox="0 0 20 20" 
                                    fill="none" 
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="relative"
                                  >
                                    <path d="M11.6667 4.79163L16.875 9.99994M16.875 9.99994L11.6667 15.2083M16.875 9.99994H3.125" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Default buttons view */
                          <>
                            <div className="text-white text-center mb-3">
                              <p className="text-base font-semibold mb-0.5">{result.title}</p>
                              <p className="text-[11px] opacity-80">Elige cómo clonar este sitio</p>
                            </div>
                            
                            <div className="flex gap-3 justify-center">
                              {/* Clonar al instante Button - Orange/Heat style */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSubmit(result);
                                }}
                                className="bg-[var(--mx-menu)] hover:opacity-95 flex items-center justify-center button relative text-label-medium button-primary group/button rounded-10 p-8 gap-2 text-white active:scale-[0.995]"
                              >
                                <div className="button-background absolute inset-0 rounded-10 pointer-events-none" />
                                <svg 
                                  width="20" 
                                  height="20" 
                                  viewBox="0 0 20 20" 
                                  fill="none" 
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="relative"
                                >
                                  <path d="M11.6667 4.79163L16.875 9.99994M16.875 9.99994L11.6667 15.2083M16.875 9.99994H3.125" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
                                </svg>
                                <span className="px-6 relative">Clonar al instante</span>
                              </button>
                              
                              {/* Instructions Button - Gray style */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowInstructionsForIndex(index);
                                  setAdditionalInstructions('');
                                }}
                                className="bg-gray-100 hover:bg-gray-200 flex items-center justify-center button relative text-label-medium rounded-10 p-8 gap-2 text-gray-700 active:scale-[0.995]"
                              >
                                <svg 
                                  width="20" 
                                  height="20" 
                                  viewBox="0 0 20 20" 
                                  fill="none" 
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="opacity-60"
                                >
                                  <path d="M5 5H15M5 10H15M5 15H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                  <path d="M14 14L16 16L14 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <span className="px-6">Añadir instrucciones</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {result.screenshot ? (
                        <div className="relative w-full h-full">
                          <img
                            src={result.screenshot}
                            alt={result.title}
                            className="absolute inset-0 w-full h-full object-cover object-top"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                          <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-gray-200 mx-auto mb-3 flex items-center justify-center">
                              <svg 
                                width="32" 
                                height="32" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                xmlns="http://www.w3.org/2000/svg"
                                className="text-gray-400"
                              >
                                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                                <path d="M3 9H21" stroke="currentColor" strokeWidth="1.5"/>
                                <circle cx="6" cy="6" r="1" fill="currentColor"/>
                                <circle cx="9" cy="6" r="1" fill="currentColor"/>
                                <circle cx="12" cy="6" r="1" fill="currentColor"/>
                              </svg>
                            </div>
                            <p className="text-gray-500 text-sm font-medium">{result.title}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // No results state
              <div className="relative h-[250px] flex items-center justify-center">
                <div className="text-center">
                  <div className="mb-4">
                    <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-lg">No se encontraron resultados</p>
                  <p className="text-gray-400 text-sm mt-1">Prueba con otro término de búsqueda</p>
                </div>
              </div>
            )}
          </section>
        )}

      </div>

      <style jsx>{`
        @keyframes infiniteScroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .carousel-container {
          animation: infiniteScroll 30s linear infinite;
        }

        .carousel-container:hover {
          animation-play-state: paused;
        }

        .skeleton-shimmer {
          position: relative;
          overflow: hidden;
        }

        .skeleton-gradient {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </HeaderProvider>
  );
}