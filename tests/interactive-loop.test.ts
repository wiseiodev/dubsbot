import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getPendingToolIndexes,
  InteractiveLoopLifecycle,
  LoopCheckpointStore,
  mapLegacySignalToPhase,
  resolveApprovalOutcome,
} from '../src/cli/interactive-loop';

describe('interactive loop lifecycle', () => {
  it('allows planning to complete without execution', async () => {
    const lifecycle = new InteractiveLoopLifecycle('test-session');

    await lifecycle.transitionTo('planning');
    const transitioned = await lifecycle.transitionTo('completed');

    expect(transitioned).toBe(true);
    expect(lifecycle.getPhase()).toBe('completed');
  });

  it('blocks invalid transition and moves to visible failed state', async () => {
    const events: string[] = [];
    const lifecycle = new InteractiveLoopLifecycle('test-session', (event) => {
      events.push(event.type);
    });

    await lifecycle.transitionTo('planning');
    await lifecycle.transitionTo('completed');
    const transitioned = await lifecycle.transitionTo('executing');

    expect(transitioned).toBe(false);
    expect(lifecycle.getPhase()).toBe('failed');
    expect(events).toContain('invalid_transition');
    expect(events).toContain('lifecycle_transition');
  });

  it('handles interrupts at checkpoints', async () => {
    const lifecycle = new InteractiveLoopLifecycle('test-session');

    await lifecycle.transitionTo('planning');
    await lifecycle.transitionTo('executing');
    await lifecycle.requestInterrupt();
    const interrupted = await lifecycle.handleInterruptAtCheckpoint();

    expect(interrupted).toBe(true);
    expect(lifecycle.getPhase()).toBe('interrupted');
  });

  it('maps legacy signals to canonical phases', () => {
    expect(mapLegacySignalToPhase('planning_started')).toBe('planning');
    expect(mapLegacySignalToPhase('execution_started')).toBe('executing');
  });
});

describe('interactive loop approval behavior', () => {
  it('parses explicit approval outcomes including dismiss', () => {
    expect(resolveApprovalOutcome('/approve')).toBe('approved');
    expect(resolveApprovalOutcome('/deny')).toBe('denied');
    expect(resolveApprovalOutcome('/dismiss')).toBe('dismissed');
    expect(resolveApprovalOutcome('invalid')).toBeNull();
  });
});

describe('interactive loop checkpoint persistence', () => {
  it('restores checkpoint state for resume', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dubsbot-loop-'));
    const checkpointPath = join(dir, 'checkpoint.json');
    const store = new LoopCheckpointStore('test-session', checkpointPath);

    await store.save({
      sessionId: 'test-session',
      phase: 'interrupted',
      lastUserMessage: 'do the thing',
      assistantMessage: 'working on it',
      toolPlan: [],
      nextToolIndex: 2,
      completedToolIndexes: [0, 1],
    });

    const restored = await store.load();

    expect(restored?.phase).toBe('interrupted');
    expect(restored?.nextToolIndex).toBe(2);
    expect(restored?.completedToolIndexes).toEqual([0, 1]);

    await rm(dir, { recursive: true, force: true });
  });

  it('computes pending tool indexes without replaying completed steps', () => {
    const pending = getPendingToolIndexes(5, 1, [1, 3]);
    expect(pending).toEqual([2, 4]);
  });
});
