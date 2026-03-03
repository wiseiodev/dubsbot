import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  detectProvider: vi.fn(() => 'google'),
  getProviderPreflightError: vi.fn(() => null as string | null),
  createRuntime: vi.fn(),
  runFullIndex: vi.fn(),
}));

vi.mock('../../src/providers', () => ({
  detectProvider: mocks.detectProvider,
  getProviderPreflightError: mocks.getProviderPreflightError,
}));

vi.mock('../../src/cli/runtime', () => ({
  createRuntime: mocks.createRuntime,
}));

vi.mock('../../src/context/indexer/full-index', () => ({
  runFullIndex: mocks.runFullIndex,
}));

import { runChatCommand } from '../../src/cli/commands/chat';
import { runIndexCommand } from '../../src/cli/commands/index';
import { runPlanCommand } from '../../src/cli/commands/plan';

describe('integration: command orchestration flows', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    logSpy.mockClear();
  });

  it('chat one-shot success path emits expected output state', async () => {
    const write = vi.fn(async () => undefined);
    const runTurn = vi.fn(async () => ({
      turnType: 'assistant',
      intent: { goal: 'answer user', confidence: 1 },
      contextRequest: { query: '', maxItems: 5 },
      toolPlan: [],
      approvalRequest: null,
      assistantResponse: { message: 'integration-chat-ok' },
      termination: { shouldEnd: false },
      meta: { validationAttempts: 1, repaired: false },
    }));

    mocks.createRuntime.mockResolvedValue({
      orchestrator: { runTurn },
      transcripts: { write },
    });

    await runChatCommand('hello');

    expect(runTurn).toHaveBeenCalledWith({
      userMessage: 'hello',
      sessionId: 'oneshot-session',
      mode: 'interactive',
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('integration-chat-ok');
  });

  it('plan policy-denied path surfaces denial and avoids output side effects', async () => {
    const deniedError = new Error('Policy denied tool invocation: blocked pattern');
    const runTurn = vi.fn(async () => {
      throw deniedError;
    });

    mocks.createRuntime.mockResolvedValue({
      orchestrator: { runTurn },
    });

    await expect(runPlanCommand('delete production data')).rejects.toThrow('Policy denied tool');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('index recoverable failure path exits quickly without hanging', async () => {
    mocks.createRuntime.mockResolvedValue({
      db: { query: vi.fn() },
      provider: { embed: vi.fn() },
    });
    mocks.runFullIndex.mockRejectedValueOnce(new Error('temporary index error'));

    const result = await Promise.race([
      runIndexCommand('/tmp/project')
        .then(() => 'resolved')
        .catch(() => 'rejected'),
      new Promise<'timeout'>((resolve) => {
        setTimeout(() => resolve('timeout'), 200);
      }),
    ]);

    expect(result).not.toBe('timeout');
    expect(result).toBe('rejected');
  });
});
