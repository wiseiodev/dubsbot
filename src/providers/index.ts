import { AnthropicAdapter } from './anthropic';
import { GoogleAdapter } from './google';
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
  const preferred = (process.env.DUBSBOT_PROVIDER || 'openai').toLowerCase();
  if (preferred === 'anthropic' || preferred === 'google' || preferred === 'openai') {
    return preferred;
  }
  return 'openai';
}
