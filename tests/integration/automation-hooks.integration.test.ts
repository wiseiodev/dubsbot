import { describe, expect, it, vi } from 'vitest';

const cronMocks = vi.hoisted(() => ({
  schedule: vi.fn(),
  jobs: [] as Array<() => Promise<void> | void>,
}));

vi.mock('node-cron', () => ({
  default: {
    schedule: cronMocks.schedule,
  },
}));

const execMocks = vi.hoisted(() => ({
  executeCommand: vi.fn(),
}));

vi.mock('../../src/tools/exec-command', () => ({
  executeCommand: execMocks.executeCommand,
}));

import { EventHookRunner } from '../../src/automation/event-hooks';
import { AutomationRunner } from '../../src/automation/runner';
import { AutomationScheduler } from '../../src/automation/scheduler';
import type { AutomationSpec } from '../../src/automation/schemas';
import { createAutomationTriggerState } from './helpers';

describe('integration: automation lifecycle and hook handoff', () => {
  it('scheduled automation trigger hands off to runner and reaches completed state', async () => {
    cronMocks.jobs = [];
    cronMocks.schedule.mockImplementation((_cron: string, task: () => Promise<void>) => {
      cronMocks.jobs.push(task);
      return {
        stop: vi.fn(),
      };
    });

    const runTurn = vi.fn(async () => ({ assistantResponse: { message: 'done' } }));
    const scheduler = new AutomationScheduler();
    const runner = new AutomationRunner({ runTurn } as never);
    const spec: AutomationSpec = {
      id: 'job-1',
      name: 'nightly',
      enabled: true,
      trigger: { type: 'schedule', cron: '* * * * *' },
      prompt: 'summarize health',
      workspace: '/tmp/repo',
      writePolicy: 'read-only',
      retries: 1,
    };

    const state = createAutomationTriggerState({ spec });

    scheduler.schedule(spec, async (currentSpec) => {
      state.status = 'running';
      await runner.run(currentSpec);
      state.status = 'completed';
      state.finishedAt = new Date().toISOString();
    });

    await cronMocks.jobs[0]();

    expect(runTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: 'summarize health',
        mode: 'automation',
      })
    );
    expect(state.status).toBe('completed');
    expect(state.finishedAt).not.toBeNull();
  });

  it('automation runtime failure reports failed lifecycle state with error details', async () => {
    cronMocks.jobs = [];
    cronMocks.schedule.mockImplementation((_cron: string, task: () => Promise<void>) => {
      cronMocks.jobs.push(task);
      return {
        stop: vi.fn(),
      };
    });

    const runner = new AutomationRunner({
      runTurn: vi.fn(async () => {
        throw new Error('runner crashed');
      }),
    } as never);
    const scheduler = new AutomationScheduler();
    const spec: AutomationSpec = {
      id: 'job-2',
      name: 'failure-path',
      enabled: true,
      trigger: { type: 'schedule', cron: '* * * * *' },
      prompt: 'force fail',
      workspace: '/tmp/repo',
      writePolicy: 'read-only',
      retries: 1,
    };

    const state = createAutomationTriggerState({ spec });

    scheduler.schedule(spec, async (currentSpec) => {
      state.status = 'running';
      try {
        await runner.run(currentSpec);
        state.status = 'completed';
      } catch (error) {
        state.status = 'failed';
        state.error = error instanceof Error ? error.message : String(error);
      } finally {
        state.finishedAt = new Date().toISOString();
      }
    });

    await cronMocks.jobs[0]();

    expect(state.status).toBe('failed');
    expect(state.error).toContain('runner crashed');
    expect(state.finishedAt).not.toBeNull();
  });

  it('event-driven hooks emit observable success and failure outcomes', async () => {
    const hookRunner = new EventHookRunner();
    const outcomes: string[] = [];

    hookRunner.register({
      id: 'hook-success',
      eventName: 'file-change',
      command: 'echo ok',
      enabled: true,
      timeoutMs: 100,
    });
    hookRunner.register({
      id: 'hook-failure',
      eventName: 'file-change',
      command: 'exit 1',
      enabled: true,
      timeoutMs: 100,
    });

    execMocks.executeCommand
      .mockResolvedValueOnce({ summary: 'Command succeeded', ok: true })
      .mockResolvedValueOnce({ summary: 'Command failed', ok: false, stderr: 'boom' });

    hookRunner.on('hook-result', ({ hook, result }) => {
      outcomes.push(`${hook.id}:${result.summary}`);
    });

    await hookRunner.trigger('file-change', { cwd: '/tmp/repo' });

    expect(outcomes).toContain('hook-success:Command succeeded');
    expect(outcomes).toContain('hook-failure:Command failed');
  });
});
