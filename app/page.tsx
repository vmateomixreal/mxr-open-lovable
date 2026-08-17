"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from '@/config/app.config';
import { isLikelyUrl } from '@/lib/url';
import { toast } from "sonner";
import { filesToPromptImages, MAX_PROMPT_IMAGES, setPendingPromptImages } from "@/lib/prompt-images";
import { PromptImageAttachButton, PromptImageThumbnails } from "@/components/PromptImageAttachments";

// Import shared components
import { Connector } from "@/components/shared/layout/curvy-rect";
import HeroFlame from "@/components/shared/effects/flame/hero-flame";
import AsciiExplosion from "@/components/shared/effects/flame/ascii-explosion";
import { HeaderProvider } from "@/components/shared/header/HeaderContext";

// Import hero section components
import HomeHeroBackground from "@/components/app/(home)/sections/hero/Background/Background";
import { BackgroundOuterPiece } from "@/components/app/(home)/sections/hero/Background/BackgroundOuterPiece";
import HomeHeroBadge from "@/components/app/(home)/sections/hero/Badge/Badge";
import HomeHeroPixi from "@/components/app/(home)/sections/hero/Pixi/Pixi";
import HomeHeroTitle from "@/components/app/(home)/sections/hero/Title/Title";
import HeroInputSubmitButton from "@/components/app/(home)/sections/hero-input/Button/Button";
import ModelSelect, { getStoredModel } from "@/components/ModelSelect";
// import Globe from "@/components/app/(home)/sections/hero-input/_svg/Globe";

// Import header components
import HeaderBrandKit from "@/components/shared/header/BrandKit/BrandKit";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import GithubIcon from "@/components/shared/header/Github/_svg/GithubIcon";
import ButtonUI from "@/components/ui/shadcn/button"

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
  const [firecrawlEnabled, setFirecrawlEnabled] = useState<boolean>(true);
  const [promptImages, setPromptImages] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const storedFirecrawl = localStorage.getItem('firecrawlEnabled');
    if (storedFirecrawl === 'false') {
      setFirecrawlEnabled(false);
    }
    setSelectedModel(getStoredModel());
  }, []);

  const toggleFirecrawl = () => {
    const next = !firecrawlEnabled;
    setFirecrawlEnabled(next);
    localStorage.setItem('firecrawlEnabled', String(next));
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
      toast.error('Could not attach that image. Try another file.');
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

    if (!inputValue && (firecrawlEnabled || promptImages.length === 0)) {
      toast.error(firecrawlEnabled ? "Please enter a URL or search term" : "Please describe what you want to build or attach an image");
      return;
    }

    if (!firecrawlEnabled) {
      const promptText = inputValue || 'Build a React app inspired by the attached reference images.';
      setPendingPromptImages(promptImages);
      sessionStorage.setItem('directPrompt', promptText);
      sessionStorage.setItem('directPromptMode', 'true');
      sessionStorage.setItem('selectedModel', selectedModel);
      sessionStorage.setItem('autoStart', 'true');
      sessionStorage.removeItem('selectedStyle');
      sessionStorage.removeItem('additionalInstructions');
      router.push('/generation');
      return;
    }

    // Validate brand extension mode requirements
    if (extendBrandStyles && isURL(inputValue) && !additionalInstructions.trim()) {
      toast.error("Please describe what you want to build with this brand's styles");
      return;
    }
    
    // If it's a search result being selected, fade out and redirect
    if (selectedResult) {
      setIsFadingOut(true);
      
      // Wait for fade animation
      setTimeout(() => {
        sessionStorage.setItem('targetUrl', selectedResult.url);
        sessionStorage.setItem('selectedModel', selectedModel);
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
        sessionStorage.setItem('selectedModel', selectedModel);
        sessionStorage.setItem('autoStart', 'true');
        sessionStorage.setItem('brandExtensionMode', 'true');
        sessionStorage.setItem('brandExtensionPrompt', additionalInstructions || '');
        router.push('/generation');
      } else {
        // Normal clone mode
        sessionStorage.setItem('targetUrl', inputValue);
        sessionStorage.setItem('selectedModel', selectedModel);
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
          toast.error('No websites found. Try a different search.');
        }
      } else {
        toast.error('Search failed. Check your Firecrawl API key and try again.');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <HeaderProvider>
      <div className="min-h-screen bg-background-base">
        {/* Header/Navigation Section */}
        <HeaderDropdownWrapper />

        <div className="sticky top-0 left-0 w-full z-[101] bg-background-base header">
          <div className="absolute top-0 cmw-container border-x border-border-faint h-full pointer-events-none" />
          <div className="h-1 bg-border-faint w-full left-0 -bottom-1 absolute" />
          <div className="cmw-container absolute h-full pointer-events-none top-0">
            <Connector className="absolute -left-[10.5px] -bottom-11" />
            <Connector className="absolute -right-[10.5px] -bottom-11" />
          </div>

          <HeaderWrapper>
            <div className="max-w-[900px] mx-auto w-full flex justify-between items-center">
              <div className="flex gap-24 items-center">
                <HeaderBrandKit />
              </div>
              <div className="flex gap-8">
                <a
                  className="contents"
                  href="https://github.com/mendableai/open-lovable"
                  target="_blank"
                >
                  <ButtonUI variant="tertiary">
                    <GithubIcon />
                    Use this Template
                  </ButtonUI>
                </a>
              </div>
            </div>
          </HeaderWrapper>
        </div>

        {/* Hero Section */}
        <section className="overflow-x-clip" id="home-hero">
          <div className="pt-28 lg:pt-254 lg:-mt-100 pb-115 relative" id="hero-content">
            <HomeHeroPixi />
            <HeroFlame />
            <BackgroundOuterPiece />
            <HomeHeroBackground />

            <div className="relative container px-16">
              <HomeHeroBadge />
              <HomeHeroTitle />
              <p className="text-center text-body-large">
                {firecrawlEnabled
                  ? 'Clone brand format or re-imagine any website, in seconds.'
                  : 'Describe an app and generate it from scratch, in seconds.'}
              </p>
              <button
                type="button"
                className={`rounded-6 px-8 lg:px-6 text-label-large h-30 lg:h-24 block mt-8 mx-auto w-max gap-4 transition-all ${
                  firecrawlEnabled
                    ? 'bg-black-alpha-4 hover:bg-black-alpha-6'
                    : 'bg-heat-100 hover:bg-heat-200 text-accent-white'
                }`}
                onClick={toggleFirecrawl}
              >
                {firecrawlEnabled ? 'Powered by Firecrawl' : 'Firecrawl off · prompt mode'}
              </button>
            </div>
          </div>

          {/* Mini Playground Input */}
          <div className="container lg:contents !p-16 relative -mt-90">
            <div className="absolute top-0 left-[calc(50%-50vw)] w-screen h-1 bg-border-faint lg:hidden" />
            <div className="absolute bottom-0 left-[calc(50%-50vw)] w-screen h-1 bg-border-faint lg:hidden" />
            <Connector className="-top-10 -left-[10.5px] lg:hidden" />
            <Connector className="-top-10 -right-[10.5px] lg:hidden" />
            <Connector className="-bottom-10 -left-[10.5px] lg:hidden" />
            <Connector className="-bottom-10 -right-[10.5px] lg:hidden" />

            {/* Hero Input Component */}
            <div className="max-w-552 mx-auto z-[11] lg:z-[2]">
              <div className="rounded-20 -mt-30 lg:-mt-30">
                <div
                  className="bg-white rounded-20 relative z-10"
                  style={{
                    boxShadow:
                      "0px 0px 44px 0px rgba(0, 0, 0, 0.02), 0px 88px 56px -20px rgba(0, 0, 0, 0.03), 0px 56px 56px -20px rgba(0, 0, 0, 0.02), 0px 32px 32px -20px rgba(0, 0, 0, 0.03), 0px 16px 24px -12px rgba(0, 0, 0, 0.03), 0px 0px 0px 1px rgba(0, 0, 0, 0.05), 0px 0px 0px 10px #F9F9F9",
                  }}
                >

                <div className={`p-[28px] flex gap-12 w-full relative bg-white rounded-20 ${firecrawlEnabled ? 'items-center' : 'items-start'}`}>
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
                        Select which site to clone from the results below
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
                        <span>Search Again</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {firecrawlEnabled ? (
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
                      {firecrawlEnabled ? (
                      <input
                        className="flex-1 bg-transparent text-body-input text-accent-black placeholder:text-black-alpha-48 focus:outline-none focus:ring-0 focus:border-transparent"
                        placeholder="Enter URL or search term..."
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
                          placeholder="Describe what you want to build, or attach a reference image..."
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
                        className={`${isSearching ? 'pointer-events-none' : ''} ${!firecrawlEnabled ? 'self-end' : ''}`}
                      >
                        <HeroInputSubmitButton 
                          dirty={url.length > 0 || (!firecrawlEnabled && promptImages.length > 0)} 
                          buttonText={
                            !firecrawlEnabled
                              ? 'Generate'
                              : isURL(url)
                                ? 'Scrape Site'
                                : 'Search'
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
                      onClick={toggleFirecrawl}
                    >
                      <div className="flex select-none">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-black-alpha-72 transition-all group-hover:text-accent-black">
                            Use Firecrawl
                          </div>
                          <div className="text-[11px] text-black-alpha-48 mt-2">
                            {firecrawlEnabled
                              ? 'Search and clone websites'
                              : 'Write a prompt and generate from scratch'}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          className="transition-all relative rounded-full group bg-black-alpha-10"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFirecrawl();
                          }}
                          aria-pressed={firecrawlEnabled}
                          aria-label={firecrawlEnabled ? 'Disable Firecrawl' : 'Enable Firecrawl'}
                          style={{
                            width: '50px',
                            height: '20px',
                            boxShadow: 'rgba(0, 0, 0, 0.02) 0px 6px 12px 0px inset, rgba(0, 0, 0, 0.02) 0px 0.75px 0.75px 0px inset, rgba(0, 0, 0, 0.04) 0px 0.25px 0.25px 0px inset'
                          }}
                        >
                          <div
                            className={`overlay transition-opacity ${firecrawlEnabled ? 'opacity-100' : 'opacity-0'}`}
                            style={{ background: 'color(display-p3 0.9059 0.3294 0.0784)', backgroundColor: '#FA4500' }}
                          />
                          <div
                            className="top-[2px] left-[2px] transition-all absolute rounded-full bg-accent-white"
                            style={{
                              width: '28px',
                              height: '16px',
                              boxShadow: 'rgba(0, 0, 0, 0.06) 0px 6px 12px -3px, rgba(0, 0, 0, 0.06) 0px 3px 6px -1px, rgba(0, 0, 0, 0.04) 0px 1px 2px 0px, rgba(0, 0, 0, 0.08) 0px 0.5px 0.5px 0px',
                              transform: firecrawlEnabled ? 'translateX(16px)' : 'none'
                            }}
                          />
                        </button>
                      </div>
                    </div>
                    <div className="py-8 grid grid-cols-2 items-center gap-12">
                      <div className="text-xs font-medium text-black-alpha-72">
                        Model
                      </div>
                      <div className="flex justify-end">
                        <ModelSelect value={selectedModel} onChange={setSelectedModel} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Options Section - brand extension when cloning a URL */}
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  firecrawlEnabled && isValidUrl ? (extendBrandStyles ? 'max-h-[400px]' : 'max-h-[80px]') + ' opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="px-[28px] pt-0 pb-[28px]">
                    <div className="bg-white">
                      {firecrawlEnabled && (
                      <>
                      <div className={`transition-all duration-300 transform ${
                        isValidUrl ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
                      }`} style={{ transitionDelay: '50ms' }}>
                        <div className="py-8 grid grid-cols-2 items-center gap-12 group cursor-pointer" onClick={() => setExtendBrandStyles(!extendBrandStyles)}>
                          <div className="flex select-none">
                            <div className="flex lg-max:flex-col whitespace-nowrap flex-wrap min-w-0 gap-8 lg:justify-between flex-1">
                              <div className="text-xs font-medium text-black-alpha-72 transition-all group-hover:text-accent-black relative">
                                Extend brand styles
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
                                style={{ background: 'color(display-p3 0.9059 0.3294 0.0784)', backgroundColor: '#FA4500' }}
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
                            placeholder="Describe the new functionality you want to build using this brand's styles..."
                            className="w-full px-4 py-10 text-xs font-medium text-gray-700 bg-gray-50 rounded border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-gray-400 min-h-[80px] resize-none"
                          />
                        </div>
                      )}
                      </>
                      )}
                    </div>
                  </div>
                </div>

                </div>

                <div className="h-248 top-84 cw-768 pointer-events-none absolute overflow-clip -z-10">
                  <AsciiExplosion className="-top-200" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Full-width oval carousel section */}
        {firecrawlEnabled && showSearchTiles && hasSearched && (
          <section className={`carousel-section relative w-full overflow-hidden mt-32 mb-32 transition-opacity duration-500 ${
            isFadingOut ? 'opacity-0' : 'opacity-100'
          }`}>
            <div className="absolute inset-0 bg-gradient-to-b from-gray-50/50 to-white rounded-[50%] transform scale-x-150 -translate-y-24" />
            
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
                                  placeholder="Describe your customizations..."
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
                                  <span className="px-6 relative">Apply & Clone</span>
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
                              <p className="text-[11px] opacity-80">Choose how to clone this site</p>
                            </div>
                            
                            <div className="flex gap-3 justify-center">
                              {/* Instant Clone Button - Orange/Heat style */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSubmit(result);
                                }}
                                className="bg-orange-500 hover:bg-orange-600 flex items-center justify-center button relative text-label-medium button-primary group/button rounded-10 p-8 gap-2 text-white active:scale-[0.995]"
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
                                <span className="px-6 relative">Instant Clone</span>
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
                                <span className="px-6">Add Instructions</span>
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
                  <p className="text-gray-500 text-lg">No results found</p>
                  <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
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