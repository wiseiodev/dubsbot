import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output, streamText } from 'ai';
import { deterministicEmbedding } from '../context/retrieval/rerank';
import type {
  EmbedInput,
  GenerateStructuredInput,
  ProviderAdapter,
  ProviderCapability,
  StreamStructuredInput,
} from './types';

export class AnthropicAdapter implements ProviderAdapter {
  constructor(
    private readonly defaultModel = process.env.DUBSBOT_ANTHROPIC_MODEL ??
      'claude-sonnet-4-20250514'
  ) {}

  async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T> {
    const result = await generateText({
      model: anthropic(input.model || this.defaultModel),
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
      model: anthropic(input.model || this.defaultModel),
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
    return input.values.map((value) => deterministicEmbedding(value));
  }

  async countTokens(input: { model: string; text: string }): Promise<number> {
    return Math.ceil(input.text.length / 4);
  }

  supports(_model: string, capability: ProviderCapability): boolean {
    return ['structured-output', 'streaming', 'embeddings'].includes(capability);
  }
}
