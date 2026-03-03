import type { z } from 'zod';
import type { DefaultPolicyEngine } from '../policy/engine';
import type { ProviderAdapter } from '../providers/types';
import { buildRepairPrompt } from './repair';
import { type AgentTurnEnvelope, AgentTurnEnvelopeSchema } from './schemas/turn';
import { type AgentRuntimeState, appendTurnToState, createInitialState } from './state';

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
  private readonly sessionStates = new Map<string, AgentRuntimeState>();

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
    const state = this.getSessionState(input);

    let prompt = this.buildPrompt(state, input.userMessage);
    let attempt = 0;
    let lastError: unknown;

    while (attempt < this.maxValidationRetries) {
      attempt += 1;
      try {
        const response = await this.deps.provider.generateStructured({
          model: this.deps.model,
          schema: AgentTurnEnvelopeSchema as z.ZodType<AgentTurnEnvelope>,
          prompt,
          system:
            'You are Dubsbot. Return only structured JSON matching the schema. No freeform text outside schema fields.',
        });

        const envelope = AgentTurnEnvelopeSchema.parse(response);
        this.enforcePolicy(envelope, input.mode);
        this.sessionStates.set(
          input.sessionId,
          appendTurnToState(state, {
            userMessage: input.userMessage,
            assistantMessage: envelope.assistantResponse.message,
          })
        );

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

  private buildPrompt(
    state: {
      sessionId: string;
      turns: number;
      history: { role: 'user' | 'assistant'; text: string }[];
    },
    currentUserMessage: string
  ): string {
    const historyLines = state.history.map((message) => `${message.role}: ${message.text}`);
    return [
      `Session: ${state.sessionId}`,
      `Turn: ${state.turns + 1}`,
      historyLines.length > 0 ? `Conversation history:\n${historyLines.join('\n')}` : '',
      `User message: ${currentUserMessage}`,
      'Plan safely, request approvals for mutating operations, and produce a useful assistant response.',
    ]
      .filter((line) => line.length > 0)
      .join('\n');
  }

  private getSessionState(input: RunTurnInput): AgentRuntimeState {
    const existing = this.sessionStates.get(input.sessionId);
    if (existing) {
      return existing;
    }

    const initial = createInitialState({
      sessionId: input.sessionId,
      mode: input.mode,
    });
    this.sessionStates.set(input.sessionId, initial);
    return initial;
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
