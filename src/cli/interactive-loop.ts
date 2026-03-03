import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ToolInvocation } from '../tools/schemas';

export type InteractiveLoopPhase =
  | 'initializing'
  | 'planning'
  | 'awaiting_approval'
  | 'executing'
  | 'interrupted'
  | 'resuming'
  | 'completed'
  | 'failed';

export type LegacyLoopSignal =
  | 'turn_started'
  | 'planning_started'
  | 'awaiting_approval'
  | 'execution_started'
  | 'resume_started'
  | 'turn_completed'
  | 'turn_failed';

export type ApprovalOutcome = 'approved' | 'denied' | 'dismissed';

export type LoopEventType =
  | 'lifecycle_transition'
  | 'invalid_transition'
  | 'interrupt_requested'
  | 'interrupt_handled'
  | 'checkpoint_saved'
  | 'checkpoint_restored'
  | 'approval_decision'
  | 'legacy_signal_mapped';

export type LoopEvent = {
  timestamp: string;
  sessionId: string;
  type: LoopEventType;
  payload: Record<string, unknown>;
};

export type LoopCheckpoint = {
  sessionId: string;
  phase: InteractiveLoopPhase;
  lastUserMessage: string;
  assistantMessage: string;
  toolPlan: ToolInvocation[];
  nextToolIndex: number;
  completedToolIndexes: number[];
};

const PHASE_TRANSITIONS: Record<InteractiveLoopPhase, InteractiveLoopPhase[]> = {
  initializing: ['planning', 'failed'],
  planning: ['awaiting_approval', 'executing', 'completed', 'failed'],
  awaiting_approval: ['planning', 'executing', 'interrupted', 'completed', 'failed'],
  executing: ['awaiting_approval', 'interrupted', 'completed', 'failed'],
  interrupted: ['resuming', 'completed', 'failed'],
  resuming: ['executing', 'failed'],
  completed: [],
  failed: [],
};

export function mapLegacySignalToPhase(signal: LegacyLoopSignal): InteractiveLoopPhase {
  const mapping: Record<LegacyLoopSignal, InteractiveLoopPhase> = {
    turn_started: 'initializing',
    planning_started: 'planning',
    awaiting_approval: 'awaiting_approval',
    execution_started: 'executing',
    resume_started: 'resuming',
    turn_completed: 'completed',
    turn_failed: 'failed',
  };

  return mapping[signal];
}

export function isSensitiveAction(invocation: ToolInvocation): boolean {
  return invocation.sideEffect === 'write' || invocation.sideEffect === 'destructive';
}

export function resolveApprovalOutcome(input: string): ApprovalOutcome | null {
  const normalized = input.trim().toLowerCase();
  if (
    normalized === '/approve' ||
    normalized === 'approve' ||
    normalized === 'y' ||
    normalized === 'yes'
  ) {
    return 'approved';
  }

  if (
    normalized === '/deny' ||
    normalized === 'deny' ||
    normalized === 'n' ||
    normalized === 'no'
  ) {
    return 'denied';
  }

  if (
    normalized === '/dismiss' ||
    normalized === 'dismiss' ||
    normalized === '/skip' ||
    normalized === 'skip'
  ) {
    return 'dismissed';
  }

  return null;
}

export function getPhaseDisplayName(phase: InteractiveLoopPhase): string {
  return phase.replace(/_/g, ' ');
}

export function canTransitionPhase(from: InteractiveLoopPhase, to: InteractiveLoopPhase): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}

export function getPendingToolIndexes(
  toolPlanLength: number,
  nextToolIndex: number,
  completedToolIndexes: number[]
): number[] {
  const completed = new Set(completedToolIndexes);
  const pending: number[] = [];
  for (let index = nextToolIndex; index < toolPlanLength; index += 1) {
    if (!completed.has(index)) {
      pending.push(index);
    }
  }
  return pending;
}

export class LoopCheckpointStore {
  private readonly path: string;

  constructor(sessionId: string, path?: string) {
    this.path = path ?? join(homedir(), '.dubsbot', 'state', `interactive-loop-${sessionId}.json`);
  }

  getPath(): string {
    return this.path;
  }

  async save(checkpoint: LoopCheckpoint): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(checkpoint, null, 2), 'utf8');
  }

  async load(): Promise<LoopCheckpoint | null> {
    try {
      const raw = await readFile(this.path, 'utf8');
      return JSON.parse(raw) as LoopCheckpoint;
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      await rm(this.path);
    } catch {
      // noop
    }
  }
}

export class InteractiveLoopLifecycle {
  private phase: InteractiveLoopPhase = 'initializing';
  private interruptPending = false;

  constructor(
    private readonly sessionId: string,
    private readonly onEvent?: (event: LoopEvent) => Promise<void> | void
  ) {}

  getPhase(): InteractiveLoopPhase {
    return this.phase;
  }

  hydratePhase(phase: InteractiveLoopPhase): void {
    this.phase = phase;
  }

  isInterruptPending(): boolean {
    return this.interruptPending;
  }

  async mapLegacySignal(signal: LegacyLoopSignal): Promise<InteractiveLoopPhase> {
    const phase = mapLegacySignalToPhase(signal);
    await this.emit('legacy_signal_mapped', {
      signal,
      mappedPhase: phase,
    });
    return phase;
  }

  async transitionTo(next: InteractiveLoopPhase): Promise<boolean> {
    const previous = this.phase;
    if (!canTransitionPhase(previous, next)) {
      await this.emit('invalid_transition', {
        from: previous,
        to: next,
      });
      this.phase = 'failed';
      await this.emit('lifecycle_transition', {
        from: previous,
        to: 'failed',
        reason: 'invalid_transition',
      });
      return false;
    }

    this.phase = next;
    await this.emit('lifecycle_transition', {
      from: previous,
      to: next,
    });
    return true;
  }

  async requestInterrupt(): Promise<void> {
    this.interruptPending = true;
    await this.emit('interrupt_requested', {
      phase: this.phase,
    });
  }

  async handleInterruptAtCheckpoint(): Promise<boolean> {
    if (!this.interruptPending) {
      return false;
    }

    this.interruptPending = false;
    await this.transitionTo('interrupted');
    await this.emit('interrupt_handled', {
      phase: this.phase,
    });
    return true;
  }

  async recordCheckpointSaved(checkpoint: LoopCheckpoint): Promise<void> {
    await this.emit('checkpoint_saved', {
      phase: checkpoint.phase,
      nextToolIndex: checkpoint.nextToolIndex,
      completedToolIndexes: checkpoint.completedToolIndexes,
    });
  }

  async recordCheckpointRestored(checkpoint: LoopCheckpoint): Promise<void> {
    await this.emit('checkpoint_restored', {
      phase: checkpoint.phase,
      nextToolIndex: checkpoint.nextToolIndex,
      completedToolIndexes: checkpoint.completedToolIndexes,
    });
  }

  async recordApprovalDecision(input: {
    invocation: ToolInvocation;
    outcome: ApprovalOutcome;
    reason?: string;
  }): Promise<void> {
    await this.emit('approval_decision', {
      tool: input.invocation.tool,
      sideEffect: input.invocation.sideEffect,
      outcome: input.outcome,
      reason: input.reason ?? '',
    });
  }

  private async emit(type: LoopEventType, payload: Record<string, unknown>): Promise<void> {
    if (!this.onEvent) {
      return;
    }

    await this.onEvent({
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      type,
      payload,
    });
  }
}
