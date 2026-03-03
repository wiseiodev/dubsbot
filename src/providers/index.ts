import { AnthropicAdapter } from './anthropic';
import { GoogleAdapter } from './google';
import { getGoogleApiKey } from './google-env';
import { OpenAIAdapter } from './openai';
import type { ProviderAdapter } from './types';

export type ProviderName = 'openai' | 'anthropic' | 'google';

export function createProviderAdapter(provider: ProviderName): ProviderAdapter {
  switch (provider) {
    case 'openai':
      return new OpenAIAdapter();
    case 'anthropic':
      return new AnthropicAdapter();
    case 'google':
      return new GoogleAdapter();
    default:
      throw new Error(`Unsupported provider: ${provider satisfies never}`);
  }
}

export function detectProvider(): ProviderName {
  const preferred = (process.env.DUBSBOT_PROVIDER || 'google').toLowerCase();
  if (preferred === 'anthropic' || preferred === 'google' || preferred === 'openai') {
    return preferred;
  }
  return 'google';
}

export function getProviderPreflightError(provider: ProviderName): string | null {
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    return 'Missing OPENAI_API_KEY for provider=openai.';
  }

  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    return 'Missing ANTHROPIC_API_KEY for provider=anthropic.';
  }

  if (provider === 'google' && !getGoogleApiKey()) {
    return 'Missing GOOGLE_GENERATIVE_AI_API_KEY for provider=google.';
  }

  return null;
}
