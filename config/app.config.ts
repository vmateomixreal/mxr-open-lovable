// Application Configuration
// This file contains all configurable settings for the application

/** When the model selector is off, the app always uses this OpenRouter slug. */
export const LOCKED_AI_MODEL = 'anthropic/claude-sonnet-5';

/**
 * Must use a static `process.env.NEXT_PUBLIC_*` access so Next.js inlines it
 * into the client bundle. Dynamic `process.env[name]` is undefined on the client.
 */
function isModelSelectorEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_ENABLE_MODEL_SELECTOR;
  if (raw == null || raw === '') return true;
  return !['0', 'false', 'no', 'off'].includes(String(raw).trim().toLowerCase());
}

const showModelSelector = isModelSelectorEnabled();

export const appConfig = {
  // Vercel Sandbox Configuration
  vercelSandbox: {
    // Sandbox timeout in minutes
    timeoutMinutes: 30,

    // Convert to milliseconds for Vercel Sandbox API
    get timeoutMs() {
      return this.timeoutMinutes * 60 * 1000;
    },

    // Development server port (Vercel Sandbox typically uses 3000 for Next.js/React)
    devPort: 3000,

    // Time to wait for dev server to be ready (in milliseconds)
    devServerStartupDelay: 7000,

    // Time to wait for CSS rebuild (in milliseconds)
    cssRebuildDelay: 2000,

    // Working directory in sandbox
    workingDirectory: '/app',

    // Default runtime for sandbox
    runtime: 'node22' // Available: node22, python3.13, v0-next-shadcn, cua-ubuntu-xfce
  },

  // E2B Sandbox Configuration
  e2b: {
    // Sandbox timeout in minutes
    timeoutMinutes: 30,

    // Convert to milliseconds for E2B API
    get timeoutMs() {
      return this.timeoutMinutes * 60 * 1000;
    },

    // Development server port (E2B uses 5173 for Vite)
    vitePort: 5173,

    // Time to wait for Vite dev server to be ready (in milliseconds)
    viteStartupDelay: 10000,

    // Working directory in sandbox
    workingDirectory: '/home/user/app',
  },
  
  // AI Model Configuration (all models are served via OpenRouter)
  ai: {
    // Default AI model (forced to Claude Sonnet 5 when selector is disabled)
    defaultModel: showModelSelector
      ? (process.env.NEXT_PUBLIC_DEFAULT_MODEL || LOCKED_AI_MODEL)
      : LOCKED_AI_MODEL,

    /** Model used when NEXT_PUBLIC_ENABLE_MODEL_SELECTOR=false */
    lockedModel: LOCKED_AI_MODEL,
    
    // Available models (OpenRouter slugs)
    availableModels: [
      'anthropic/claude-sonnet-5',
      'anthropic/claude-sonnet-4.6',
      'anthropic/claude-opus-4.1',
      'openai/gpt-4.1',
      'openai/gpt-4o',
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash',
    ],
    
    // Model display names
    modelDisplayNames: {
      'anthropic/claude-sonnet-5': 'Claude Sonnet 5',
      'anthropic/claude-sonnet-4.6': 'Claude Sonnet 4.6',
      'anthropic/claude-opus-4.1': 'Claude Opus 4.1',
      'openai/gpt-4.1': 'GPT-4.1',
      'openai/gpt-4o': 'GPT-4o',
      'google/gemini-2.5-pro': 'Gemini 2.5 Pro',
      'google/gemini-2.5-flash': 'Gemini 2.5 Flash',
    } as Record<string, string>,
    
    // Model API configuration
    modelApiConfig: {
      'anthropic/claude-sonnet-5': {
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-5'
      },
      'anthropic/claude-sonnet-4.6': {
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4.6'
      },
      'anthropic/claude-opus-4.1': {
        provider: 'openrouter',
        model: 'anthropic/claude-opus-4.1'
      },
      'openai/gpt-4.1': {
        provider: 'openrouter',
        model: 'openai/gpt-4.1'
      },
      'openai/gpt-4o': {
        provider: 'openrouter',
        model: 'openai/gpt-4o'
      },
      'google/gemini-2.5-pro': {
        provider: 'openrouter',
        model: 'google/gemini-2.5-pro'
      },
      'google/gemini-2.5-flash': {
        provider: 'openrouter',
        model: 'google/gemini-2.5-flash'
      }
    },
    
    // Temperature settings for non-reasoning models
    defaultTemperature: 0.7,
    
    // Max tokens for code generation
    maxTokens: 8000,
    
    // Max tokens for truncation recovery
    truncationRecoveryMaxTokens: 4000,
  },
  
  // Code Application Configuration
  codeApplication: {
    // Delay after applying code before refreshing iframe (milliseconds)
    defaultRefreshDelay: 2000,
    
    // Delay when packages are installed (milliseconds)
    packageInstallRefreshDelay: 5000,
    
    // Enable/disable automatic truncation recovery
    enableTruncationRecovery: false, // Disabled - too many false positives
    
    // Maximum number of truncation recovery attempts per file
    maxTruncationRecoveryAttempts: 1,
  },
  
  // UI Configuration
  ui: {
    // Driven by NEXT_PUBLIC_ENABLE_MODEL_SELECTOR (default: true)
    showModelSelector,
    showStatusIndicator: true,
    
    // Animation durations (milliseconds)
    animationDuration: 200,
    
    // Toast notification duration (milliseconds)
    toastDuration: 3000,
    
    // Maximum chat messages to keep in memory
    maxChatMessages: 100,
    
    // Maximum recent messages to send as context
    maxRecentMessagesContext: 20,
  },
  
  // Development Configuration
  dev: {
    // Enable debug logging
    enableDebugLogging: true,
    
    // Enable performance monitoring
    enablePerformanceMonitoring: false,
    
    // Log API responses
    logApiResponses: true,
  },
  
  // Package Installation Configuration
  packages: {
    // Use --legacy-peer-deps flag for npm install
    useLegacyPeerDeps: true,
    
    // Package installation timeout (milliseconds)
    installTimeout: 60000,
    
    // Auto-restart Vite after package installation
    autoRestartVite: true,
  },
  
  // File Management Configuration
  files: {
    // Excluded file patterns (files to ignore)
    excludePatterns: [
      'node_modules/**',
      '.git/**',
      '.next/**',
      'dist/**',
      'build/**',
      '*.log',
      '.DS_Store'
    ],
    
    // Maximum file size to read (bytes)
    maxFileSize: 1024 * 1024, // 1MB
    
    // File extensions to treat as text
    textFileExtensions: [
      '.js', '.jsx', '.ts', '.tsx',
      '.css', '.scss', '.sass',
      '.html', '.xml', '.svg',
      '.json', '.yml', '.yaml',
      '.md', '.txt', '.env',
      '.gitignore', '.dockerignore'
    ],
  },
  
  // API Endpoints Configuration (for external services)
  api: {
    // Retry configuration
    maxRetries: 3,
    retryDelay: 1000, // milliseconds
    
    // Request timeout (milliseconds)
    requestTimeout: 30000,
  }
};

// Type-safe config getter
export function getConfig<K extends keyof typeof appConfig>(key: K): typeof appConfig[K] {
  return appConfig[key];
}

// Helper to get nested config values
export function getConfigValue(path: string): any {
  return path.split('.').reduce((obj, key) => obj?.[key], appConfig as any);
}

/** Effective model for the current UI mode (respects locked selector). */
export function getEffectiveAiModel(preferred?: string | null): string {
  if (!appConfig.ui.showModelSelector) {
    return appConfig.ai.lockedModel;
  }
  return preferred || appConfig.ai.defaultModel;
}

export default appConfig;
