import type { z } from 'zod';
import type { DefaultPolicyEngine } from '../policy/engine';
import type { ProviderAdapter } from '../providers/types';
import { buildRepairPrompt } from './repair';
import { type AgentTurnEnvelope, AgentTurnEnvelopeSchema } from './schemas/turn';
import { createInitialState } from './state';

export type RunTurnInput = {
  userMessage: string;
  sessionId: string;
  mode: 'interactive' | 'automation';
};

export type RunTurnResult = AgentTurnEnvelope & {
  meta: {
    validationAttempts: number;
    repaired: boolean;
  };
};

export class AgentOrchestrator {
  private readonly maxValidationRetries: number;

  constructor(
    private readonly deps: {
      provider: ProviderAdapter;
      policyEngine: DefaultPolicyEngine;
      maxValidationRetries?: number;
      model?: string;
    }
  ) {
    this.maxValidationRetries = deps.maxValidationRetries ?? 3;
  }

  async runTurn(input: RunTurnInput): Promise<RunTurnResult> {
    const state = createInitialState({
      sessionId: input.sessionId,
      mode: input.mode,
      userMessage: input.userMessage,
    });

    let prompt = this.buildPrompt(state);
    let attempt = 0;
    let lastError: unknown;

    while (attempt < this.maxValidationRetries) {
      attempt += 1;
      try {
        const response = await this.deps.provider.generateStructured({
          model: this.deps.model ?? 'default',
          schema: AgentTurnEnvelopeSchema as z.ZodType<AgentTurnEnvelope>,
          prompt,
          system:
            'You are Dubsbot. Return only structured JSON matching the schema. No freeform text outside schema fields.',
        });

        const envelope = AgentTurnEnvelopeSchema.parse(response);
        this.enforcePolicy(envelope, input.mode);

        return {
          ...envelope,
          meta: {
            validationAttempts: attempt,
            repaired: attempt > 1,
          },
        };
      } catch (error) {
        lastError = error;
        if (attempt >= this.maxValidationRetries) {
          break;
        }
        prompt = buildRepairPrompt({
          originalPrompt: prompt,
          errorMessage: this.stringifyError(error),
          attempt,
        });
      }
    }

    throw new Error(
      `Model output failed schema validation after ${attempt} attempts: ${this.stringifyError(lastError)}`
    );
  }

  private buildPrompt(state: {
    sessionId: string;
    turns: number;
    lastUserMessage: string;
  }): string {
    return [
      `Session: ${state.sessionId}`,
      `Turn: ${state.turns + 1}`,
      `User message: ${state.lastUserMessage}`,
      'Plan safely, request approvals for mutating operations, and produce a useful assistant response.',
    ].join('\n');
  }

  private enforcePolicy(envelope: AgentTurnEnvelope, mode: 'interactive' | 'automation'): void {
    for (const invocation of envelope.toolPlan) {
      const decision = this.deps.policyEngine.evaluateToolInvocation({
        invocation,
        mode,
      });

      if (!decision.allowed && !decision.requiresApproval) {
        throw new Error(`Policy denied tool invocation: ${decision.reason}`);
      }
    }
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
