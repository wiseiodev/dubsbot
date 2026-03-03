import type { z } from 'zod';

export type ProviderCapability = 'structured-output' | 'streaming' | 'embeddings' | 'tool-calling';

export type GenerateStructuredInput<T> = {
  model: string;
  schema: z.ZodType<T>;
  prompt: string;
  system?: string;
  temperature?: number;
};

export type StreamStructuredInput<T> = GenerateStructuredInput<T>;

export type EmbedInput = {
  model: string;
  values: string[];
};

export interface ProviderAdapter {
  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T>;
  streamStructured<T>(input: StreamStructuredInput<T>): AsyncIterable<T>;
  embed(input: EmbedInput): Promise<number[][]>;
  countTokens(input: { model: string; text: string }): Promise<number>;
  supports(model: string, capability: ProviderCapability): boolean;
}
