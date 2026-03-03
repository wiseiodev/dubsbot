import { describe, expect, it } from 'vitest';
import { AgentTurnEnvelopeSchema } from '../src/agent/schemas/turn';

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
});
