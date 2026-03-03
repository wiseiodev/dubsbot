import { describe, expect, it } from 'vitest';
import { AgentTurnEnvelopeSchema } from '../src/agent/schemas/turn';
import { ContextQuerySchema } from '../src/context/schemas';

describe('AgentTurnEnvelopeSchema', () => {
  it('rejects invalid assistant responses', () => {
    const parsed = AgentTurnEnvelopeSchema.safeParse({
      turnType: 'assistant',
      intent: { goal: 'test', confidence: 0.5 },
      contextRequest: { query: 'q', maxItems: 5 },
      toolPlan: [],
      approvalRequest: null,
      assistantResponse: {},
      termination: { shouldEnd: false },
    });

    expect(parsed.success).toBe(false);
  });

  it('normalizes partial rerank input using defaults', () => {
    const parsed = ContextQuerySchema.parse({
      lexicalQuery: 'hello',
      vectorQuery: 'hello',
      graphHints: [],
      rerank: {},
      maxItems: 5,
    });

    expect(parsed.rerank).toEqual({
      method: 'hybrid',
      topK: 20,
    });
  });
});
