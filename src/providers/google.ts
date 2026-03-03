import { google } from '@ai-sdk/google';
import { embed, generateText, Output, streamText } from 'ai';
import type {
  EmbedInput,
  GenerateStructuredInput,
  ProviderAdapter,
  ProviderCapability,
  StreamStructuredInput,
} from './types';

export class GoogleAdapter implements ProviderAdapter {
  constructor(
    private readonly defaultModel = process.env.DUBSBOT_GOOGLE_MODEL ?? 'gemini-2.5-flash'
  ) {}

  async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T> {
    const result = await generateText({
      model: google(input.model || this.defaultModel),
      output: Output.object({
        schema: input.schema,
      }),
      prompt: input.prompt,
      system: input.system,
      temperature: input.temperature,
    });

    return result.output as T;
  }

  async *streamStructured<T>(input: StreamStructuredInput<T>): AsyncIterable<T> {
    const result = streamText({
      model: google(input.model || this.defaultModel),
      output: Output.object({
        schema: input.schema,
      }),
      prompt: input.prompt,
      system: input.system,
      temperature: input.temperature,
    });

    for await (const partial of result.partialOutputStream) {
      if (partial != null) {
        yield partial as T;
      }
    }
  }

  async embed(input: EmbedInput): Promise<number[][]> {
    const vectors: number[][] = [];
    for (const value of input.values) {
      const result = await embed({
        model: google.textEmbeddingModel(input.model || 'text-embedding-004'),
        value,
      });
      vectors.push(result.embedding);
    }
    return vectors;
  }

  async countTokens(input: { model: string; text: string }): Promise<number> {
    return Math.ceil(input.text.length / 4);
  }

  supports(_model: string, capability: ProviderCapability): boolean {
    return ['structured-output', 'streaming', 'embeddings'].includes(capability);
  }
}
