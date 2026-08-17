import { NextResponse } from 'next/server';
import { appConfig } from '@/config/app.config';
import { OpenRouterModel } from '@/lib/openrouter-models';

let cachedModels: OpenRouterModel[] | null = null;
let cachedAt = 0;
const CACHE_MS = 60 * 60 * 1000;

const FAMILIES = ['opus', 'sonnet', 'haiku', 'fable'] as const;

function perMillion(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount * 1_000_000 : 0;
}

function cleanName(name: string) {
  return name.replace(/^Anthropic:\s*/i, '').replace(/\s+/g, ' ').trim();
}

function familyOf(id: string) {
  return FAMILIES.find((family) => id.includes(`claude-${family}`));
}

function pickLatestAnthropic(models: OpenRouterModel[]) {
  const selected: OpenRouterModel[] = [];

  for (const family of FAMILIES) {
    const familyModels = models
      .filter((model) => familyOf(model.id) === family)
      .sort((a, b) => b.created - a.created);

    const latest = familyModels.find((model) => !model.id.includes('fast'));
    const latestFast = familyModels.find((model) => model.id.includes('fast'));

    if (latest) selected.push(latest);
    if (latestFast && latestFast.id !== latest?.id) selected.push(latestFast);
  }

  return selected.sort((a, b) => b.created - a.created);
}

export async function GET() {
  try {
    if (cachedModels && Date.now() - cachedAt < CACHE_MS) {
      return NextResponse.json({ models: cachedModels });
    }

    const headers: HeadersInit = {};
    if (process.env.OPEN_ROUTER_API_KEY) {
      headers.Authorization = `Bearer ${process.env.OPEN_ROUTER_API_KEY}`;
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers,
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter models request failed (${response.status})`);
    }

    const payload = await response.json();
    const anthropicModels: OpenRouterModel[] = (payload.data || [])
      .filter((model: any) =>
        typeof model?.id === 'string'
        && model.id.startsWith('anthropic/')
        && !model.id.includes(':batch')
        && model.architecture?.output_modalities?.includes('text')
      )
      .map((model: any) => ({
        id: model.id as string,
        name: cleanName((model.name as string) || model.id),
        vision: Array.isArray(model.architecture?.input_modalities)
          && model.architecture.input_modalities.includes('image'),
        created: Number(model.created || 0),
        pricePrompt: perMillion(model.pricing?.prompt),
        priceCompletion: perMillion(model.pricing?.completion),
      }));

    const models = pickLatestAnthropic(anthropicModels);
    const defaultModel = anthropicModels.find((model) => model.id === appConfig.ai.defaultModel);
    if (defaultModel && !models.some((model) => model.id === defaultModel.id)) {
      models.push(defaultModel);
      models.sort((a, b) => b.created - a.created);
    }
    cachedModels = models;
    cachedAt = Date.now();

    return NextResponse.json({ models });
  } catch (error) {
    console.error('[openrouter-models]', error);
    if (cachedModels) {
      return NextResponse.json({ models: cachedModels });
    }
    return NextResponse.json(
      { error: 'Failed to load OpenRouter models', models: [] },
      { status: 500 }
    );
  }
}
