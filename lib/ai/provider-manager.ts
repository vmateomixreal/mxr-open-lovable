import { appConfig } from '@/config/app.config';
import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export interface ProviderResolution {
  client: OpenAIProvider;
  actualModel: string;
}

let cachedClient: OpenAIProvider | null = null;

function getOpenRouterApiKey(): string {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPEN_ROUTER_API_KEY is not set. Add it to your .env file.');
  }
  return apiKey;
}

export function getOpenRouterClient(): OpenAIProvider {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createOpenAI({
    apiKey: getOpenRouterApiKey(),
    baseURL: OPENROUTER_BASE_URL,
    name: 'openrouter',
    headers: {
      'HTTP-Referer': process.env.OPEN_ROUTER_HTTP_REFERER || 'http://localhost:3000',
      'X-Title': process.env.OPEN_ROUTER_APP_TITLE || 'Open Lovable',
    },
  });

  return cachedClient;
}

export function getProviderForModel(modelId?: string): ProviderResolution {
  const actualModel = modelId || appConfig.ai.defaultModel;
  return {
    client: getOpenRouterClient(),
    actualModel,
  };
}

export function getLanguageModel(modelId?: string) {
  const { client, actualModel } = getProviderForModel(modelId);
  // OpenRouter is OpenAI-compatible via Chat Completions, not the Responses API
  return client.chat(actualModel);
}

export default getProviderForModel;
