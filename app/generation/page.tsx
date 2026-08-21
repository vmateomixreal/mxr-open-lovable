'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { appConfig } from '@/config/app.config';
import HeroInput from '@/components/HeroInput';
import ModelSelect, { getStoredModel } from '@/components/ModelSelect';
import { ModelSelectorGate } from '@/components/ModelSelectorGate';
import { takePendingPromptImages } from '@/lib/prompt-images';
import { isLogoSwapRequest } from '@/lib/prompt-images';
import SidebarInput from '@/components/app/generation/SidebarInput';
import Link from 'next/link';
import { HeaderProvider } from '@/components/shared/header/HeaderContext';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
// Import icons from centralized module to avoid Turbopack chunk issues
import { 
  FiFile, 
  FiChevronRight, 
  FiChevronDown,
  FiGithub,
  BsFolderFill, 
  BsFolder2Open,
  SiJavascript, 
  SiReact, 
  SiCss3, 
  SiJson 
} from '@/lib/icons';
import { motion } from 'framer-motion';
import CodeApplicationProgress, { type CodeApplicationState } from '@/components/CodeApplicationProgress';
import GenerationFileList from '@/components/app/generation/GenerationFileList';
import { toSpanishGenerationStatus } from '@/lib/i18n/generation-status.es';

interface SandboxData {
  sandboxId: string;
  url: string;
  [key: string]: any;
}

interface ChatMessage {
  content: string;
  type: 'user' | 'ai' | 'system' | 'file-update' | 'command' | 'error';
  timestamp: Date;
  metadata?: {
    scrapedUrl?: string;
    scrapedContent?: any;
    generatedCode?: string;
    appliedFiles?: string[];
    commandType?: 'input' | 'output' | 'error' | 'success';
    brandingData?: any;
    sourceUrl?: string;
    images?: string[];
  };
}

interface ScrapeData {
  success: boolean;
  content?: string;
  url?: string;
  title?: string;
  source?: string;
  screenshot?: string;
  structured?: any;
  metadata?: any;
  message?: string;
  error?: string;
}

function AISandboxPage() {
  const [sandboxData, setSandboxData] = useState<SandboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ text: 'No conectado', active: false });
  const [responseArea, setResponseArea] = useState<string[]>([]);
  const [structureContent, setStructureContent] = useState('Aún no hay sandbox');
  const [promptInput, setPromptInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      content: '¡Hola! Puedo generar e iterar código con el contexto completo de tu sandbox.\n\nEmpieza a chatear: si hace falta, creo el entorno automáticamente.\n\nConsejo: si faltan paquetes (p. ej. react-router-dom), escribe «npm install» o «check packages».',
      type: 'system',
      timestamp: new Date()
    }
  ]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiEnabled] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [aiModel, setAiModel] = useState(() => {
    if (!appConfig.ui.showModelSelector) {
      return appConfig.ai.lockedModel;
    }
    const modelParam = searchParams.get('model');
    if (modelParam) {
      return modelParam;
    }
    return getStoredModel();
  });
  const [urlOverlayVisible, setUrlOverlayVisible] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlStatus, setUrlStatus] = useState<string[]>([]);
  const [showHomeScreen, setShowHomeScreen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['app', 'src', 'src/components']));
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [homeScreenFading, setHomeScreenFading] = useState(false);
  const [homeUrlInput, setHomeUrlInput] = useState('');
  const [homeContextInput, setHomeContextInput] = useState('');
  const [activeTab, setActiveTab] = useState<'generation' | 'preview'>('preview');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [showLoadingBackground, setShowLoadingBackground] = useState(false);
  const [urlScreenshot, setUrlScreenshot] = useState<string | null>(null);
  const [isScreenshotLoaded, setIsScreenshotLoaded] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [isPreparingDesign, setIsPreparingDesign] = useState(false);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [sidebarScrolled, setSidebarScrolled] = useState(false);
  const [screenshotCollapsed, setScreenshotCollapsed] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'gathering' | 'planning' | 'generating' | null>(null);
  const [isStartingNewGeneration, setIsStartingNewGeneration] = useState(false);
  const [sandboxFiles, setSandboxFiles] = useState<Record<string, string>>({});
  const [hasInitialSubmission, setHasInitialSubmission] = useState<boolean>(false);
  const [fileStructure, setFileStructure] = useState<string>('');
  const [directPromptMode, setDirectPromptMode] = useState(false);
  const [chatImages, setChatImages] = useState<string[]>([]);
  const initialPromptImagesRef = useRef<string[]>([]);
  const pendingLogoApplyRef = useRef<{
    disableMorph: boolean;
    logoSwap: boolean;
    uploadedImages: Array<{
      publicUrl: string;
      modulePath: string;
      importFromComponents: string;
      exportName: string;
    }>;
  }>({ disableMorph: false, logoSwap: false, uploadedImages: [] });
  
  const [conversationContext, setConversationContext] = useState<{
    scrapedWebsites: Array<{ url: string; content: any; timestamp: Date }>;
    generatedComponents: Array<{ name: string; path: string; content: string }>;
    appliedCode: Array<{ files: string[]; timestamp: Date }>;
    currentProject: string;
    lastGeneratedCode?: string;
  }>({
    scrapedWebsites: [],
    generatedComponents: [],
    appliedCode: [],
    currentProject: '',
    lastGeneratedCode: undefined
  });
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sandboxDataRef = useRef<SandboxData | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const codeDisplayRef = useRef<HTMLDivElement>(null);
  /** Src con cache-bust para forzar recarga del iframe (Vite tiene HMR desactivado). */
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  
  const [codeApplicationState, setCodeApplicationState] = useState<CodeApplicationState>({
    stage: null
  });
  
  const [generationProgress, setGenerationProgress] = useState<{
    isGenerating: boolean;
    status: string;
    components: Array<{ name: string; path: string; completed: boolean }>;
    currentComponent: number;
    streamedCode: string;
    isStreaming: boolean;
    isThinking: boolean;
    thinkingText?: string;
    thinkingDuration?: number;
    currentFile?: { path: string; content: string; type: string };
    files: Array<{ path: string; content: string; type: string; completed: boolean; edited?: boolean }>;
    lastProcessedPosition: number;
    isEdit?: boolean;
  }>({
    isGenerating: false,
    status: '',
    components: [],
    currentComponent: 0,
    streamedCode: '',
    isStreaming: false,
    isThinking: false,
    files: [],
    lastProcessedPosition: 0
  });

  // Store flag to trigger generation after component mounts
  const [shouldAutoGenerate, setShouldAutoGenerate] = useState(false);

  // Clear old conversation data on component mount and create/restore sandbox
  useEffect(() => {
    let isMounted = true;

    const initializePage = async () => {
      
      // First check URL parameters (from home page navigation)
      const urlParam = searchParams.get('url');
      const templateParam = searchParams.get('template');
      const detailsParam = searchParams.get('details');
      
      // Then check session storage as fallback
      const storedUrl = urlParam || sessionStorage.getItem('targetUrl');
      const storedStyle = templateParam || sessionStorage.getItem('selectedStyle');
      const storedModel = sessionStorage.getItem('selectedModel');
      const storedInstructions = sessionStorage.getItem('additionalInstructions');
      const storedDirectPrompt = sessionStorage.getItem('directPrompt');

      const applyStoredStyleContext = () => {
        if (detailsParam) {
          setHomeContextInput(detailsParam);
        } else if (storedStyle && !urlParam) {
          const styleNames: Record<string, string> = {
            '1': 'Glassmorphism',
            '2': 'Neumorphism',
            '3': 'Brutalism',
            '4': 'Minimalist',
            '5': 'Dark Mode',
            '6': 'Gradient Rich',
            '7': '3D Depth',
            '8': 'Retro Wave',
            'modern': 'Modern clean and minimalist',
            'playful': 'Fun colorful and playful',
            'professional': 'Corporate professional and sleek',
            'artistic': 'Creative artistic and unique'
          };
          const styleName = styleNames[storedStyle] || storedStyle;
          let contextString = `${styleName} style design`;
          
          if (storedInstructions) {
            contextString += `. ${storedInstructions}`;
          }
          
          setHomeContextInput(contextString);
        } else if (storedInstructions && !urlParam) {
          setHomeContextInput(storedInstructions);
        }
      };
      
      if (storedDirectPrompt) {
        setHasInitialSubmission(true);
        sessionStorage.removeItem('directPrompt');
        sessionStorage.removeItem('selectedStyle');
        sessionStorage.removeItem('selectedModel');
        sessionStorage.removeItem('additionalInstructions');

        const pendingImages = takePendingPromptImages();
        initialPromptImagesRef.current = pendingImages;

        setDirectPromptMode(true);
        setHomeUrlInput(storedDirectPrompt);
        setSelectedStyle(storedStyle || 'modern');
        applyStoredStyleContext();

        if (storedModel) {
          setAiModel(storedModel);
        }

        setShowHomeScreen(false);
        setHomeScreenFading(false);
        setShouldAutoGenerate(true);
        sessionStorage.setItem('autoStart', 'true');
        sessionStorage.setItem('directPromptMode', 'true');
      } else if (storedUrl) {
        // Mark that we have an initial submission since we're loading with a URL
        setHasInitialSubmission(true);
        
        // Clear sessionStorage after reading  
        sessionStorage.removeItem('targetUrl');
        sessionStorage.removeItem('selectedStyle');
        sessionStorage.removeItem('selectedModel');
        sessionStorage.removeItem('additionalInstructions');
        // Note: Don't clear siteMarkdown here, it will be cleared when used
        
        // Set the values in the component state
        setHomeUrlInput(storedUrl);
        setSelectedStyle(storedStyle || 'modern');
        applyStoredStyleContext();
        
        if (storedModel) {
          setAiModel(storedModel);
        }
        
        // Skip the home screen and go directly to builder
        setShowHomeScreen(false);
        setHomeScreenFading(false);
        
        // Set flag to auto-trigger generation after component updates
        setShouldAutoGenerate(true);
        
        // Also set autoStart flag for the effect
        sessionStorage.setItem('autoStart', 'true');
      }
      
      // Clear old conversation
      try {
        await fetch('/api/conversation-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear-old' })
        });
        console.log('[home] Cleared old conversation data on mount');
      } catch (error) {
        console.error('[ai-sandbox] Failed to clear old conversation:', error);
        if (isMounted) {
          addChatMessage('No se pudieron borrar los datos de la conversación anterior.', 'error');
        }
      }
      
      if (!isMounted) return;

      // Only start cloning when we arrived from the home search/select flow.
      // Do not create an empty sandbox just by visiting /generation.
      if ((storedUrl || storedDirectPrompt) && isMounted) {
        sessionStorage.setItem('autoStart', 'true');
      }
    };
    
    initializePage();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount
  
  useEffect(() => {
    // Handle Escape key for home screen
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showHomeScreen) {
        setHomeScreenFading(true);
        setTimeout(() => {
          setShowHomeScreen(false);
          setHomeScreenFading(false);
        }, 500);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHomeScreen]);

  useEffect(() => {
    sandboxDataRef.current = sandboxData;
    if (sandboxData?.url) {
      setPreviewSrc(prev => {
        // Mantener cache-bust si ya apunta a la misma base
        if (prev && prev.startsWith(sandboxData.url)) return prev;
        return sandboxData.url;
      });
    } else {
      setPreviewSrc(null);
    }
  }, [sandboxData]);
  
  // Start capturing screenshot if URL is provided on mount (from home screen)
  useEffect(() => {
    if (!showHomeScreen && homeUrlInput && !urlScreenshot && !isCapturingScreenshot && !directPromptMode) {
      let screenshotUrl = homeUrlInput.trim();
      if (!screenshotUrl.match(/^https?:\/\//i)) {
        screenshotUrl = 'https://' + screenshotUrl;
      }
      captureUrlScreenshot(screenshotUrl);
    }
  }, [showHomeScreen, homeUrlInput, directPromptMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start generation if flagged
  useEffect(() => {
    const autoStart = sessionStorage.getItem('autoStart');
    if (autoStart === 'true' && !showHomeScreen && homeUrlInput) {
      sessionStorage.removeItem('autoStart');
      // Small delay to ensure everything is ready
      setTimeout(() => {
        console.log('[generation] Auto-starting generation for URL:', homeUrlInput);
        startGeneration();
      }, 1000);
    }
  }, [showHomeScreen, homeUrlInput]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    // Only check sandbox status on mount if we don't already have sandboxData
    // AND we're not auto-starting a new generation (which would create a new sandbox)
    const autoStart = sessionStorage.getItem('autoStart');
    if (!sandboxData && autoStart !== 'true') {
      checkSandboxStatus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Auto-trigger generation when flag is set (from home page navigation)
  useEffect(() => {
    if (shouldAutoGenerate && homeUrlInput && !showHomeScreen) {
      // Reset the flag
      setShouldAutoGenerate(false);
      
      // Trigger generation after a short delay to ensure everything is set up
      const timer = setTimeout(() => {
        console.log('[generation] Auto-triggering generation from URL params');
        startGeneration();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoGenerate, homeUrlInput, showHomeScreen]);

  const updateStatus = (text: string, active: boolean) => {
    setStatus({ text, active });
  };

  const log = (message: string, type: 'info' | 'error' | 'command' = 'info') => {
    setResponseArea(prev => [...prev, `[${type}] ${message}`]);
  };

  const addChatMessage = (content: string, type: ChatMessage['type'], metadata?: ChatMessage['metadata']) => {
    const localized =
      type === 'system' || type === 'ai'
        ? toSpanishGenerationStatus(content)
        : content;
    setChatMessages(prev => {
      // Skip duplicate consecutive system messages
      if (type === 'system' && prev.length > 0) {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.type === 'system' && lastMessage.content === localized) {
          return prev; // Skip duplicate
        }
      }
      return [...prev, { content: localized, type, timestamp: new Date(), metadata }];
    });
  };
  
  const checkAndInstallPackages = async () => {
    // This function is only called when user explicitly requests it
    // Don't show error if no sandbox - it's likely being created
    if (!sandboxData) {
      console.log('[checkAndInstallPackages] No sandbox data available yet');
      return;
    }
    
    // Vite error checking removed - handled by template setup
    addChatMessage('Comprobando paquetes... El sandbox está listo con la configuración de Vite.', 'system');
  };
  
  const handleSurfaceError = (_errors: any[]) => {
    // Function kept for compatibility but Vite errors are now handled by template
    
    // Focus the input
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
    }
  };
  
  const installPackages = async (packages: string[]) => {
    if (!sandboxData) {
      addChatMessage('No hay sandbox activo. ¡Crea un sandbox primero!', 'system');
      return;
    }
    
    try {
      const response = await fetch('/api/install-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to install packages: ${response.statusText}`);
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'command':
                  // Don't show npm install commands - they're handled by info messages
                  if (!data.command.includes('npm install')) {
                    addChatMessage(data.command, 'command', { commandType: 'input' });
                  }
                  break;
                case 'output':
                  addChatMessage(data.message, 'command', { commandType: 'output' });
                  break;
                case 'error':
                  if (data.message && data.message !== 'undefined') {
                    addChatMessage(data.message, 'command', { commandType: 'error' });
                  }
                  break;
                case 'warning':
                  addChatMessage(data.message, 'command', { commandType: 'output' });
                  break;
                case 'success':
                  addChatMessage(`${data.message}`, 'system');
                  break;
                case 'status':
                  addChatMessage(data.message, 'system');
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error: any) {
      addChatMessage(`No se pudieron instalar los paquetes: ${error.message}`, 'system');
    }
  };

  const checkSandboxStatus = async () => {
    try {
      const response = await fetch('/api/sandbox-status');
      const data = await response.json();
      
      if (data.active && data.healthy && data.sandboxData) {
        console.log('[checkSandboxStatus] Setting sandboxData from API:', data.sandboxData);
        setSandboxData(data.sandboxData);
        updateStatus('Sandbox activo', true);
      } else if (data.active && !data.healthy) {
        // Sandbox exists but not responding
        updateStatus('Sandbox sin respuesta', false);
        // Keep existing sandboxData if we have it - don't clear it
      } else {
        // Only clear sandboxData if we don't already have it or if we're explicitly checking from a fresh state
        // This prevents clearing sandboxData during normal operation when it should persist
        if (!sandboxData) {
          console.log('[checkSandboxStatus] No existing sandboxData, clearing state');
          setSandboxData(null);
          updateStatus('Sin sandbox', false);
        } else {
          // Keep existing sandboxData and just update status
          console.log('[checkSandboxStatus] Keeping existing sandboxData, sandbox inactive but data preserved');
          updateStatus('Estado del sandbox desconocido', false);
        }
      }
    } catch (error) {
      console.error('Failed to check sandbox status:', error);
      // Only clear on error if we don't have existing sandboxData
      if (!sandboxData) {
        setSandboxData(null);
        updateStatus('Error', false);
      } else {
        updateStatus('Fallo al comprobar estado', false);
      }
    }
  };

  const sandboxCreationRef = useRef<boolean>(false);
  
  const createSandbox = async (fromHomeScreen = false) => {
    // Prevent duplicate sandbox creation
    if (sandboxCreationRef.current) {
      console.log('[createSandbox] Sandbox creation already in progress, skipping...');
      return null;
    }
    
    sandboxCreationRef.current = true;
    console.log('[createSandbox] Starting sandbox creation...');
    setLoading(true);
    setShowLoadingBackground(true);
    updateStatus('Creando sandbox...', false);
    setResponseArea([]);
    setScreenshotError(null);
    
    try {
      const response = await fetch('/api/create-ai-sandbox-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      console.log('[createSandbox] Response data:', data);
      
      if (data.success) {
        sandboxCreationRef.current = false; // Reset the ref on success
        console.log('[createSandbox] Setting sandboxData from creation:', data);
        sandboxDataRef.current = data;
        setSandboxData(data);
        updateStatus('Sandbox activo', true);
        log('Sandbox created successfully!');
        log(`Sandbox ID: ${data.sandboxId}`);
        log(`URL: ${data.url}`);
        
        // Update URL with sandbox ID
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('sandbox', data.sandboxId);
        newParams.set('model', aiModel);
        router.push(`/generation?${newParams.toString()}`, { scroll: false });
        
        // Fade out loading background after sandbox loads
        setTimeout(() => {
          setShowLoadingBackground(false);
        }, 3000);
        
        if (data.structure) {
          displayStructure(data.structure);
        }
        
        // Fetch sandbox files after creation
        setTimeout(fetchSandboxFiles, 1000);
        
        // For Vercel sandboxes, Vite is already started during setupViteApp
        // No need to restart it immediately after creation
        // Only restart if there's an actual issue later
        console.log('[createSandbox] Sandbox ready with Vite server running');
        
        // Only add welcome message if not coming from home screen
        if (!fromHomeScreen) {
          addChatMessage(`¡Sandbox creado! ID: ${data.sandboxId}. Ya tengo el contexto de tu sandbox y puedo ayudarte a construir la app. Pídeme componentes y los aplicaré automáticamente.

Consejo: detecto e instalo automáticamente los paquetes npm de tus imports (react-router-dom, axios, etc.).`, 'system');
        }
        
        setTimeout(() => {
          if (iframeRef.current) {
            iframeRef.current.src = data.url;
          }
        }, 100);
        
        // Return the sandbox data so it can be used immediately
        return data;
      } else {
        throw new Error(data.error || 'Error desconocido al crear el sandbox');
      }
    } catch (error: any) {
      console.error('[createSandbox] Error:', error);
      updateStatus('Error', false);
      log(`No se pudo crear el sandbox: ${error.message}`, 'error');
      addChatMessage(`No se pudo crear el sandbox: ${error.message}`, 'system');
      setScreenshotError(error.message);
      throw error;
    } finally {
      setLoading(false);
      sandboxCreationRef.current = false; // Reset the ref
    }
  };

  const displayStructure = (structure: any) => {
    if (typeof structure === 'object') {
      setStructureContent(JSON.stringify(structure, null, 2));
    } else {
      setStructureContent(structure || 'No structure available');
    }
  };

  const schedulePreviewRefresh = (sandboxUrl?: string, packagesInstalled = false) => {
    const url = sandboxUrl || sandboxDataRef.current?.url || sandboxData?.url;
    if (!url) {
      console.warn('[applyGeneratedCode] Preview refresh skipped: sandbox URL not ready yet');
      return;
    }

    setActiveTab('preview');
    // Tras instalar paquetes + reinicio de Vite necesitamos más margen
    const delay = packagesInstalled
      ? Math.max(appConfig.codeApplication.packageInstallRefreshDelay, 6000)
      : Math.max(appConfig.codeApplication.defaultRefreshDelay, 2500);

    const bust = () => {
      const next = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}&applied=1`;
      setPreviewSrc(next);
      if (iframeRef.current) {
        iframeRef.current.src = next;
      }
    };

    // Primera recarga tras el delay; segunda por si Vite aún arrancaba
    setTimeout(bust, delay);
    setTimeout(bust, delay + 2500);
  };

  const applyGeneratedCode = async (code: string, isEdit: boolean = false, overrideSandboxData?: SandboxData) => {
    setLoading(true);
    log('Applying AI-generated code...');
    
    try {
      // Show progress component instead of individual messages
      setCodeApplicationState({ stage: 'analyzing' });
      
      // Get pending packages from tool calls
      const pendingPackages = ((window as any).pendingPackages || []).filter((pkg: any) => pkg && typeof pkg === 'string');
      if (pendingPackages.length > 0) {
        console.log('[applyGeneratedCode] Sending packages from tool calls:', pendingPackages);
        // Clear pending packages after use
        (window as any).pendingPackages = [];
      }
      
      // Use streaming endpoint for real-time feedback
      const effectiveSandboxData = overrideSandboxData || sandboxData || sandboxDataRef.current;
      const response = await fetch('/api/apply-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          response: code,
          isEdit: isEdit,
          packages: pendingPackages,
          sandboxId: effectiveSandboxData?.sandboxId, // Pass the sandbox ID to ensure proper connection
          disableMorph: pendingLogoApplyRef.current.disableMorph,
          logoSwap: pendingLogoApplyRef.current.logoSwap,
          uploadedImages: pendingLogoApplyRef.current.uploadedImages,
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to apply code: ${response.statusText}`);
      }
      
      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalData: any = null;
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'start':
                  // Don't add as chat message, just update state
                  setCodeApplicationState({ stage: 'analyzing' });
                  break;
                  
                case 'step':
                  // Update progress state based on step
                  if (data.message.includes('Installing') && data.packages) {
                    setCodeApplicationState({ 
                      stage: 'installing', 
                      packages: data.packages 
                    });
                  } else if (
                    data.message.includes('Creating files') ||
                    data.message.includes('Creating ') ||
                    data.message.includes('Applying')
                  ) {
                    setCodeApplicationState({ 
                      stage: 'applying',
                      filesGenerated: []
                    });
                  }
                  break;
                  
                case 'package-progress':
                  // Handle package installation progress
                  if (data.installedPackages) {
                    setCodeApplicationState(prev => ({ 
                      ...prev,
                      installedPackages: data.installedPackages 
                    }));
                  }
                  break;
                  
                case 'command':
                  // Don't show npm install commands - they're handled by info messages
                  if (data.command && !data.command.includes('npm install')) {
                    addChatMessage(data.command, 'command', { commandType: 'input' });
                  }
                  break;
                  
                case 'success':
                  if (data.installedPackages) {
                    setCodeApplicationState(prev => ({ 
                      ...prev,
                      installedPackages: data.installedPackages 
                    }));
                  }
                  break;
                  
                case 'file-progress':
                  // Skip file progress messages, they're noisy
                  break;
                  
                case 'file-complete':
                  // Could add individual file completion messages if desired
                  break;
                  
                case 'command-progress':
                  addChatMessage(`${data.action} command: ${data.command}`, 'command', { commandType: 'input' });
                  break;
                  
                case 'command-output':
                  addChatMessage(data.output, 'command', { 
                    commandType: data.stream === 'stderr' ? 'error' : 'output' 
                  });
                  break;
                  
                case 'command-complete':
                  if (data.success) {
                    addChatMessage(`Comando completado correctamente`, 'system');
                  } else {
                    addChatMessage(`El comando falló con código de salida ${data.exitCode}`, 'system');
                  }
                  break;
                  
                case 'complete':
                  finalData = data;
                  setCodeApplicationState({ stage: 'complete' });
                  // Clear the state after a delay
                  setTimeout(() => {
                    setCodeApplicationState({ stage: null });
                  }, 3000);
                  // Reset loading state when complete
                  setLoading(false);
                  break;
                  
                case 'error':
                  addChatMessage(`Error: ${data.message || data.error || 'Error desconocido'}`, 'system');
                  // Reset loading state on error
                  setLoading(false);
                  break;
                  
                case 'warning':
                  addChatMessage(`${data.message}`, 'system');
                  break;
                  
                case 'info':
                  // Show info messages, especially for package installation
                  if (data.message) {
                    addChatMessage(data.message, 'system');
                  }
                  break;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
      
      // Process final data
      if (finalData && finalData.type === 'complete') {
        const data: any = {
          success: true,
          results: finalData.results,
          explanation: finalData.explanation,
          structure: finalData.structure,
          message: finalData.message,
          autoCompleted: finalData.autoCompleted,
          autoCompletedComponents: finalData.autoCompletedComponents,
          warning: finalData.warning,
          missingImports: finalData.missingImports,
          debug: finalData.debug
        };
        
        if (data.success) {
          const { results } = data;
        
        // Log package installation results without duplicate messages
        if (results.packagesInstalled?.length > 0) {
          log(`Packages installed: ${results.packagesInstalled.join(', ')}`);
        }
        
        if (results.filesCreated?.length > 0) {
          log('Files created:');
          results.filesCreated.forEach((file: string) => {
            log(`  ${file}`, 'command');
          });
          
          // Verify files were actually created by refreshing the sandbox if needed
          if (sandboxData?.sandboxId && results.filesCreated.length > 0) {
            // Small delay to ensure files are written
            setTimeout(() => {
              // Force refresh the iframe to show new files
              if (iframeRef.current) {
                iframeRef.current.src = iframeRef.current.src;
              }
            }, 1000);
          }
        }
        
        if (results.filesUpdated?.length > 0) {
          log('Files updated:');
          results.filesUpdated.forEach((file: string) => {
            log(`  ${file}`, 'command');
          });
        }
        
        // Update conversation context with applied code
        setConversationContext(prev => ({
          ...prev,
          appliedCode: [...prev.appliedCode, {
            files: [...(results.filesCreated || []), ...(results.filesUpdated || [])],
            timestamp: new Date()
          }]
        }));
        
        if (results.commandsExecuted?.length > 0) {
          log('Commands executed:');
          results.commandsExecuted.forEach((cmd: string) => {
            log(`  $ ${cmd}`, 'command');
          });
        }
        
        if (results.errors?.length > 0) {
          results.errors.forEach((err: string) => {
            log(err, 'error');
          });
        }
        
        if (data.structure) {
          displayStructure(data.structure);
        }
        
        if (data.explanation) {
          log(data.explanation);
        }
        
        if (data.autoCompleted) {
          log('Auto-generating missing components...', 'command');
          
          if (data.autoCompletedComponents) {
            setTimeout(() => {
              log('Auto-generated missing components:', 'info');
              data.autoCompletedComponents.forEach((comp: string) => {
                log(`  ${comp}`, 'command');
              });
            }, 1000);
          }
        } else if (data.warning) {
          log(data.warning, 'error');
          
          if (data.missingImports && data.missingImports.length > 0) {
            const missingList = data.missingImports.join(', ');
            addChatMessage(
              `Pídeme «crear los componentes que faltan: ${missingList}» para corregir estos errores de import.`,
              'system'
            );
          }
        }
        
        log('Code applied successfully!');
        console.log('[applyGeneratedCode] Response data:', data);
        console.log('[applyGeneratedCode] Debug info:', data.debug);
        console.log('[applyGeneratedCode] Current sandboxData:', sandboxData);
        console.log('[applyGeneratedCode] Current iframe element:', iframeRef.current);
        console.log('[applyGeneratedCode] Current iframe src:', iframeRef.current?.src);
        
        // Set applying code state for edits to show loading overlay
        // Removed overlay - changes apply directly
        
        if (results.filesCreated?.length > 0) {
          setConversationContext(prev => ({
            ...prev,
            appliedCode: [...prev.appliedCode, {
              files: results.filesCreated,
              timestamp: new Date()
            }]
          }));
          
          // Update the chat message to show success
          // Only show file list if not in edit mode
          if (isEdit) {
            addChatMessage(`¡Edición aplicada correctamente!`, 'system');
          } else {
            // Check if this is part of a generation flow (has recent AI recreation message)
            const recentMessages = chatMessages.slice(-5);
            const isPartOfGeneration = recentMessages.some(m => 
              m.content.includes('AI recreation generated') || 
              m.content.includes('Code generated') ||
              m.content.includes('Recreación de la IA') ||
              m.content.includes('Código generado')
            );
            
            // Don't show files if part of generation flow to avoid duplication
            if (isPartOfGeneration) {
              addChatMessage(`¡${results.filesCreated.length} archivo${results.filesCreated.length === 1 ? '' : 's'} aplicado${results.filesCreated.length === 1 ? '' : 's'} correctamente!`, 'system');
            } else {
              addChatMessage(`¡${results.filesCreated.length} archivo${results.filesCreated.length === 1 ? '' : 's'} aplicado${results.filesCreated.length === 1 ? '' : 's'} correctamente!`, 'system', {
                appliedFiles: results.filesCreated
              });
            }
          }
          
          // If there are failed packages, add a message about checking for errors
          if (results.packagesFailed?.length > 0) {
            addChatMessage(`⚠️ Algunos paquetes no se pudieron instalar. Revisa el aviso de error de arriba.`, 'system');
          }
          
          // Fetch updated file structure
          await fetchSandboxFiles();
          
          // Skip automatic package check - it's not needed here and can cause false "no sandbox" messages
          // Packages are already installed during the apply-ai-code-stream process
          
          // Test build to ensure everything compiles correctly
          // Skip build test for now - it's causing errors with undefined activeSandbox
          // The build test was trying to access global.activeSandbox from the frontend,
          // but that's only available in the backend API routes
          console.log('[build-test] Skipping build test - would need API endpoint');
        }

        // Siempre esperamos un poco más: tras aplicar se reinicia Vite (HMR off)
        schedulePreviewRefresh(effectiveSandboxData?.url, true);
        
        } else {
          throw new Error(finalData?.error || 'No se pudo aplicar el código');
        }
      } else {
        // If no final data was received, still close loading
        addChatMessage('La aplicación del código pudo ser parcial. Revisa la vista previa.', 'system');
      }
    } catch (error: any) {
      log(`Failed to apply code: ${error.message}`, 'error');
      setCodeApplicationState({ stage: null });
    } finally {
      setLoading(false);
      // Clear isEdit flag after applying code
      setGenerationProgress(prev => ({
        ...prev,
        isEdit: false
      }));
      // Asegurar que el overlay blanco no se quede pegado
      setTimeout(() => {
        setCodeApplicationState({ stage: null });
      }, 3500);
    }
  };

  const fetchSandboxFiles = async () => {
    if (!sandboxData) return;
    
    try {
      const response = await fetch('/api/get-sandbox-files', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSandboxFiles(data.files || {});
          setFileStructure(data.structure || '');
          console.log('[fetchSandboxFiles] Updated file list:', Object.keys(data.files || {}).length, 'files');
        }
      }
    } catch (error) {
      console.error('[fetchSandboxFiles] Error fetching files:', error);
    }
  };
  
//   const restartViteServer = async () => {
//     try {
//       addChatMessage('Restarting Vite dev server...', 'system');
//       
//       const response = await fetch('/api/restart-vite', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' }
//       });
//       
//       if (response.ok) {
//         const data = await response.json();
//         if (data.success) {
//           addChatMessage('✓ Vite dev server restarted successfully!', 'system');
//           
//           // Refresh the iframe after a short delay
//           setTimeout(() => {
//             if (iframeRef.current && sandboxData?.url) {
//               iframeRef.current.src = `${sandboxData.url}?t=${Date.now()}`;
//             }
//           }, 2000);
//         } else {
//           addChatMessage(`Failed to restart Vite: ${data.error}`, 'error');
//         }
//       } else {
//         addChatMessage('Failed to restart Vite server', 'error');
//       }
//     } catch (error) {
//       console.error('[restartViteServer] Error:', error);
//       addChatMessage(`Error restarting Vite: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
//     }
//   };

//   const applyCode = async () => {
//     const code = promptInput.trim();
//     if (!code) {
//       log('Please enter some code first', 'error');
//       addChatMessage('No code to apply. Please generate code first.', 'system');
//       return;
//     }
//     
//     // Prevent double clicks
//     if (loading) {
//       console.log('[applyCode] Already loading, skipping...');
//       return;
//     }
//     
//     // Determine if this is an edit based on whether we have applied code before
//     const isEdit = conversationContext.appliedCode.length > 0;
//     await applyGeneratedCode(code, isEdit);
//   };

  const renderMainContent = () => {
    if (activeTab === 'generation' && (generationProgress.isGenerating || generationProgress.files.length > 0 || selectedFile)) {
      const activeCodePath =
        selectedFile ||
        generationProgress.currentFile?.path ||
        generationProgress.files[0]?.path ||
        null;
      const isLiveFile =
        Boolean(generationProgress.currentFile) &&
        generationProgress.currentFile?.path === activeCodePath;
      const activeContent = activeCodePath
        ? isLiveFile && generationProgress.currentFile
          ? generationProgress.currentFile.content
          : resolveFileContent(activeCodePath)
        : '';
      const activeExt = activeCodePath?.split('.').pop()?.toLowerCase();
      const activeLanguage =
        activeExt === 'css' || activeExt === 'scss' ? 'css' :
        activeExt === 'json' ? 'json' :
        activeExt === 'html' ? 'html' :
        activeExt === 'ts' || activeExt === 'tsx' ? 'tsx' :
        'jsx';

      return (
        <div className="mx-code-ide absolute inset-0 flex overflow-hidden">
          {/* Explorador */}
          {!generationProgress.isEdit && (
            <aside className="mx-code-ide__sidebar">
              <div className="mx-code-ide__sidebar-head">
                <BsFolderFill style={{ width: 14, height: 14 }} />
                <span>Explorador</span>
                {generationProgress.files.length > 0 && (
                  <span className="mx-code-ide__count">{generationProgress.files.length}</span>
                )}
              </div>
              <div className="mx-code-ide__tree scrollbar-hide">
                <button
                  type="button"
                  className="mx-code-ide__folder"
                  onClick={() => toggleFolder('app')}
                >
                  {expandedFolders.has('app') ? (
                    <FiChevronDown style={{ width: 14, height: 14 }} />
                  ) : (
                    <FiChevronRight style={{ width: 14, height: 14 }} />
                  )}
                  {expandedFolders.has('app') ? (
                    <BsFolder2Open style={{ width: 14, height: 14 }} className="text-[var(--mx-menu)]" />
                  ) : (
                    <BsFolderFill style={{ width: 14, height: 14 }} className="text-[var(--mx-menu)]" />
                  )}
                  <span>app</span>
                </button>

                {expandedFolders.has('app') && (
                  <div className="mx-code-ide__tree-nested">
                    {(() => {
                      const fileTree: { [key: string]: Array<{ name: string; edited?: boolean; path: string }> } = {};
                      generationProgress.files.forEach(file => {
                        const parts = file.path.split('/');
                        const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
                        const fileName = parts[parts.length - 1];
                        if (!fileTree[dir]) fileTree[dir] = [];
                        fileTree[dir].push({
                          name: fileName,
                          edited: file.edited || false,
                          path: file.path,
                        });
                      });

                      // Archivo en curso que aún no está en la lista
                      if (
                        generationProgress.currentFile &&
                        !generationProgress.files.some(f => f.path === generationProgress.currentFile?.path)
                      ) {
                        const path = generationProgress.currentFile.path;
                        const parts = path.split('/');
                        const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
                        const fileName = parts[parts.length - 1];
                        if (!fileTree[dir]) fileTree[dir] = [];
                        if (!fileTree[dir].some(f => f.path === path)) {
                          fileTree[dir].push({ name: fileName, path });
                        }
                      }

                      return Object.entries(fileTree).map(([dir, files]) => (
                        <div key={dir || 'root'} className="mx-code-ide__dir">
                          {dir ? (
                            <button
                              type="button"
                              className="mx-code-ide__folder"
                              onClick={() => toggleFolder(dir)}
                            >
                              {expandedFolders.has(dir) ? (
                                <FiChevronDown style={{ width: 14, height: 14 }} />
                              ) : (
                                <FiChevronRight style={{ width: 14, height: 14 }} />
                              )}
                              {expandedFolders.has(dir) ? (
                                <BsFolder2Open style={{ width: 14, height: 14 }} className="text-amber-500" />
                              ) : (
                                <BsFolderFill style={{ width: 14, height: 14 }} className="text-amber-500" />
                              )}
                              <span>{dir.split('/').pop()}</span>
                            </button>
                          ) : null}
                          {(!dir || expandedFolders.has(dir)) && (
                            <div className={dir ? 'mx-code-ide__tree-nested' : undefined}>
                              {files
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(fileInfo => {
                                  const isSelected = activeCodePath === fileInfo.path;
                                  const isWriting =
                                    generationProgress.currentFile?.path === fileInfo.path &&
                                    generationProgress.isGenerating;
                                  return (
                                    <button
                                      type="button"
                                      key={fileInfo.path}
                                      className={`mx-code-ide__file${isSelected ? ' is-selected' : ''}${isWriting ? ' is-writing' : ''}`}
                                      onClick={() => handleFileClick(fileInfo.path)}
                                    >
                                      {getFileIcon(fileInfo.name)}
                                      <span className="mx-code-ide__file-name">{fileInfo.name}</span>
                                      {isWriting ? (
                                        <span className="mx-code-ide__file-spinner" aria-hidden />
                                      ) : fileInfo.edited ? (
                                        <span className="mx-code-ide__file-dot" title="Editado" />
                                      ) : null}
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* Editor único */}
          <div className="mx-code-ide__editor">
            {generationProgress.isGenerating && (generationProgress.isThinking || generationProgress.thinkingText) && (
              <div className="mx-code-ide__thinking">
                <div className="mx-code-ide__thinking-label">
                  {generationProgress.isThinking ? (
                    <>
                      <span className="mx-code-ide__thinking-dot" />
                      La IA está pensando…
                    </>
                  ) : (
                    <>Pensó {generationProgress.thinkingDuration || 0}s</>
                  )}
                </div>
                {generationProgress.thinkingText ? (
                  <pre className="mx-code-ide__thinking-text scrollbar-hide">
                    {generationProgress.thinkingText}
                  </pre>
                ) : null}
              </div>
            )}

            {activeCodePath ? (
              <>
                <div className="mx-code-ide__tabbar">
                  <div className="mx-code-ide__tab is-active">
                    {getFileIcon(activeCodePath)}
                    <span>{activeCodePath.split('/').pop()}</span>
                    {isLiveFile ? <span className="mx-code-ide__live">escribiendo</span> : null}
                    {selectedFile ? (
                      <button
                        type="button"
                        className="mx-code-ide__tab-close"
                        onClick={() => setSelectedFile(null)}
                        aria-label="Cerrar archivo"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  <span className="mx-code-ide__path">{activeCodePath}</span>
                </div>
                <div className="mx-code-ide__code scrollbar-hide" ref={codeDisplayRef}>
                  <SyntaxHighlighter
                    language={activeLanguage}
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: '1.1rem 1rem',
                      fontSize: '13px',
                      lineHeight: '1.55',
                      background: 'transparent',
                      minHeight: '100%',
                    }}
                    showLineNumbers
                    wrapLongLines
                  >
                    {activeContent || '// Esperando contenido…'}
                  </SyntaxHighlighter>
                  {isLiveFile ? <span className="mx-code-ide__caret" aria-hidden /> : null}
                </div>
              </>
            ) : generationProgress.isGenerating ? (
              <div className="mx-code-ide__empty">
                <div className="mx-code-ide__empty-spinner" />
                <p className="mx-code-ide__empty-title">Generando código…</p>
                <p className="mx-code-ide__empty-sub">
                  {generationProgress.status || 'Preparando archivos'}
                </p>
              </div>
            ) : (
              <div className="mx-code-ide__empty">
                <p className="mx-code-ide__empty-title">Selecciona un archivo</p>
                <p className="mx-code-ide__empty-sub">Elige uno del explorador para ver su código</p>
              </div>
            )}
          </div>
        </div>
      );
    } else if (activeTab === 'preview') {
      // Show loading state for initial generation or when starting a new generation with existing sandbox
      const isInitialGeneration = !sandboxData?.url && (urlScreenshot || isCapturingScreenshot || isPreparingDesign || loadingStage);
      const isNewGenerationWithSandbox = isStartingNewGeneration && sandboxData?.url;
      const shouldShowLoadingOverlay = (isInitialGeneration || isNewGenerationWithSandbox) && 
        (loading || generationProgress.isGenerating || isPreparingDesign || loadingStage || isCapturingScreenshot || isStartingNewGeneration);
      
      if (isInitialGeneration || isNewGenerationWithSandbox) {
        return (
          <div className="relative w-full h-full bg-gray-900">
            {/* Screenshot as background when available */}
            {urlScreenshot && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img 
                src={urlScreenshot} 
                alt="Vista previa del sitio" 
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                style={{ 
                  opacity: isScreenshotLoaded ? 1 : 0,
                  willChange: 'opacity'
                }}
                onLoad={() => setIsScreenshotLoaded(true)}
                loading="eager"
              />
            )}
            
            {/* Loading overlay - only show when actively processing initial generation */}
            {shouldShowLoadingOverlay && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
                {/* Loading animation with skeleton */}
                <div className="text-center max-w-md">
                  {/* Animated skeleton lines */}
                  <div className="mb-6 space-y-3">
                    <div className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse" 
                         style={{ animationDuration: '1.5s', animationDelay: '0s' }} />
                    <div className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse w-4/5 mx-auto" 
                         style={{ animationDuration: '1.5s', animationDelay: '0.2s' }} />
                    <div className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse w-3/5 mx-auto" 
                         style={{ animationDuration: '1.5s', animationDelay: '0.4s' }} />
                  </div>
                  
                  {/* Status text */}
                  <p className="text-white text-lg font-medium">
                    {isCapturingScreenshot ? 'Analizando el sitio...' :
                     isPreparingDesign ? 'Preparando el diseño...' :
                     generationProgress.isGenerating ? 'Generando código...' :
                     'Cargando...'}
                  </p>
                  
                  {/* Subtle progress hint */}
                  <p className="text-white/60 text-sm mt-2">
                    {isCapturingScreenshot ? 'Capturando una imagen del sitio' :
                     isPreparingDesign ? 'Entendiendo el layout y la estructura' :
                     generationProgress.isGenerating ? 'Escribiendo componentes React' :
                     'Espera un momento...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      }
      
      // Show sandbox iframe - keep showing during edits, only hide during initial loading
      if (sandboxData?.url) {
        const iframeSrc = previewSrc || sandboxData.url;
        return (
          <div className="absolute inset-0 bg-white">
            <iframe
              key={iframeSrc}
              ref={iframeRef}
              src={iframeSrc}
              className="absolute inset-0 w-full h-full border-0"
              title="Vista previa"
              allow="clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
            
            {/* Package installation overlay - shows when installing packages or applying code */}
            {codeApplicationState.stage && codeApplicationState.stage !== 'complete' && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="text-center max-w-md px-6">
                  <div className="mb-6">
                    <div className="w-12 h-12 mx-auto border-2 border-gray-300 border-t-[var(--mx-menu)] rounded-full animate-spin" />
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {codeApplicationState.stage === 'analyzing' && 'Analizando el código...'}
                    {codeApplicationState.stage === 'installing' && 'Instalando paquetes...'}
                    {codeApplicationState.stage === 'applying' && 'Aplicando cambios...'}
                  </h3>
                  
                  {/* Package list during installation */}
                  {codeApplicationState.stage === 'installing' && codeApplicationState.packages && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {codeApplicationState.packages.map((pkg, index) => (
                          <span 
                            key={index}
                            className={`px-2 py-1 text-xs rounded-full transition-all ${
                              codeApplicationState.installedPackages?.includes(pkg)
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {pkg}
                            {codeApplicationState.installedPackages?.includes(pkg) && (
                              <span className="ml-1">✓</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {codeApplicationState.stage === 'applying' && codeApplicationState.filesGenerated && (
                    <div className="text-sm text-gray-600">
                      Creando {codeApplicationState.filesGenerated.length} archivos...
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-500 mt-2">
                    {codeApplicationState.stage === 'analyzing' && 'Analizando el código generado y detectando dependencias...'}
                    {codeApplicationState.stage === 'installing' && 'Esto puede tardar un momento mientras npm instala los paquetes...'}
                    {codeApplicationState.stage === 'applying' && 'Escribiendo archivos en el sandbox...'}
                  </p>
                </div>
              </div>
            )}
            
            {generationProgress.isGenerating && generationProgress.isEdit && !codeApplicationState.stage && (
              <div className="absolute top-4 right-4 inline-flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg z-10">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-white text-xs font-medium">Generando código...</span>
              </div>
            )}
            
            <button
              onClick={() => {
                if (sandboxData?.url) {
                  const next = `${sandboxData.url}${sandboxData.url.includes('?') ? '&' : '?'}t=${Date.now()}&manual=1`;
                  setPreviewSrc(next);
                }
              }}
              className="absolute bottom-4 right-4 z-10 bg-white/90 hover:bg-white text-gray-700 p-2 rounded-lg shadow-lg transition-all duration-200 hover:scale-105"
              title="Actualizar sandbox"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        );
      }
      
      // Default state when no sandbox and no screenshot
      return (
        <div className="flex items-center justify-center h-full bg-gray-50 text-gray-600 text-lg">
          {screenshotError ? (
            <div className="text-center">
              <p className="mb-2">No se pudo capturar la captura de pantalla</p>
              <p className="text-sm text-gray-500">{screenshotError}</p>
            </div>
          ) : sandboxData ? (
            <div className="text-gray-500">
              <div className="w-16 h-16 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">Cargando vista previa...</p>
            </div>
          ) : (
            <div className="text-gray-500 text-center">
              <p className="text-sm">Empieza a chatear para crear tu primera app</p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const sendChatMessage = async () => {
    const images = [...chatImages];
    const message = aiChatInput.trim() || (images.length ? 'Actualiza la app usando las imágenes de referencia adjuntas.' : '');
    if (!message) return;
    
    if (!aiEnabled) {
      addChatMessage('La IA está desactivada. Actívala primero.', 'system');
      return;
    }
    
    addChatMessage(message, 'user', images.length ? { images } : undefined);
    setAiChatInput('');
    setChatImages([]);
    pendingLogoApplyRef.current = {
      disableMorph:
        images.length > 0 ||
        /https?:\/\/[^\s]+/i.test(message),
      logoSwap: isLogoSwapRequest(message),
      uploadedImages: [],
    };
    
    // Check for special commands
    const lowerMessage = message.toLowerCase().trim();
    if (lowerMessage === 'check packages' || lowerMessage === 'install packages' || lowerMessage === 'npm install') {
      if (!sandboxData) {
        // More helpful message - user might be trying to run this too early
        addChatMessage('El sandbox aún se está preparando. Espera a que termine la generación e inténtalo de nuevo.', 'system');
        return;
      }
      await checkAndInstallPackages();
      return;
    }
    
    // Start sandbox creation in parallel if needed
    let sandboxPromise: Promise<void> | null = null;
    let sandboxCreating = false;
    
    if (!sandboxData) {
      sandboxCreating = true;
      addChatMessage('Creando el sandbox mientras planifico tu app...', 'system');
      sandboxPromise = createSandbox(true).catch((error: any) => {
        addChatMessage(`No se pudo crear el sandbox: ${error.message}`, 'system');
        throw error;
      });
    }
    
    // Determine if this is an edit
    const isEdit = conversationContext.appliedCode.length > 0;
    
    try {
      // Generation tab is already active from scraping phase
      setGenerationProgress(prev => ({
        ...prev,  // Preserve all existing state
        isGenerating: true,
        status: 'Iniciando generación con IA...',
        components: [],
        currentComponent: 0,
        streamedCode: '',
        isStreaming: false,
        isThinking: true,
        thinkingText: 'Analizando tu petición...',
        thinkingDuration: undefined,
        currentFile: undefined,
        lastProcessedPosition: 0,
        // Add isEdit flag to generation progress
        isEdit: isEdit,
        // Keep existing files for edits - we'll mark edited ones differently
        files: prev.files
      }));
      
      // Backend now manages file state - no need to fetch from frontend
      console.log('[chat] Using backend file cache for context');
      
      const fullContext = {
        sandboxId: sandboxData?.sandboxId || (sandboxCreating ? 'pending' : null),
        structure: structureContent,
        recentMessages: chatMessages.slice(-20),
        conversationContext: conversationContext,
        currentCode: promptInput,
        sandboxUrl: sandboxData?.url,
        sandboxCreating: sandboxCreating
      };
      
      // Debug what we're sending
      console.log('[chat] Sending context to AI:');
      console.log('[chat] - sandboxId:', fullContext.sandboxId);
      console.log('[chat] - isEdit:', conversationContext.appliedCode.length > 0);
    console.log('[chat] - images:', images.length);
      
      const response = await fetch('/api/generate-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: message,
          model: appConfig.ui.showModelSelector ? aiModel : appConfig.ai.lockedModel,
          context: fullContext,
          isEdit: conversationContext.appliedCode.length > 0,
          images
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let generatedCode = '';
      let explanation = '';
      let buffer = ''; // Buffer for incomplete lines
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          console.log('[chat] Received chunk:', chunk.length, 'bytes');
          buffer += chunk;
          const lines = buffer.split('\n');
          
          // Keep the last line in buffer if it's incomplete
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'status') {
                  setGenerationProgress(prev => ({ ...prev, status: toSpanishGenerationStatus(data.message) }));
                } else if (data.type === 'thinking') {
                  setGenerationProgress(prev => ({ 
                    ...prev, 
                    isThinking: true,
                    thinkingText: (prev.thinkingText || '') + data.text
                  }));
                } else if (data.type === 'thinking_complete') {
                  setGenerationProgress(prev => ({ 
                    ...prev, 
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === 'conversation') {
                  // Add conversational text to chat only if it's not code
                  let text = data.text || '';
                  
                  // Remove package tags from the text
                  text = text.replace(/<package>[^<]*<\/package>/g, '');
                  text = text.replace(/<packages>[^<]*<\/packages>/g, '');
                  
                  // Filter out any XML tags and file content that slipped through
                  if (!text.includes('<file') && !text.includes('import React') && 
                      !text.includes('export default') && !text.includes('className=') &&
                      text.trim().length > 0) {
                    addChatMessage(text.trim(), 'ai');
                  }
                } else if (data.type === 'stream' && data.raw) {
                  setGenerationProgress(prev => {
                    const newStreamedCode = prev.streamedCode + data.text;
                    
                    // Tab is already switched after scraping
                    
                    const updatedState = { 
                      ...prev, 
                      streamedCode: newStreamedCode,
                      isStreaming: true,
                      isThinking: false,
                      status: 'Generando código...'
                    };
                    
                    // Process complete files from the accumulated stream
                    const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                    let match;
                    const processedFiles = new Set(prev.files.map(f => f.path));
                    
                    while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                      const filePath = match[1];
                      const fileContent = match[2];
                      
                      // Only add if we haven't processed this file yet
                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                                        fileExt === 'css' ? 'css' :
                                        fileExt === 'json' ? 'json' :
                                        fileExt === 'html' ? 'html' : 'text';
                        
                        // Check if file already exists
                        const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);
                        
                        if (existingFileIndex >= 0) {
                          // Update existing file and mark as edited
                          updatedState.files = [
                            ...updatedState.files.slice(0, existingFileIndex),
                            {
                              ...updatedState.files[existingFileIndex],
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: true
                            },
                            ...updatedState.files.slice(existingFileIndex + 1)
                          ];
                        } else {
                          // Add new file
                          updatedState.files = [...updatedState.files, {
                            path: filePath,
                            content: fileContent.trim(),
                            type: fileType,
                            completed: true,
                            edited: false
                          }];
                        }
                        
                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = toSpanishGenerationStatus(`Completed ${filePath}`);
                        }
                        processedFiles.add(filePath);
                      }
                    }
                    
                    // Check for current file being generated (incomplete file at the end)
                    const lastFileMatch = newStreamedCode.match(/<file path="([^"]+)">([^]*?)$/);
                    if (lastFileMatch && !lastFileMatch[0].includes('</file>')) {
                      const filePath = lastFileMatch[1];
                      const partialContent = lastFileMatch[2];
                      
                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                                        fileExt === 'css' ? 'css' :
                                        fileExt === 'json' ? 'json' :
                                        fileExt === 'html' ? 'html' : 'text';
                        
                        updatedState.currentFile = { 
                          path: filePath, 
                          content: partialContent, 
                          type: fileType 
                        };
                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = toSpanishGenerationStatus(`Generating ${filePath}`);
                        }
                      }
                    } else {
                      updatedState.currentFile = undefined;
                    }
                    
                    return updatedState;
                  });
                } else if (data.type === 'app') {
                  setGenerationProgress(prev => ({ 
                    ...prev, 
                    status: 'Estructura de App.jsx generada'
                  }));
                } else if (data.type === 'component') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: toSpanishGenerationStatus(`Generated ${data.name}`),
                    components: [...prev.components, { 
                      name: data.name, 
                      path: data.path, 
                      completed: true 
                    }],
                    currentComponent: data.index
                  }));
                } else if (data.type === 'package') {
                  // Handle package installation from tool calls
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: toSpanishGenerationStatus(data.message || `Installing ${data.name}`)
                  }));
                } else if (data.type === 'complete') {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;

                  pendingLogoApplyRef.current = {
                    disableMorph: Boolean(data.disableMorph) || pendingLogoApplyRef.current.disableMorph,
                    logoSwap: Boolean(data.logoSwap) || pendingLogoApplyRef.current.logoSwap,
                    uploadedImages: Array.isArray(data.uploadedImages)
                      ? data.uploadedImages
                      : pendingLogoApplyRef.current.uploadedImages,
                  };
                  
                  // Save the last generated code
                  setConversationContext(prev => ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));
                  
                  // Clear thinking state when generation completes
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingText: undefined,
                    thinkingDuration: undefined
                  }));
                  
                  // Store packages to install from tool calls
                  if (data.packagesToInstall && data.packagesToInstall.length > 0) {
                    console.log('[generate-code] Packages to install from tools:', data.packagesToInstall);
                    // Store packages globally for later installation
                    (window as any).pendingPackages = data.packagesToInstall;
                  }
                  
                  // Parse all files from the completed code if not already done
                  const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                  const parsedFiles: Array<{path: string; content: string; type: string; completed: boolean}> = [];
                  let fileMatch;
                  
                  while ((fileMatch = fileRegex.exec(data.generatedCode)) !== null) {
                    const filePath = fileMatch[1];
                    const fileContent = fileMatch[2];
                    const fileExt = filePath.split('.').pop() || '';
                    const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                                    fileExt === 'css' ? 'css' :
                                    fileExt === 'json' ? 'json' :
                                    fileExt === 'html' ? 'html' : 'text';
                    
                    parsedFiles.push({
                      path: filePath,
                      content: fileContent.trim(),
                      type: fileType,
                      completed: true
                    });
                  }
                  
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: toSpanishGenerationStatus(`Generated ${parsedFiles.length > 0 ? parsedFiles.length : prev.files.length} file${(parsedFiles.length > 0 ? parsedFiles.length : prev.files.length) !== 1 ? 's' : ''}!`),
                    isGenerating: false,
                    isStreaming: false,
                    isEdit: prev.isEdit,
                    // Keep the files that were already parsed during streaming
                    files: prev.files.length > 0 ? prev.files : parsedFiles
                  }));
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      }
      
      if (generatedCode) {
        // Parse files from generated code for metadata
        const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
        const generatedFiles = [];
        let match;
        while ((match = fileRegex.exec(generatedCode)) !== null) {
          generatedFiles.push(match[1]);
        }
        
        // Show appropriate message based on edit mode
        if (isEdit && generatedFiles.length > 0) {
          // For edits, show which file(s) were edited
          const editedFileNames = generatedFiles.map(f => f.split('/').pop()).join(', ');
          addChatMessage(
            explanation || `Updated ${editedFileNames}`,
            'ai',
            {
              appliedFiles: [generatedFiles[0]] // Only show the first edited file
            }
          );
        } else {
          // For new generation, show all files
          addChatMessage(explanation || '¡Código generado!', 'ai', {
            appliedFiles: generatedFiles
          });
        }
        
        setPromptInput(generatedCode);
        // Don't show the Generated Code panel by default
        // setLeftPanelVisible(true);
        
        // Wait for sandbox creation if it's still in progress
        let activeSandboxData = sandboxData;
        if (sandboxPromise) {
          addChatMessage('Esperando a que el sandbox esté listo...', 'system');
          try {
            const newSandboxData = await sandboxPromise;
            if (newSandboxData != null) {
              activeSandboxData = newSandboxData;
              // Also update the state for future use
              setSandboxData(newSandboxData);
            }
            // Remove the waiting message
            setChatMessages(prev => prev.filter(msg => msg.content !== 'Esperando a que el sandbox esté listo...'));
          } catch {
            addChatMessage('Falló la creación del sandbox. No se puede aplicar el código.', 'system');
            return;
          }
        }
        
        if (activeSandboxData && generatedCode) {
          // For new sandbox creations (especially Vercel), add a delay to ensure Vite is ready
          if (sandboxCreating) {
            console.log('[startGeneration] New sandbox created, waiting for services to be ready...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          // Use isEdit flag that was determined at the start
          // Pass the sandbox data from the promise if it's different from the state
          await applyGeneratedCode(generatedCode, isEdit, activeSandboxData !== sandboxData ? activeSandboxData : undefined);
        }
      }
      
      // Show completion status briefly then switch to preview
      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false,
        isStreaming: false,
        status: '¡Generación completada!',
        isEdit: prev.isEdit,
        // Clear thinking state on completion
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined
      }));
      
      setTimeout(() => {
        // Switch to preview but keep files for display
        setActiveTab('preview');
      }, 1000); // Reduced from 3000ms to 1000ms
    } catch (error: any) {
      setChatMessages(prev => prev.filter(msg => msg.content !== 'Thinking...'));
      addChatMessage(`Error: ${error.message}`, 'system');
      // Reset generation progress and switch back to preview on error
      setGenerationProgress({
        isGenerating: false,
        status: '',
        components: [],
        currentComponent: 0,
        streamedCode: '',
        isStreaming: false,
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined,
        files: [],
        currentFile: undefined,
        lastProcessedPosition: 0
      });
      setActiveTab('preview');
    }
  };


  const downloadZip = async () => {
    if (!sandboxData) {
      addChatMessage('Espera a que se cree el sandbox antes de descargar.', 'system');
      return;
    }
    
    setLoading(true);
    log('Creating zip file...');
    addChatMessage('Creando el ZIP de tu app Vite...', 'system');
    
    try {
      const response = await fetch('/api/create-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        log('Zip file created!');
        addChatMessage('¡ZIP creado! Empieza la descarga...', 'system');
        
        const link = document.createElement('a');
        link.href = data.dataUrl;
        link.download = data.fileName || 'e2b-project.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        addChatMessage(
          'Your Vite app has been downloaded! To run it locally:\n' +
          '1. Unzip the file\n' +
          '2. Run: npm install\n' +
          '3. Run: npm run dev\n' +
          '4. Open http://localhost:5173',
          'system'
        );
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      log(`Failed to create zip: ${error.message}`, 'error');
      addChatMessage(`No se pudo crear el ZIP: ${error.message}`, 'system');
    } finally {
      setLoading(false);
    }
  };

  const reapplyLastGeneration = async () => {
    if (!conversationContext.lastGeneratedCode) {
      addChatMessage('No hay una generación anterior para reaplicar', 'system');
      return;
    }
    
    if (!sandboxData) {
      addChatMessage('Crea un sandbox primero', 'system');
      return;
    }
    
    addChatMessage('Reaplicando la última generación...', 'system');
    const isEdit = conversationContext.appliedCode.length > 0;
    await applyGeneratedCode(conversationContext.lastGeneratedCode, isEdit);
  };

  // Auto-scroll code display to bottom when streaming
  useEffect(() => {
    if (codeDisplayRef.current && generationProgress.isStreaming) {
      codeDisplayRef.current.scrollTop = codeDisplayRef.current.scrollHeight;
    }
  }, [generationProgress.streamedCode, generationProgress.isStreaming]);

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileClick = async (filePath: string) => {
    setSelectedFile(filePath);
    setActiveTab('generation');

    // Expand parent folders so the explorer highlights the file
    const parts = filePath.split('/');
    if (parts.length > 1) {
      setExpandedFolders(prev => {
        const next = new Set(prev);
        next.add('app');
        let acc = '';
        for (let i = 0; i < parts.length - 1; i++) {
          acc = acc ? `${acc}/${parts[i]}` : parts[i];
          next.add(acc);
        }
        return next;
      });
    }
  };

  const resolveFileContent = (filePath: string): string => {
    const fromProgress = generationProgress.files.find(
      f => f.path === filePath || f.path.endsWith(`/${filePath}`) || filePath.endsWith(f.path)
    );
    if (fromProgress?.content) return fromProgress.content;

    if (generationProgress.currentFile?.path === filePath && generationProgress.currentFile.content) {
      return generationProgress.currentFile.content;
    }

    if (sandboxFiles[filePath]) return sandboxFiles[filePath];

    const sandboxEntry = Object.entries(sandboxFiles).find(
      ([key]) => key === filePath || key.endsWith(`/${filePath}`) || filePath.endsWith(key)
    );
    if (sandboxEntry?.[1]) return sandboxEntry[1];

    return '// Contenido del archivo no disponible todavía';
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (ext === 'jsx' || ext === 'js') {
      return <SiJavascript style={{ width: '16px', height: '16px' }} className="text-yellow-500" />;
    } else if (ext === 'tsx' || ext === 'ts') {
      return <SiReact style={{ width: '16px', height: '16px' }} className="text-blue-500" />;
    } else if (ext === 'css') {
      return <SiCss3 style={{ width: '16px', height: '16px' }} className="text-blue-500" />;
    } else if (ext === 'json') {
      return <SiJson style={{ width: '16px', height: '16px' }} className="text-gray-600" />;
    } else {
      return <FiFile style={{ width: '16px', height: '16px' }} className="text-gray-600" />;
    }
  };

//   const clearChatHistory = () => {
//     setChatMessages([{
//       content: 'Chat history cleared. How can I help you?',
//       type: 'system',
//       timestamp: new Date()
//     }]);
//   };
// 

//   const cloneWebsite = async () => {
//     let url = urlInput.trim();
//     if (!url) {
//       setUrlStatus(prev => [...prev, 'Please enter a URL']);
//       return;
//     }
//     
//     if (!url.match(/^https?:\/\//i)) {
//       url = 'https://' + url;
//     }
//     
//     setUrlStatus([`Using: ${url}`, 'Starting to scrape...']);
//     
//     setUrlOverlayVisible(false);
//     
//     // Remove protocol for cleaner display
//     const cleanUrl = url.replace(/^https?:\/\//i, '');
//     addChatMessage(`Starting to clone ${cleanUrl}...`, 'system');
//     
//     // Capture screenshot immediately and switch to preview tab
//     captureUrlScreenshot(url);
//     
//     try {
//       addChatMessage('Scraping website content...', 'system');
//       const scrapeResponse = await fetch('/api/scrape-url-enhanced', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ url })
//       });
//       
//       if (!scrapeResponse.ok) {
//         throw new Error(`Scraping failed: ${scrapeResponse.status}`);
//       }
//       
//       const scrapeData = await scrapeResponse.json();
//       
//       if (!scrapeData.success) {
//         throw new Error(scrapeData.error || 'Failed to scrape website');
//       }
//       
//       addChatMessage(`Scraped ${scrapeData.content.length} characters from ${url}`, 'system');
//       
//       // Clear preparing design state and switch to generation tab
//       setIsPreparingDesign(false);
//       setActiveTab('generation');
//       
//       setConversationContext(prev => ({
//         ...prev,
//         scrapedWebsites: [...prev.scrapedWebsites, {
//           url,
//           content: scrapeData,
//           timestamp: new Date()
//         }],
//         currentProject: `Clone of ${url}`
//       }));
//       
//       // Start sandbox creation in parallel with code generation
//       let sandboxPromise: Promise<any> | null = null;
//       if (!sandboxData) {
//         addChatMessage('Creating sandbox while generating your React app...', 'system');
//         sandboxPromise = createSandbox(true);
//       }
//       
//       addChatMessage('Analyzing and generating React recreation...', 'system');
//       
//       const recreatePrompt = `I scraped this website and want you to recreate it as a modern React application.
// 
// URL: ${url}
// 
// SCRAPED CONTENT:
// ${scrapeData.content}
// 
// ${homeContextInput ? `ADDITIONAL CONTEXT/REQUIREMENTS FROM USER:
// ${homeContextInput}
// 
// Please incorporate these requirements into the design and implementation.` : ''}
// 
// REQUIREMENTS:
// 1. Create a COMPLETE React application with App.jsx as the main component
// 2. App.jsx MUST import and render all other components
// 3. Recreate the main sections and layout from the scraped content
// 4. ${homeContextInput ? `Apply the user's context/theme: "${homeContextInput}"` : `Use a modern dark theme with excellent contrast:
//    - Background: #0a0a0a
//    - Text: #ffffff
//    - Links: #60a5fa
//    - Accent: #3b82f6`}
// 5. Make it fully responsive
// 6. Include hover effects and smooth transitions
// 7. Create separate components for major sections (Header, Hero, Features, etc.)
// 8. Use semantic HTML5 elements
// 
// IMPORTANT CONSTRAINTS:
// - DO NOT use React Router or any routing libraries
// - Use regular <a> tags with href="#section" for navigation, NOT Link or NavLink components
// - This is a single-page application, no routing needed
// - ALWAYS create src/App.jsx that imports ALL components
// - Each component should be in src/components/
// - Use Tailwind CSS for ALL styling (no custom CSS files)
// - Make sure the app actually renders visible content
// - Create ALL components that you reference in imports
// 
// IMAGE HANDLING RULES:
// - When the scraped content includes images, USE THE ORIGINAL IMAGE URLS whenever appropriate
// - Keep existing images from the scraped site (logos, product images, hero images, icons, etc.)
// - Use the actual image URLs provided in the scraped content, not placeholders
// - Only use placeholder images or generic services when no real images are available
// - For company logos and brand images, ALWAYS use the original URLs to maintain brand identity
// - If scraped data contains image URLs, include them in your img tags
// - Example: If you see "https://example.com/logo.png" in the scraped content, use that exact URL
// 
// Focus on the key sections and content, making it clean and modern while preserving visual assets.`;
//       
//       setGenerationProgress(prev => ({
//         isGenerating: true,
//         status: 'Initializing AI...',
//         components: [],
//         currentComponent: 0,
//         streamedCode: '',
//         isStreaming: true,
//         isThinking: false,
//         thinkingText: undefined,
//         thinkingDuration: undefined,
//         // Keep previous files until new ones are generated
//         files: prev.files || [],
//         currentFile: undefined,
//         lastProcessedPosition: 0
//       }));
//       
//       // Switch to generation tab when starting
//       setActiveTab('generation');
//       
//       const aiResponse = await fetch('/api/generate-ai-code-stream', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           prompt: recreatePrompt,
//           model: aiModel,
//           context: {
//             sandboxId: sandboxData?.id,
//             structure: structureContent,
//             conversationContext: conversationContext
//           }
//         })
//       });
//       
//       if (!aiResponse.ok) {
//         throw new Error(`AI generation failed: ${aiResponse.status}`);
//       }
//       
//       const reader = aiResponse.body?.getReader();
//       const decoder = new TextDecoder();
//       let generatedCode = '';
//       let explanation = '';
//       
//       if (reader) {
//         while (true) {
//           const { done, value } = await reader.read();
//           if (done) break;
//           
//           const chunk = decoder.decode(value);
//           const lines = chunk.split('\n');
//           
//           for (const line of lines) {
//             if (line.startsWith('data: ')) {
//               try {
//                 const data = JSON.parse(line.slice(6));
//                 
//                 if (data.type === 'status') {
//                   setGenerationProgress(prev => ({ ...prev, status: data.message }));
//                 } else if (data.type === 'thinking') {
//                   setGenerationProgress(prev => ({ 
//                     ...prev, 
//                     isThinking: true,
//                     thinkingText: (prev.thinkingText || '') + data.text
//                   }));
//                 } else if (data.type === 'thinking_complete') {
//                   setGenerationProgress(prev => ({ 
//                     ...prev, 
//                     isThinking: false,
//                     thinkingDuration: data.duration
//                   }));
//                 } else if (data.type === 'conversation') {
//                   // Add conversational text to chat only if it's not code
//                   let text = data.text || '';
//                   
//                   // Remove package tags from the text
//                   text = text.replace(/<package>[^<]*<\/package>/g, '');
//                   text = text.replace(/<packages>[^<]*<\/packages>/g, '');
//                   
//                   // Filter out any XML tags and file content that slipped through
//                   if (!text.includes('<file') && !text.includes('import React') && 
//                       !text.includes('export default') && !text.includes('className=') &&
//                       text.trim().length > 0) {
//                     addChatMessage(text.trim(), 'ai');
//                   }
//                 } else if (data.type === 'stream' && data.raw) {
//                   setGenerationProgress(prev => ({ 
//                     ...prev, 
//                     streamedCode: prev.streamedCode + data.text,
//                     lastProcessedPosition: prev.lastProcessedPosition || 0
//                   }));
//                 } else if (data.type === 'component') {
//                   setGenerationProgress(prev => ({
//                     ...prev,
//                     status: toSpanishGenerationStatus(`Generated ${data.name}`),
//                     components: [...prev.components, { 
//                       name: data.name,
//                       path: data.path,
//                       completed: true
//                     }],
//                     currentComponent: prev.currentComponent + 1
//                   }));
//                 } else if (data.type === 'complete') {
//                   generatedCode = data.generatedCode;
//                   explanation = data.explanation;
//                   
//                   // Save the last generated code
//                   setConversationContext(prev => ({
//                     ...prev,
//                     lastGeneratedCode: generatedCode
//                   }));
//                 }
//               } catch (e) {
//                 console.error('Error parsing streaming data:', e);
//               }
//             }
//           }
//         }
//       }
//       
//       setGenerationProgress(prev => ({
//         ...prev,
//         isGenerating: false,
//         isStreaming: false,
//         status: '¡Generación completada!',
//         isEdit: prev.isEdit
//       }));
//       
//       if (generatedCode) {
//         addChatMessage('AI recreation generated!', 'system');
//         
//         // Add the explanation to chat if available
//         if (explanation && explanation.trim()) {
//           addChatMessage(explanation, 'ai');
//         }
//         
//         setPromptInput(generatedCode);
//         // Don't show the Generated Code panel by default
//         // setLeftPanelVisible(true);
//         
//         // Wait for sandbox creation if it's still in progress
//         let activeSandboxData = sandboxData;
//         if (sandboxPromise) {
//           addChatMessage('Esperando a que el sandbox esté listo...', 'system');
//           try {
//             const newSandboxData = await sandboxPromise;
//             if (newSandboxData) {
//               activeSandboxData = newSandboxData;
//             }
//             // Remove the waiting message
//             setChatMessages(prev => prev.filter(msg => msg.content !== 'Esperando a que el sandbox esté listo...'));
//           } catch (error: any) {
//             addChatMessage('Falló la creación del sandbox. No se puede aplicar el código.', 'system');
//             throw error;
//           }
//         }
//         
//         // Only apply code if we have sandbox data
//         if (activeSandboxData) {
//           // First application for cloned site should not be in edit mode
//           await applyGeneratedCode(generatedCode, false);
//         }
//         
//         addChatMessage(
//           `Successfully recreated ${url} as a modern React app${homeContextInput ? ` with your requested context: "${homeContextInput}"` : ''}! The scraped content is now in my context, so you can ask me to modify specific sections or add features based on the original site.`, 
//           'ai',
//           {
//             scrapedUrl: url,
//             scrapedContent: scrapeData,
//             generatedCode: generatedCode
//           }
//         );
//         
//         setUrlInput('');
//         setUrlStatus([]);
//         setHomeContextInput('');
//         
//         // Clear generation progress and all screenshot/design states
//         setGenerationProgress(prev => ({
//           ...prev,
//           isGenerating: false,
//           isStreaming: false,
//           status: '¡Generación completada!'
//         }));
//         
//         // Clear screenshot and preparing design states to prevent them from showing on next run
//         setUrlScreenshot(null);
//         setIsPreparingDesign(false);
//         setTargetUrl('');
//         setScreenshotError(null);
//         setLoadingStage(null); // Clear loading stage
//         setShowLoadingBackground(false); // Clear loading background
//         
//         setTimeout(() => {
//           // Switch back to preview tab but keep files
//           setActiveTab('preview');
//         }, 1000); // Show completion briefly then switch
//       } else {
//         throw new Error('No se pudo generar la recreación');
//       }
//       
//     } catch (error: any) {
//       addChatMessage(`Failed to clone website: ${error.message}`, 'system');
//       setUrlStatus([]);
//       setIsPreparingDesign(false);
//       // Clear all states on error
//       setUrlScreenshot(null);
//       setTargetUrl('');
//       setScreenshotError(null);
//       setLoadingStage(null);
//       setGenerationProgress(prev => ({
//         ...prev,
//         isGenerating: false,
//         isStreaming: false,
//         status: '',
//         // Keep files to display in sidebar
//         files: prev.files
//       }));
//       setActiveTab('preview');
//     }
//   };

  const captureUrlScreenshot = async (url: string) => {
    setIsCapturingScreenshot(true);
    setScreenshotError(null);
    try {
      const response = await fetch('/api/scrape-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const data = await response.json();
      if (data.success && data.screenshot) {
        setIsScreenshotLoaded(false); // Reset loaded state for new screenshot
        setUrlScreenshot(data.screenshot);
        // Set preparing design state
        setIsPreparingDesign(true);
        // Store the clean URL for display
        const cleanUrl = url.replace(/^https?:\/\//i, '');
        setTargetUrl(cleanUrl);
        // Switch to preview tab to show the screenshot
        if (activeTab !== 'preview') {
          setActiveTab('preview');
        }
      } else {
        setScreenshotError(data.error || 'No se pudo capturar la captura de pantalla');
      }
    } catch (error) {
      console.error('No se pudo capturar la captura de pantalla:', error);
      setScreenshotError('Network error while capturing screenshot');
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const handleHomeScreenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await startGeneration();
  };

  const startGeneration = async () => {
    if (!homeUrlInput.trim()) return;

    const isDirectPrompt = directPromptMode || sessionStorage.getItem('directPromptMode') === 'true';
    if (isDirectPrompt) {
      sessionStorage.removeItem('directPromptMode');
    }
    
    setHomeScreenFading(true);
    
    // Set immediate loading state for better UX
    setIsStartingNewGeneration(true);
    setLoadingStage(isDirectPrompt ? 'planning' : 'gathering');
    
    // Immediately switch to preview tab to show loading
    setActiveTab('preview');
    
    // Set loading background to ensure proper visual feedback
    setShowLoadingBackground(true);
    
    // Clear messages and immediately show the initial message
    setChatMessages([]);
    let displayUrl = homeUrlInput.trim();
    if (!isDirectPrompt && !displayUrl.match(/^https?:\/\//i)) {
      displayUrl = 'https://' + displayUrl;
    }
    // Remove protocol for cleaner display
    const cleanUrl = displayUrl.replace(/^https?:\/\//i, '');

    // Check if we're in brand extension mode
    const brandExtensionMode = sessionStorage.getItem('brandExtensionMode') === 'true';

    if (isDirectPrompt) {
      const attachedImages = initialPromptImagesRef.current;
      addChatMessage(homeUrlInput.trim() || 'Generar a partir de imágenes de referencia', 'user', attachedImages.length ? { images: attachedImages } : undefined);
      addChatMessage('Creando un sandbox y generando tu app a partir del prompt...', 'system');
    } else {
      addChatMessage(
        brandExtensionMode
          ? `Analizando la marca de ${cleanUrl}...`
          : `Empezando a clonar ${cleanUrl}...`,
        'system'
      );
    }
    
    // Start creating sandbox and capturing screenshot immediately in parallel
    const sandboxPromise = !sandboxData ? createSandbox(true) : Promise.resolve(null);
    
    // Set loading stage immediately before hiding home screen
    setLoadingStage(isDirectPrompt ? 'planning' : 'gathering');
    // Also ensure we're on preview tab to show the loading overlay
    setActiveTab('preview');
    
    if (!isDirectPrompt) {
      captureUrlScreenshot(displayUrl);
    }
    
    setTimeout(async () => {
      setShowHomeScreen(false);
      setHomeScreenFading(false);
      
      // Clear the starting flag after transition
      setTimeout(() => {
        setIsStartingNewGeneration(false);
      }, 1000);
      
      // Wait for sandbox to be ready (if it's still creating)
      const createdSandbox = await sandboxPromise;
      
      // Now start the clone process which will stream the generation
      setUrlInput(isDirectPrompt ? '' : homeUrlInput);
      setUrlOverlayVisible(false); // Make sure overlay is closed
      setUrlStatus(isDirectPrompt ? ['Planificando tu app...', 'Generando la app React...'] : ['Extrayendo el contenido del sitio...']);
      
      try {
        // Scrape the website
        let url = homeUrlInput.trim();
        if (!isDirectPrompt && !url.match(/^https?:\/\//i)) {
          url = 'https://' + url;
        }

        // Check if we're in brand extension mode
        const brandExtensionMode = sessionStorage.getItem('brandExtensionMode') === 'true';
        const brandExtensionPrompt = sessionStorage.getItem('brandExtensionPrompt') || '';

        // Screenshot is already being captured in parallel above

        let scrapeData: ScrapeData | undefined;
        let brandGuidelines: any;

        if (isDirectPrompt) {
          addChatMessage('Generando una app a partir de tu prompt...', 'system');
        } else if (brandExtensionMode) {
          // === BRAND EXTENSION MODE ===
          addChatMessage('Extrayendo estilos de marca del sitio...', 'system');

          // Call the brand extraction endpoint
          const extractResponse = await fetch('/api/extract-brand-styles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url,
              prompt: brandExtensionPrompt
            })
          });

          if (!extractResponse.ok) {
            throw new Error('No se pudieron extraer los estilos de marca');
          }

          brandGuidelines = await extractResponse.json();

          if (!brandGuidelines.success) {
            throw new Error(brandGuidelines.error || 'Failed to extract brand styles');
          }

          // Display branding summary with visual UI
          addChatMessage(`Formato de marca obtenido de ${cleanUrl}`, 'system', {
            brandingData: brandGuidelines.guidelines,
            sourceUrl: cleanUrl
          });
          addChatMessage(`Construyendo tu componente con estas guías de marca...`, 'system');

          // Clear the flags after use
          sessionStorage.removeItem('brandExtensionMode');
          sessionStorage.removeItem('brandExtensionPrompt');

        } else {
          // === NORMAL CLONE MODE ===
          // Check if we have pre-scraped markdown content from search results
          const storedMarkdown = sessionStorage.getItem('siteMarkdown');
        if (storedMarkdown) {
          // Use the pre-scraped content
          scrapeData = {
            success: true,
            content: storedMarkdown,
            title: new URL(url).hostname,
            source: 'search-result'
          };
          sessionStorage.removeItem('siteMarkdown'); // Clear after use
          addChatMessage('Usando contenido en caché de los resultados de búsqueda...', 'system');
        } else {
          // Perform fresh scraping
          const scrapeResponse = await fetch('/api/scrape-url-enhanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          
          if (!scrapeResponse.ok) {
            throw new Error('No se pudo analizar el sitio web');
          }
          
          scrapeData = await scrapeResponse.json() as ScrapeData;
          
          if (!scrapeData.success) {
            throw new Error(scrapeData.error || 'Failed to scrape website');
          }
        }
        }

        setUrlStatus(
          isDirectPrompt
            ? ['¡Prompt listo!', 'Generando la app React...']
            : brandExtensionMode
              ? ['¡Estilos de marca extraídos!', 'Construyendo tu componente...']
              : ['¡Sitio extraído correctamente!', 'Generando la app React...']
        );

        // Clear preparing design state and switch to generation tab
        setIsPreparingDesign(false);
        setIsScreenshotLoaded(false); // Reset loaded state
        setUrlScreenshot(null); // Clear screenshot when starting generation
        setTargetUrl(''); // Clear target URL

        // Update loading stage to planning
        setLoadingStage('planning');

        // Brief pause before switching to generation tab
        setTimeout(() => {
          setLoadingStage('generating');
          setActiveTab('generation');
        }, 1500);

        // Build the appropriate prompt based on mode
        let prompt;

        if (isDirectPrompt) {
          const attachedImages = initialPromptImagesRef.current;
          setConversationContext(prev => ({
            ...prev,
            currentProject: homeUrlInput.trim().slice(0, 80)
          }));

          prompt = `Build a complete React application from scratch based on this user request.

USER REQUEST:
${homeUrlInput.trim()}

${attachedImages.length ? `The user attached ${attachedImages.length} reference image(s). Use them as visual references for layout, colors, typography, components, and overall UI. Recreate the look shown in the images as a working React app.` : ''}

${homeContextInput ? `ADDITIONAL CONTEXT/REQUIREMENTS FROM USER:
${homeContextInput}

Please incorporate these requirements into the design and implementation.` : ''}

IMPORTANT INSTRUCTIONS:
- Create a COMPLETE, working React application
- Use Tailwind CSS for all styling (no custom CSS files)
- Make it responsive and modern
- Create proper component structure
- Make sure the app actually renders visible content
- Create ALL components that you reference in imports
- Do not clone or scrape any existing website
- App.jsx should render the main application UI

Focus on building a polished, functional app that matches the request.`;
        } else if (brandExtensionMode && brandGuidelines) {
          // === BRAND EXTENSION PROMPT ===
          // Store brand guidelines in conversation context
          setConversationContext(prev => ({
            ...prev,
            scrapedWebsites: [...prev.scrapedWebsites, {
              url: url,
              content: { brandGuidelines },
              timestamp: new Date()
            }],
            currentProject: `Custom build using ${url} brand`
          }));

          // Extract comprehensive brand data
          const branding = brandGuidelines.guidelines;

          // Build detailed brand instruction string
          const brandInstructions = `
BRAND GUIDELINES FROM ${url}:

COLOR SYSTEM:
- Color Scheme: ${branding.colorScheme || 'light'} mode
- Primary Color: ${branding.colors?.primary || 'not specified'}
- Accent Color: ${branding.colors?.accent || 'not specified'}
- Background: ${branding.colors?.background || 'not specified'}
- Text Principal: ${branding.colors?.textPrimary || 'not specified'}
- Link Color: ${branding.colors?.link || 'not specified'}

TYPOGRAPHY:
- Primary Font: ${branding.typography?.fontFamilies?.primary || 'system default'}
- Heading Font: ${branding.typography?.fontFamilies?.heading || 'system default'}
- Font Stack (Body): ${branding.typography?.fontStacks?.body?.join(', ') || 'system-ui, sans-serif'}
- Font Stack (Heading): ${branding.typography?.fontStacks?.heading?.join(', ') || 'system-ui, sans-serif'}
- Tamaño H1: ${branding.typography?.fontSizes?.h1 || '36px'}
- Tamaño H2: ${branding.typography?.fontSizes?.h2 || '30px'}
- Tamaño del cuerpo: ${branding.typography?.fontSizes?.body || '16px'}

SPACING & LAYOUT:
- Base Spacing Unit: ${branding.spacing?.baseUnit || '4'}px
- Radio de borde: ${branding.spacing?.borderRadius || '6px'}

BUTTON STYLES:
Botón principal:
  - Background: ${branding.components?.buttonPrimary?.background || branding.colors?.primary}
  - Text Color: ${branding.components?.buttonPrimary?.textColor || '#FFFFFF'}
  - Radio de borde: ${branding.components?.buttonPrimary?.borderRadius || branding.spacing?.borderRadius || '8px'}
  - Shadow: ${branding.components?.buttonPrimary?.shadow || 'none'}

Botón secundario:
  - Background: ${branding.components?.buttonSecondary?.background || '#F9F9F9'}
  - Text Color: ${branding.components?.buttonSecondary?.textColor || branding.colors?.textPrimary}
  - Radio de borde: ${branding.components?.buttonSecondary?.borderRadius || branding.spacing?.borderRadius || '8px'}
  - Shadow: ${branding.components?.buttonSecondary?.shadow || 'none'}

INPUT FIELDS:
- Border Color: ${branding.components?.input?.borderColor || '#CCCCCC'}
- Radio de borde: ${branding.components?.input?.borderRadius || branding.spacing?.borderRadius || '6px'}

BRAND PERSONALITY:
- Tone: ${branding.personality?.tone || 'professional'}
- Energy: ${branding.personality?.energy || 'medium'}
- Target Audience: ${branding.personality?.targetAudience || 'general'}

DESIGN SYSTEM:
- Framework: ${branding.designSystem?.framework || 'tailwind'}
- Component Library: ${branding.designSystem?.componentLibrary || 'custom'}

ASSETS:
${branding.images?.logo ? `- Logo Available: Yes (use carefully if needed)` : '- Logo: Not available'}
${branding.images?.favicon ? `- Favicon: ${branding.images.favicon}` : ''}`;

          prompt = `I want you to build a NEW React component/application based on these brand guidelines and the user's requirements.

<branding-format source="${url}">
${brandInstructions}

RAW BRAND DATA (for reference):
${JSON.stringify(branding, null, 2)}
</branding-format>

USER'S REQUEST:
${brandExtensionPrompt || 'Build a modern web component using these brand guidelines'}

IMPORTANT: The content above in the <branding-format> tags contains the extracted brand guidelines from ${url}.
Use these guidelines (colors, fonts, spacing, design patterns) to build what the user requested.

CRITICAL REQUIREMENTS:
- DO NOT recreate the original website at ${url}
- DO create a COMPLETELY NEW component that fulfills the user's request
- The user wants: "${brandExtensionPrompt}"
- Build ONLY what the user requested - nothing more
- App.jsx should render ONLY the requested component - no extra Header/Footer/Hero unless specifically requested
- Make it a minimal, focused implementation of the user's request

STYLING REQUIREMENTS:
- Apply the EXACT colors from the brand palette (primary, accent, background, text colors)
- Use the EXACT typography (font families, font sizes for h1, h2, body)
- Apply the spacing system (base unit: ${branding.spacing?.baseUnit || '4'}px)
- Use the specified border radius (${branding.spacing?.borderRadius || '6px'}) consistently
- Implement button styles EXACTLY as specified (colors, shadows, border radius)
- Style input fields with the exact border color and border radius
- Match the brand's ${branding.colorScheme || 'light'} color scheme
- Apply the brand personality: ${branding.personality?.tone || 'professional'} tone with ${branding.personality?.energy || 'medium'} energy
- Use Tailwind CSS with inline color values matching the brand palette EXACTLY
- If fonts need to be imported, add @import or @font-face rules to index.css
- Create custom CSS classes in index.css for complex shadows/effects that can't be done with Tailwind

FONT SETUP:
${branding.typography?.fontFamilies?.primary ? `
- Add font family "${branding.typography.fontFamilies.primary}" to your CSS
- Use font stack: ${branding.typography?.fontStacks?.body?.join(', ') || 'system-ui, sans-serif'}
- Set body font size to ${branding.typography?.fontSizes?.body || '16px'}` : '- Use system fonts'}

COMPONENT STRUCTURE:
- src/index.css - Include brand fonts, custom shadows/effects, and base styling
- src/App.jsx - Should ONLY render the requested component (e.g., just <PricingPage /> if user wants pricing)
- src/components/[RequestedComponent].jsx - The actual component fulfilling the user's request

TECHNICAL REQUIREMENTS:
- Create a WORKING, self-contained application
- DO NOT import components that don't exist
- Make sure the app renders immediately with visible content
- All colors must match the brand palette EXACTLY
- All spacing must use the ${branding.spacing?.baseUnit || '4'}px base unit
- Buttons must have the exact styling specified in the guidelines

Focus on building something NEW, minimal, and functional that perfectly matches the ${brandGuidelines.styleName || 'brand'} aesthetic and design system.`;

        } else {
          // === NORMAL CLONE MODE PROMPT ===
          // Store scraped data in conversation context
          if (!scrapeData) {
            throw new Error('Scrape data is missing');
          }
          setConversationContext(prev => ({
            ...prev,
            scrapedWebsites: [...prev.scrapedWebsites, {
              url: url,
              content: scrapeData,
              timestamp: new Date()
            }],
            currentProject: `${url} Clone`
          }));

          // Filter out style-related context when using screenshot/URL-based generation
          // Only keep user's explicit instructions, not inherited styles
          let filteredContext = homeContextInput;
          if (homeUrlInput && homeContextInput) {
            // Check if the context contains default style names that shouldn't be inherited
            const stylePatterns = [
              'Glassmorphism style design',
              'Neumorphism style design',
              'Brutalism style design',
              'Minimalist style design',
              'Dark Mode style design',
              'Gradient Rich style design',
              '3D Depth style design',
              'Retro Wave style design',
              'Modern clean and minimalist style design',
              'Fun colorful and playful style design',
              'Corporate professional and sleek style design',
              'Creative artistic and unique style design'
            ];

            // If the context exactly matches or starts with a style pattern, filter it out
            const startsWithStyle = stylePatterns.some(pattern =>
              homeContextInput.trim().startsWith(pattern)
            );

            if (startsWithStyle) {
              // Extract only the additional instructions part after the style
              const additionalMatch = homeContextInput.match(/\. (.+)$/);
              filteredContext = additionalMatch ? additionalMatch[1] : '';
            }
          }

          prompt = `I want to recreate the ${url} website as a complete React application based on the scraped content below.

${JSON.stringify(scrapeData, null, 2)}

${filteredContext ? `ADDITIONAL CONTEXT/REQUIREMENTS FROM USER:
${filteredContext}

Please incorporate these requirements into the design and implementation.` : ''}

IMPORTANT INSTRUCTIONS:
- Create a COMPLETE, working React application
- Implement ALL sections and features from the original site
- Use Tailwind CSS for all styling (no custom CSS files)
- Make it responsive and modern
- Ensure all text content matches the original
- Create proper component structure
- Make sure the app actually renders visible content
- Create ALL components that you reference in imports
${filteredContext ? '- Apply the user\'s context/theme requirements throughout the application' : ''}

Focus on the key sections and content, making it clean and modern.`;
        }

        setGenerationProgress(prev => ({
          isGenerating: true,
          status: 'Inicializando la IA...',
          components: [],
          currentComponent: 0,
          streamedCode: '',
          isStreaming: true,
          isThinking: false,
          thinkingText: undefined,
          thinkingDuration: undefined,
          // Keep previous files until new ones are generated
          files: prev.files || [],
          currentFile: undefined,
          lastProcessedPosition: 0
        }));
        
        const aiResponse = await fetch('/api/generate-ai-code-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt,
            model: appConfig.ui.showModelSelector ? aiModel : appConfig.ai.lockedModel,
            images: isDirectPrompt ? initialPromptImagesRef.current : undefined,
            context: {
              sandboxId: sandboxData?.sandboxId,
              structure: structureContent,
              conversationContext: conversationContext
            }
          })
        });
        
        if (!aiResponse.ok || !aiResponse.body) {
          throw new Error('No se pudo generar el código');
        }
        
        const reader = aiResponse.body.getReader();
        const decoder = new TextDecoder();
        let generatedCode = '';
        let explanation = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'status') {
                  setGenerationProgress(prev => ({ ...prev, status: toSpanishGenerationStatus(data.message) }));
                } else if (data.type === 'thinking') {
                  setGenerationProgress(prev => ({ 
                    ...prev, 
                    isThinking: true,
                    thinkingText: (prev.thinkingText || '') + data.text
                  }));
                } else if (data.type === 'thinking_complete') {
                  setGenerationProgress(prev => ({ 
                    ...prev, 
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === 'conversation') {
                  // Add conversational text to chat only if it's not code
                  let text = data.text || '';
                  
                  // Remove package tags from the text
                  text = text.replace(/<package>[^<]*<\/package>/g, '');
                  text = text.replace(/<packages>[^<]*<\/packages>/g, '');
                  
                  // Filter out any XML tags and file content that slipped through
                  if (!text.includes('<file') && !text.includes('import React') && 
                      !text.includes('export default') && !text.includes('className=') &&
                      text.trim().length > 0) {
                    addChatMessage(text.trim(), 'ai');
                  }
                } else if (data.type === 'stream' && data.raw) {
                  setGenerationProgress(prev => {
                    const newStreamedCode = prev.streamedCode + data.text;
                    
                    // Tab is already switched after scraping
                    
                    const updatedState = { 
                      ...prev, 
                      streamedCode: newStreamedCode,
                      isStreaming: true,
                      isThinking: false,
                      status: 'Generando código...'
                    };
                    
                    // Process complete files from the accumulated stream
                    const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                    let match;
                    const processedFiles = new Set(prev.files.map(f => f.path));
                    
                    while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                      const filePath = match[1];
                      const fileContent = match[2];
                      
                      // Only add if we haven't processed this file yet
                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                                        fileExt === 'css' ? 'css' :
                                        fileExt === 'json' ? 'json' :
                                        fileExt === 'html' ? 'html' : 'text';
                        
                        // Check if file already exists
                        const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);
                        
                        if (existingFileIndex >= 0) {
                          // Update existing file and mark as edited
                          updatedState.files = [
                            ...updatedState.files.slice(0, existingFileIndex),
                            {
                              ...updatedState.files[existingFileIndex],
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: true
                            },
                            ...updatedState.files.slice(existingFileIndex + 1)
                          ];
                        } else {
                          // Add new file
                          updatedState.files = [...updatedState.files, {
                            path: filePath,
                            content: fileContent.trim(),
                            type: fileType,
                            completed: true,
                            edited: false
                          }];
                        }
                        
                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = toSpanishGenerationStatus(`Completed ${filePath}`);
                        }
                        processedFiles.add(filePath);
                      }
                    }
                    
                    // Check for current file being generated (incomplete file at the end)
                    const lastFileMatch = newStreamedCode.match(/<file path="([^"]+)">([^]*?)$/);
                    if (lastFileMatch && !lastFileMatch[0].includes('</file>')) {
                      const filePath = lastFileMatch[1];
                      const partialContent = lastFileMatch[2];
                      
                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                                        fileExt === 'css' ? 'css' :
                                        fileExt === 'json' ? 'json' :
                                        fileExt === 'html' ? 'html' : 'text';
                        
                        updatedState.currentFile = { 
                          path: filePath, 
                          content: partialContent, 
                          type: fileType 
                        };
                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = toSpanishGenerationStatus(`Generating ${filePath}`);
                        }
                      }
                    } else {
                      updatedState.currentFile = undefined;
                    }
                    
                    return updatedState;
                  });
                } else if (data.type === 'complete') {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;

                  pendingLogoApplyRef.current = {
                    disableMorph: Boolean(data.disableMorph) || pendingLogoApplyRef.current.disableMorph,
                    logoSwap: Boolean(data.logoSwap) || pendingLogoApplyRef.current.logoSwap,
                    uploadedImages: Array.isArray(data.uploadedImages)
                      ? data.uploadedImages
                      : pendingLogoApplyRef.current.uploadedImages,
                  };
                  
                  // Save the last generated code
                  setConversationContext(prev => ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
        
        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: '¡Generación completada!'
        }));
        
        if (generatedCode) {
          addChatMessage('¡Recreación de la IA generada!', 'system');
          
          // Add the explanation to chat if available
          if (explanation && explanation.trim()) {
            addChatMessage(explanation, 'ai');
          }
          
          setPromptInput(generatedCode);

          const sandboxForApply = createdSandbox || sandboxDataRef.current || sandboxData;
          if (createdSandbox) {
            sandboxDataRef.current = createdSandbox;
            setSandboxData(createdSandbox);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          // Apply the code (first time is not edit mode)
          await applyGeneratedCode(generatedCode, false, sandboxForApply || undefined);

          addChatMessage(
            isDirectPrompt
              ? `¡App creada a partir del prompt${homeContextInput ? ` con el contexto: «${homeContextInput}»` : ''}! Ya puedes pedirme cambios o más funciones.`
              : brandExtensionMode
              ? `¡Componente personalizado creado con las guías de marca de ${cleanUrl}! Ya puedes pedirme cambios o más funciones.`
              : `¡${url} recreado como app React moderna${homeContextInput ? ` con el contexto: «${homeContextInput}»` : ''}! El contenido analizado está en mi contexto: puedes pedirme cambios o funciones basadas en el sitio original.`,
            'ai',
            {
              scrapedUrl: isDirectPrompt ? undefined : url,
              scrapedContent: isDirectPrompt ? undefined : (brandExtensionMode ? { brandGuidelines } : scrapeData),
              generatedCode: generatedCode
            }
          );
          
          setConversationContext(prev => ({
            ...prev,
            generatedComponents: [],
            appliedCode: [...prev.appliedCode, {
              files: [],
              timestamp: new Date()
            }]
          }));
        } else {
          throw new Error('No se pudo generar la recreación');
        }
        
        setUrlInput('');
        setUrlStatus([]);
        setHomeContextInput('');
        
        // Clear generation progress and all screenshot/design states
        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: '¡Generación completada!'
        }));
        
        // Clear screenshot and preparing design states to prevent them from showing on next run
        setIsScreenshotLoaded(false); // Reset loaded state
        setUrlScreenshot(null);
        setIsPreparingDesign(false);
        setTargetUrl('');
        setScreenshotError(null);
        setLoadingStage(null); // Clear loading stage
        setIsStartingNewGeneration(false); // Clear new generation flag
        setShowLoadingBackground(false); // Clear loading background
        
        setTimeout(() => {
          // Switch back to preview tab but keep files
          setActiveTab('preview');
        }, 1000); // Show completion briefly then switch
      } catch (error: any) {
        addChatMessage(`No se pudo generar: ${error.message}`, 'system');
        setUrlStatus([]);
        setIsPreparingDesign(false);
        setIsStartingNewGeneration(false); // Clear new generation flag on error
        setLoadingStage(null);
        // Also clear generation progress on error
        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: '',
          // Keep files to display in sidebar
          files: prev.files
        }));
      }
    }, 500);
  };

  return (
    <HeaderProvider>
      <div className="mx-workspace text-foreground h-screen flex flex-col relative">
      <div className="meshBg" aria-hidden>
        <div className="meshTint" />
      </div>
      <div className="mx-workspace__top relative z-[1]">
        <Link href="/" className="text-[13px] font-medium text-[var(--mx-suave)] hover:text-[var(--mx-menu)] transition-colors">
          Inicio
        </Link>
        <div className="flex items-center gap-2">
          <ModelSelectorGate>
          <ModelSelect
            value={aiModel}
            onChange={(model) => {
              setAiModel(model);
              const params = new URLSearchParams(searchParams);
              params.set('model', model);
              if (sandboxData?.sandboxId) {
                params.set('sandbox', sandboxData.sandboxId);
              }
              router.push(`/generation?${params.toString()}`);
            }}
            className="min-w-[220px]"
          />
          </ModelSelectorGate>
          <button 
            onClick={() => createSandbox()}
            className="mxr-btn"
            title="Crear nuevo sandbox"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button 
            onClick={reapplyLastGeneration}
            className="mxr-btn disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reaplicar la última generación"
            disabled={!conversationContext.lastGeneratedCode || !sandboxData}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button 
            onClick={downloadZip}
            disabled={!sandboxData}
            className="mxr-btn disabled:opacity-50 disabled:cursor-not-allowed"
            title="Descargar la app Vite en ZIP"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </button>
       
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative z-[1]">
        {/* Panel chat — más amplio en generación */}
        <div className="mx-workspace__chat">
          {/* Sidebar Input Component */}
          {!hasInitialSubmission ? (
            <div className="p-4 border-b border-border">
              <SidebarInput
                onSubmit={(url, style, model, instructions) => {
                  // Mark that we've had an initial submission
                  setHasInitialSubmission(true);
                  
                  // Store the configuration in sessionStorage (same as home page)
                  sessionStorage.setItem('targetUrl', url);
                  sessionStorage.setItem('selectedStyle', style);
                  sessionStorage.setItem('selectedModel', model);
                  if (instructions) {
                    sessionStorage.setItem('additionalInstructions', instructions);
                  }
                  sessionStorage.setItem('autoStart', 'true');
                  
                  // Start generation using the existing logic
                  setHomeUrlInput(url);
                  setHomeContextInput(instructions || '');
                  startGeneration();
                }}
                disabled={loading || generationProgress.isGenerating}
              />
            </div>
          ) : null}

          {conversationContext.scrapedWebsites.length > 0 && (
            <div className="p-4 bg-card border-b border-gray-200">
              <div className="flex flex-col gap-4">
                {conversationContext.scrapedWebsites.map((site, idx) => {
                  // Extract favicon and site info from the scraped data
                  const metadata = site.content?.metadata || {};
                  const sourceURL = metadata.sourceURL || site.url;
                  const favicon = metadata.favicon || `https://www.google.com/s2/favicons?domain=${new URL(sourceURL).hostname}&sz=128`;
                  const siteName = metadata.ogSiteName || metadata.title || new URL(sourceURL).hostname;
                  const screenshot = site.content?.screenshot || sessionStorage.getItem('websiteScreenshot');
                  
                  return (
                    <div key={idx} className="flex flex-col gap-3">
                      {/* Site info with favicon */}
                      <div className="flex items-center gap-4 text-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={favicon} 
                          alt={siteName}
                          className="w-16 h-16 rounded"
                          onError={(e) => {
                            e.currentTarget.src = `https://www.google.com/s2/favicons?domain=${new URL(sourceURL).hostname}&sz=128`;
                          }}
                        />
                        <a 
                          href={sourceURL} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-black hover:text-gray-700 truncate max-w-[250px] font-medium"
                          title={sourceURL}
                        >
                          {siteName}
                        </a>
                      </div>
                      
                      {/* Pinned screenshot */}
                      {screenshot && (
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-600">Vista previa de captura</span>
                            <button
                              onClick={() => setScreenshotCollapsed(!screenshotCollapsed)}
                              className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                              aria-label={screenshotCollapsed ? 'Expand screenshot' : 'Collapse screenshot'}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className={`transition-transform duration-300 ${screenshotCollapsed ? 'rotate-180' : ''}`}
                              >
                                <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                          <div
                            className="w-full rounded-lg overflow-hidden border border-gray-200 transition-all duration-300"
                            style={{
                              opacity: screenshotCollapsed ? 0 : 1,
                              transform: screenshotCollapsed ? 'translateY(-20px)' : 'translateY(0)',
                              pointerEvents: screenshotCollapsed ? 'none' : 'auto',
                              maxHeight: screenshotCollapsed ? '0' : '200px'
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={screenshot}
                              alt={`${siteName} preview`}
                              className="w-full h-auto object-cover"
                              style={{ maxHeight: '200px' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 scrollbar-hide"
            ref={chatMessagesRef}>
            {chatMessages.map((msg, idx) => {
              // Check if this message is from a successful generation
              const isGenerationComplete = msg.content.includes('Successfully recreated') || 
                                         msg.content.includes('AI recreation generated!') ||
                                         msg.content.includes('Code generated!') ||
                                         msg.content.includes('¡App creada') ||
                                         msg.content.includes('recreado como app') ||
                                         msg.content.includes('¡Recreación de la IA generada!') ||
                                         msg.content.includes('¡Código generado correctamente!');
              
              // Get the files from metadata if this is a completion message
              // const completedFiles = msg.metadata?.appliedFiles || [];
              
              return (
                <div key={idx} className="block">
                  <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="block">
                      <div className={`${
                        msg.type === 'user' ? 'mx-chat-bubble mx-chat-bubble--user' :
                        msg.type === 'ai' ? 'mx-chat-bubble mx-chat-bubble--ai' :
                        msg.type === 'system' ? 'mx-chat-bubble mx-chat-bubble--system' :
                        msg.type === 'command' ? 'mx-chat-bubble bg-[var(--mx-oscuro)] text-white font-mono text-sm' :
                        msg.type === 'error' ? 'mx-chat-bubble bg-red-900 text-red-100 text-sm border border-red-700' :
                        'mx-chat-bubble mx-chat-bubble--system'
                      }`}>
                    {msg.type === 'command' ? (
                      <div className="flex items-start gap-2">
                        <span className={`text-xs ${
                          msg.metadata?.commandType === 'input' ? 'text-blue-400' :
                          msg.metadata?.commandType === 'error' ? 'text-red-400' :
                          msg.metadata?.commandType === 'success' ? 'text-green-400' :
                          'text-gray-400'
                        }`}>
                          {msg.metadata?.commandType === 'input' ? '$' : '>'}
                        </span>
                        <span className="flex-1 whitespace-pre-wrap text-white">{msg.content}</span>
                      </div>
                    ) : msg.type === 'error' ? (
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-red-800 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold mb-1">Errores de compilación detectados</div>
                          <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                          <div className="mt-2 text-xs opacity-70">Pulsa 'F' o el botón Corregir de arriba para resolverlos</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm">
                        {msg.metadata?.images && msg.metadata.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {msg.metadata.images.map((src, imageIndex) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={imageIndex}
                                src={src}
                                alt=""
                                className="h-56 w-56 object-cover rounded-6 border border-white/20"
                              />
                            ))}
                          </div>
                        )}
                        <span>{msg.content}</span>
                      </div>
                    )}
                      </div>
                  
                      {/* Show branding data if this is a brand extraction message */}
                      {msg.metadata?.brandingData && (
                        <div className="mt-3 bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl overflow-hidden max-w-[500px] shadow-sm">
                          <div className="bg-[#4B5CF0] px-16 py-12">
                            <div className="flex items-center gap-8">
                              <Image
                                src={`https://www.google.com/s2/favicons?domain=${msg.metadata.sourceUrl}&sz=32`}
                                alt=""
                                width={64}
                                height={64}
                                className="w-16 h-16"
                              />
                              <div className="text-sm font-semibold text-white">
                                Guía de marca
                              </div>
                            </div>
                          </div>

                          <div className="p-16">
                            {/* Color Scheme Mode */}
                            {msg.metadata.brandingData.colorScheme && (
                              <div className="mb-16">
                                <div className="text-sm">
                                  <span className="text-gray-600 font-medium">Modo:</span>{' '}
                                  <span className="font-semibold text-gray-900 capitalize">{msg.metadata.brandingData.colorScheme}</span>
                                </div>
                              </div>
                            )}

                            {/* Colors */}
                            {msg.metadata.brandingData.colors && (
                              <div className="mb-16">
                                <div className="text-sm font-semibold text-gray-900 mb-8">Colores</div>
                                <div className="flex flex-wrap gap-12">
                                  {msg.metadata.brandingData.colors.primary && (
                                    <div className="flex items-center gap-8">
                                      <div className="w-32 h-32 rounded border border-gray-300" style={{ backgroundColor: msg.metadata.brandingData.colors.primary }} />
                                      <div className="text-sm">
                                        <div className="font-semibold text-gray-900">Principal</div>
                                        <div className="text-gray-600 font-mono text-xs">{msg.metadata.brandingData.colors.primary}</div>
                                      </div>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.colors.accent && (
                                    <div className="flex items-center gap-8">
                                      <div className="w-32 h-32 rounded border border-gray-300" style={{ backgroundColor: msg.metadata.brandingData.colors.accent }} />
                                      <div className="text-sm">
                                        <div className="font-semibold text-gray-900">Acento</div>
                                        <div className="text-gray-600 font-mono text-xs">{msg.metadata.brandingData.colors.accent}</div>
                                      </div>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.colors.background && (
                                    <div className="flex items-center gap-8">
                                      <div className="w-32 h-32 rounded border border-gray-300" style={{ backgroundColor: msg.metadata.brandingData.colors.background }} />
                                      <div className="text-sm">
                                        <div className="font-semibold text-gray-900">Fondo</div>
                                        <div className="text-gray-600 font-mono text-xs">{msg.metadata.brandingData.colors.background}</div>
                                      </div>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.colors.textPrimary && (
                                    <div className="flex items-center gap-8">
                                      <div className="w-32 h-32 rounded border border-gray-300" style={{ backgroundColor: msg.metadata.brandingData.colors.textPrimary }} />
                                      <div className="text-sm">
                                        <div className="font-semibold text-gray-900">Texto</div>
                                        <div className="text-gray-600 font-mono text-xs">{msg.metadata.brandingData.colors.textPrimary}</div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Typography */}
                            {msg.metadata.brandingData.typography && (
                              <div className="mb-16">
                                <div className="text-sm font-semibold text-gray-900 mb-8">Tipografía</div>
                                <div className="grid grid-cols-2 gap-12 text-sm">
                                  {msg.metadata.brandingData.typography.fontFamilies?.primary && (
                                    <div>
                                      <span className="text-gray-600 font-medium">Principal:</span>{' '}
                                      <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontFamilies.primary}</span>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.typography.fontFamilies?.heading && (
                                    <div>
                                      <span className="text-gray-600 font-medium">Títulos:</span>{' '}
                                      <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontFamilies.heading}</span>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.typography.fontSizes?.h1 && (
                                    <div>
                                      <span className="text-gray-600 font-medium">Tamaño H1:</span>{' '}
                                      <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontSizes.h1}</span>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.typography.fontSizes?.h2 && (
                                    <div>
                                      <span className="text-gray-600 font-medium">Tamaño H2:</span>{' '}
                                      <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontSizes.h2}</span>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.typography.fontSizes?.body && (
                                    <div>
                                      <span className="text-gray-600 font-medium">Tamaño del cuerpo:</span>{' '}
                                      <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontSizes.body}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Spacing */}
                            {msg.metadata.brandingData.spacing && (
                              <div className="mb-16">
                                <div className="text-sm font-semibold text-gray-900 mb-8">Espaciado</div>
                                <div className="flex flex-wrap gap-16 text-sm">
                                  {msg.metadata.brandingData.spacing.baseUnit && (
                                    <div>
                                      <span className="text-gray-600 font-medium">Unidad base:</span>{' '}
                                      <span className="font-semibold text-gray-900">{msg.metadata.brandingData.spacing.baseUnit}px</span>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.spacing.borderRadius && (
                                    <div>
                                      <span className="text-gray-600 font-medium">Radio de borde:</span>{' '}
                                      <span className="font-semibold text-gray-900">{msg.metadata.brandingData.spacing.borderRadius}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Estilos de botón */}
                            {msg.metadata.brandingData.components?.buttonPrimary && (
                              <div className="mb-16">
                                <div className="text-sm font-semibold text-gray-900 mb-8">Estilos de botón</div>
                                <div className="flex flex-wrap gap-12">
                                  <div>
                                    <div className="text-xs text-gray-600 mb-6 font-medium">Botón principal</div>
                                    <button
                                      className="px-16 py-8 text-sm font-medium"
                                      style={{
                                        backgroundColor: msg.metadata.brandingData.components.buttonPrimary.background,
                                        color: msg.metadata.brandingData.components.buttonPrimary.textColor,
                                        borderRadius: msg.metadata.brandingData.components.buttonPrimary.borderRadius,
                                        boxShadow: msg.metadata.brandingData.components.buttonPrimary.shadow
                                      }}
                                    >
                                      Botón de ejemplo
                                    </button>
                                  </div>
                                  {msg.metadata.brandingData.components?.buttonSecondary && (
                                    <div>
                                      <div className="text-xs text-gray-600 mb-6 font-medium">Botón secundario</div>
                                      <button
                                        className="px-16 py-8 text-sm font-medium"
                                        style={{
                                          backgroundColor: msg.metadata.brandingData.components.buttonSecondary.background,
                                          color: msg.metadata.brandingData.components.buttonSecondary.textColor,
                                          borderRadius: msg.metadata.brandingData.components.buttonSecondary.borderRadius,
                                          boxShadow: msg.metadata.brandingData.components.buttonSecondary.shadow
                                        }}
                                      >
                                        Botón de ejemplo
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Personality */}
                            {msg.metadata.brandingData.personality && (
                              <div className="text-sm">
                                <span className="text-gray-600 font-medium">Personalidad:</span>{' '}
                                <span className="font-semibold text-gray-900 capitalize">
                                  {msg.metadata.brandingData.personality.tone} tone, {msg.metadata.brandingData.personality.energy} energy
                                </span>
                              </div>
                            )}

                            {/* Target Audience */}
                            {msg.metadata.brandingData.personality?.targetAudience && (
                              <div className="text-sm mt-8">
                                <span className="text-gray-600 font-medium">Objetivo:</span>{' '}
                                <span className="text-gray-900">{msg.metadata.brandingData.personality.targetAudience}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Show applied files if this is an apply success message */}
                      {msg.metadata?.appliedFiles && msg.metadata.appliedFiles.length > 0 && (
                    <div className="mt-3">
                      <GenerationFileList
                        title={msg.content.includes('Applied') || msg.content.includes('aplicado') ? 'Archivos actualizados' : 'Archivos generados'}
                        files={msg.metadata.appliedFiles.map((filePath) => ({ path: filePath }))}
                        allComplete
                        selectedPath={selectedFile}
                        onFileClick={(file) => handleFileClick(file.path)}
                      />
                    </div>
                  )}
                  
                      {/* Show generated files for completion messages - but only if no appliedFiles already shown */}
                      {isGenerationComplete && generationProgress.files.length > 0 && idx === chatMessages.length - 1 && !msg.metadata?.appliedFiles && !chatMessages.some(m => m.metadata?.appliedFiles) && (
                    <div className="mt-2">
                      <GenerationFileList
                        title="Archivos generados"
                        files={generationProgress.files}
                        allComplete
                        selectedPath={selectedFile}
                        onFileClick={(file) => handleFileClick(file.path)}
                      />
                    </div>
                  )}
                    </div>
                    </div>
                  </div>
              );
            })}
            
            {/* Code application progress */}
            {codeApplicationState.stage && (
              <CodeApplicationProgress state={codeApplicationState} />
            )}
            
            {/* File generation progress */}
            {generationProgress.isGenerating && (
              <GenerationFileList
                title={generationProgress.status || 'Generando código...'}
                files={generationProgress.files}
                currentFile={generationProgress.currentFile}
                selectedPath={selectedFile}
                onFileClick={(file) => handleFileClick(file.path)}
              />
            )}
          </div>

          <div className="p-4 border-t border-border bg-background-base">
            <ModelSelectorGate>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-black-alpha-48">Modelo</span>
              <ModelSelect
                value={aiModel}
                onChange={(model) => {
                  setAiModel(model);
                  const params = new URLSearchParams(searchParams);
                  params.set('model', model);
                  if (sandboxData?.sandboxId) {
                    params.set('sandbox', sandboxData.sandboxId);
                  }
                  router.push(`/generation?${params.toString()}`);
                }}
              />
            </div>
            </ModelSelectorGate>
            <HeroInput
              value={aiChatInput}
              onChange={setAiChatInput}
              onSubmit={sendChatMessage}
              placeholder="Describe el cambio o lo que quieres crear..."
              showSearchFeatures={false}
              allowImages
              images={chatImages}
              onImagesChange={setChatImages}
            />
          </div>
        </div>

        <div className="mx-workspace__preview">
          <div className="px-12 pt-8 pb-8 mxr-menubar flex justify-between items-center">
            <div className="flex items-center gap-8">
              {/* Toggle-style Code/View switcher */}
              <div className="inline-flex gap-8">
                <button
                  onClick={() => setActiveTab('generation')}
                  className={`mxr-tab ${activeTab === 'generation' ? 'selected' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <span>Código</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`mxr-tab ${activeTab === 'preview' ? 'selected' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>Vista</span>
                  </div>
                </button>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {/* Files generated count */}
              {activeTab === 'generation' && !generationProgress.isEdit && generationProgress.files.length > 0 && (
                <div className="text-gray-500 text-xs font-medium">
                  {generationProgress.files.length} archivos generados
                </div>
              )}
              
              {/* Live Code Generation Status */}
              {activeTab === 'generation' && generationProgress.isGenerating && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#ddd] text-xs font-medium text-[#555] uppercase">
                  <div className="w-1.5 h-1.5 bg-[#4B5CF0] rounded-full animate-pulse" />
                  {generationProgress.isEdit ? 'Editando código' : 'Generación en directo'}
                </div>
              )}
              
              {/* Sandbox Status Indicator */}
              {sandboxData && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#ddd] text-xs font-medium text-[#555] uppercase">
                  <div className="w-1.5 h-1.5 bg-[#08f] rounded-full" />
                  Sandbox activo
                </div>
              )}
              
              {/* Open in new tab button */}
              {sandboxData && (
                <a 
                  href={sandboxData.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  title="Abrir en pestaña nueva"
                  className="mxr-btn inline-flex items-center"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden">
            {renderMainContent()}
          </div>
        </div>
      </div>




    </div>
    </HeaderProvider>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Cargando...</div>}>
      <AISandboxPage />
    </Suspense>
  );
}