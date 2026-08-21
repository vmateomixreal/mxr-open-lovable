"use client";

import { filesToPromptImages, MAX_PROMPT_IMAGES, setPendingPromptImages } from "@/lib/prompt-images";
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import { getStoredModel } from "@/components/ModelSelect";
import HomeHeroTitle from "@/components/app/(home)/sections/hero/Title/Title";
import HomeComposer from "@/components/HomeComposer";
import HomeTemplatesSection, {
  type TemplateCard,
} from "@/components/HomeTemplatesSection";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from '@/config/app.config';
import { isLikelyUrl } from '@/lib/url';

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
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [extendBrandStyles, setExtendBrandStyles] = useState<boolean>(false);
  const [scrapperEnabled, setScrapperEnabled] = useState<boolean>(false);
  const [promptImages, setPromptImages] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const storedScrapper = localStorage.getItem('scrapperEnabled') ?? localStorage.getItem('firecrawlEnabled');
    if (storedScrapper === 'false') {
      setScrapperEnabled(false);
    }
    setSelectedModel(getStoredModel());
  }, []);

  const scrollToTemplates = () => {
    setTimeout(() => {
      document.querySelector('.templates-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 120);
  };

  const toggleScrapper = () => {
    const next = !scrapperEnabled;
    setScrapperEnabled(next);
    localStorage.setItem('scrapperEnabled', String(next));
    if (!next) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setExtendBrandStyles(false);
      setIsValidUrl(false);
    } else {
      setPromptImages([]);
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
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

  const validateUrl = (urlString: string) => {
    if (!urlString) return false;
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    return urlPattern.test(urlString.toLowerCase());
  };

  const isURL = (str: string): boolean => isLikelyUrl(str);

  const startGenerationFromResult = (selectedResult: SearchResult) => {
    sessionStorage.setItem('targetUrl', selectedResult.url);
    sessionStorage.setItem('selectedModel', appConfig.ui.showModelSelector ? selectedModel : appConfig.ai.lockedModel);
    sessionStorage.setItem('autoStart', 'true');
    if (selectedResult.markdown) {
      sessionStorage.setItem('siteMarkdown', selectedResult.markdown);
    }
    router.push('/generation');
  };

  const handleUsePlaceholder = (template: TemplateCard) => {
    const promptText = `Crea una app React inspirada en la plantilla "${template.title}". ${template.description}.`;
    setPendingPromptImages([]);
    sessionStorage.setItem('directPrompt', promptText);
    sessionStorage.setItem('directPromptMode', 'true');
    sessionStorage.setItem('selectedModel', appConfig.ui.showModelSelector ? selectedModel : appConfig.ai.lockedModel);
    sessionStorage.setItem('autoStart', 'true');
    sessionStorage.removeItem('selectedStyle');
    sessionStorage.removeItem('additionalInstructions');
    router.push('/generation');
  };

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

    if (extendBrandStyles && isURL(inputValue) && !additionalInstructions.trim()) {
      toast.error("Describe lo que quieres crear con los estilos de esta marca");
      return;
    }

    if (selectedResult) {
      startGenerationFromResult(selectedResult);
      return;
    }

    if (isURL(inputValue)) {
      if (extendBrandStyles) {
        sessionStorage.setItem('targetUrl', inputValue);
        sessionStorage.setItem('selectedModel', appConfig.ui.showModelSelector ? selectedModel : appConfig.ai.lockedModel);
        sessionStorage.setItem('autoStart', 'true');
        sessionStorage.setItem('brandExtensionMode', 'true');
        sessionStorage.setItem('brandExtensionPrompt', additionalInstructions || '');
        router.push('/generation');
      } else {
        sessionStorage.setItem('targetUrl', inputValue);
        sessionStorage.setItem('selectedModel', appConfig.ui.showModelSelector ? selectedModel : appConfig.ai.lockedModel);
        sessionStorage.setItem('autoStart', 'true');
        router.push('/generation');
      }
      return;
    }

    setSearchResults([]);
    setHasSearched(true);
    setIsSearching(true);
    scrollToTemplates();
    await performSearch(inputValue);
  };

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || isURL(searchQuery)) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
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
          </div>
        </section>

        <div className="mx-home-main">
          <div className="mx-home-composer-slot relative z-[2]">
            <HomeComposer
              value={url}
              onChange={(value) => {
                setUrl(value);
                if (scrapperEnabled) {
                  setIsValidUrl(validateUrl(value));
                  if (value.trim() === '') {
                    setHasSearched(false);
                    setSearchResults([]);
                    setIsSearching(false);
                  }
                } else {
                  setIsValidUrl(false);
                }
              }}
              scrapperEnabled={scrapperEnabled}
              onToggleMode={toggleScrapper}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              promptImages={promptImages}
              onAddFiles={(files) => void addPromptFiles(files)}
              onRemoveImage={(index) =>
                setPromptImages((current) => current.filter((_, i) => i !== index))
              }
              onSubmit={() => {
                if (!isSearching) handleSubmit();
              }}
              isSearching={isSearching}
              hasSearchResults={hasSearched && searchResults.length > 0}
              onSearchAgain={() => {
                setSearchResults([]);
                setHasSearched(false);
                setIsSearching(false);
                setUrl('');
              }}
              isValidUrl={isValidUrl}
              extendBrandStyles={extendBrandStyles}
              onExtendBrandStylesChange={setExtendBrandStyles}
              brandInstructions={additionalInstructions}
              onBrandInstructionsChange={setAdditionalInstructions}
            />
          </div>

          <HomeTemplatesSection
            scrapperEnabled={scrapperEnabled}
            isSearching={isSearching}
            hasSearched={hasSearched}
            searchResults={searchResults}
            onUseResult={(result) => startGenerationFromResult(result)}
            onUsePlaceholder={handleUsePlaceholder}
          />
        </div>
      </div>
    </HeaderProvider>
  );
}
