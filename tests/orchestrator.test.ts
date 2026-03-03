import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { AgentOrchestrator } from '../src/agent/orchestrator';
import { createDefaultApprovalPolicy } from '../src/policy/defaults';
import { DefaultPolicyEngine } from '../src/policy/engine';
import type { ProviderAdapter } from '../src/providers/types';

class FlakyProvider implements ProviderAdapter {
  private calls = 0;

  async generateStructured<T>(input: { schema: z.ZodSchema<T> }): Promise<T> {
    this.calls += 1;
    if (this.calls < 3) {
      throw new Error('schema validation failed');
    }
    return input.schema.parse({
      turnType: 'assistant',
      intent: { goal: 'answer user', confidence: 0.8 },
      contextRequest: { query: 'test', maxItems: 5 },
      toolPlan: [],
      approvalRequest: null,
      assistantResponse: { message: 'hello from model' },
      termination: { shouldEnd: false },
    });
  }

  async *streamStructured<T>(_input: { schema: z.ZodSchema<T> }): AsyncIterable<T> {
    for (const value of [] as T[]) {
      yield value;
    }
  }

  async embed(_input: { values: string[] }): Promise<number[][]> {
    return [[0.1, 0.2]];
  }

  async countTokens(input: { text: string }): Promise<number> {
    return input.text.length;
  }

  supports(): boolean {
    return true;
  }
}

describe('AgentOrchestrator', () => {
  it('retries invalid model outputs and eventually succeeds', async () => {
    const provider = new FlakyProvider();
    const orchestrator = new AgentOrchestrator({
      provider,
      policyEngine: new DefaultPolicyEngine(createDefaultApprovalPolicy()),
      maxValidationRetries: 3,
    });

    const result = await orchestrator.runTurn({
      userMessage: 'say hi',
      sessionId: 'test-session',
      mode: 'interactive',
    });

    expect(result.assistantResponse.message).toContain('hello');
    expect(result.meta.validationAttempts).toBe(3);
  });
});
