import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import type { AutomationSpec } from '../../src/automation/schemas';
import { createDefaultApprovalPolicy } from '../../src/policy/defaults';
import { DefaultPolicyEngine } from '../../src/policy/engine';
import type { ApprovalPolicy } from '../../src/policy/schemas';

/**
 * Integration fixture conventions:
 * - Use unique temporary workspaces per test to prevent cross-test side effects.
 * - Prefer policy/approval builders over inline object literals for readability.
 * - Use bounded loop controllers instead of wall-clock sleeps for deterministic loop tests.
 */
export async function createWorkspaceFixture(
  input: { prefix?: string; files?: Record<string, string>; agentsMd?: string } = {}
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const workspace = await mkdtemp(join(tmpdir(), input.prefix ?? 'dubsbot-integration-'));
  const files = input.files ?? {};
  const agentsMd = input.agentsMd ?? '# AGENTS\n\n## Commands\n- test: pnpm test\n';

  await writeFile(join(workspace, 'AGENTS.md'), agentsMd, 'utf8');
  for (const [relativePath, content] of Object.entries(files)) {
    await writeFile(join(workspace, relativePath), content, 'utf8');
  }

  return {
    path: workspace,
    cleanup: async () => {
      await rm(workspace, { recursive: true, force: true });
    },
  };
}

export function createPolicyFixture(overrides: Partial<ApprovalPolicy> = {}): DefaultPolicyEngine {
  return new DefaultPolicyEngine(createDefaultApprovalPolicy(overrides));
}

export function createApprovalResponses(input: { approvals?: string[]; denies?: string[] } = {}): {
  approvals: Set<string>;
  denies: Set<string>;
} {
  return {
    approvals: new Set(input.approvals ?? ['/approve', 'approve', 'yes', 'y']),
    denies: new Set(input.denies ?? ['/deny', 'deny', 'no', 'n']),
  };
}

export function createAutomationTriggerState(input: {
  spec: AutomationSpec;
  eventName?: string;
  startedAt?: string;
}): {
  spec: AutomationSpec;
  eventName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
} {
  return {
    spec: input.spec,
    eventName: input.eventName ?? `${input.spec.trigger.type}:triggered`,
    status: 'pending',
    startedAt: input.startedAt ?? new Date().toISOString(),
    finishedAt: null,
    error: null,
  };
}

export function createLoopController(input: {
  maxIterations: number;
  onTerminate?: (reason: 'max_iterations' | 'fatal_error' | 'manual_stop') => void;
}): {
  tick: () => boolean;
  fail: () => void;
  stop: () => void;
  iterations: () => number;
  isTerminated: () => boolean;
  terminationReason: () => 'max_iterations' | 'fatal_error' | 'manual_stop' | null;
} {
  let count = 0;
  let terminated = false;
  let reason: 'max_iterations' | 'fatal_error' | 'manual_stop' | null = null;

  const terminate = (next: 'max_iterations' | 'fatal_error' | 'manual_stop') => {
    if (terminated) {
      return;
    }
    terminated = true;
    reason = next;
    input.onTerminate?.(next);
  };

  return {
    tick: () => {
      if (terminated) {
        return false;
      }
      count += 1;
      if (count >= input.maxIterations) {
        terminate('max_iterations');
        return false;
      }
      return true;
    },
    fail: () => {
      terminate('fatal_error');
    },
    stop: () => {
      terminate('manual_stop');
    },
    iterations: () => count,
    isTerminated: () => terminated,
    terminationReason: () => reason,
  };
}

export async function expectNoUnauthorizedSideEffect(path: string): Promise<void> {
  const { access } = await import('node:fs/promises');
  await expect(access(path)).rejects.toThrow();
}
