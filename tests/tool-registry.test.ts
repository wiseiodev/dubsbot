import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultApprovalPolicy } from '../src/policy/defaults';
import { DefaultPolicyEngine } from '../src/policy/engine';
import { ToolRegistry } from '../src/tools/registry';

describe('ToolRegistry AGENTS runtime actions', () => {
  it('registers AGENTS commands as invokable actions', async () => {
    const registry = new ToolRegistry({
      agentsConfig: {
        commands: [{ name: 'test', command: 'printf "ok"' }],
        hooks: [],
        warnings: [],
      },
    });

    const prefixed = await registry.invoke({
      tool: 'agents:test',
      sideEffect: 'read',
      params: {},
    });
    const alias = await registry.invoke({
      tool: 'test',
      sideEffect: 'read',
      params: {},
    });

    expect(prefixed.ok).toBe(true);
    expect(alias.ok).toBe(true);
    expect(prefixed.payload.actionName).toBe('test');
    expect(prefixed.payload.resolvedCommand).toBe('printf "ok"');
  });

  it('returns deterministic not-found response for unknown AGENTS command identifier', async () => {
    const registry = new ToolRegistry();

    const result = await registry.invoke({
      tool: 'agents:missing-command',
      sideEffect: 'read',
      params: {},
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toContain('AGENTS command not found');
    expect(result.exitCode).toBe(127);
  });

  it('requires interactive approval for mutating AGENTS commands', async () => {
    const registry = new ToolRegistry({
      policyEngine: new DefaultPolicyEngine(createDefaultApprovalPolicy()),
      defaultMode: 'interactive',
      agentsConfig: {
        commands: [{ name: 'fix', command: 'echo hi > tmp.txt' }],
        hooks: [],
        warnings: [],
      },
    });

    const result = await registry.invoke({
      tool: 'agents:fix',
      sideEffect: 'read',
      params: {},
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toContain('Approval required');
    expect(result.payload.policyOutcome).toMatchObject({
      requiresApproval: true,
      sideEffect: 'write',
    });
  });

  it('allows automation write execution when command matches allowlist', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'dubsbot-tool-registry-'));
    try {
      const registry = new ToolRegistry({
        policyEngine: new DefaultPolicyEngine(
          createDefaultApprovalPolicy({
            automationWriteAllowlist: ['echo hi > ./tmp.txt'],
          })
        ),
        defaultMode: 'automation',
        agentsConfig: {
          commands: [{ name: 'fix', command: 'echo hi > ./tmp.txt' }],
          hooks: [],
          warnings: [],
        },
      });

      const result = await registry.invoke({
        tool: 'agents:fix',
        sideEffect: 'read',
        params: { cwd },
      });

      expect(result.ok).toBe(true);
      expect(result.payload.policyOutcome).toMatchObject({
        allowed: true,
        requiresApproval: false,
        sideEffect: 'write',
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('passes invocation cwd into policy evaluation', async () => {
    const cwd = '/tmp/custom-workdir';
    const evaluateCommand = vi.fn().mockReturnValue({
      allowed: false,
      requiresApproval: true,
      reason: 'Approval required for side effect: write',
      sideEffect: 'write',
    });
    const registry = new ToolRegistry({
      policyEngine: { evaluateCommand } as unknown as DefaultPolicyEngine,
      defaultMode: 'automation',
      agentsConfig: {
        commands: [{ name: 'fix', command: 'echo hi > ./tmp.txt' }],
        hooks: [],
        warnings: [],
      },
    });

    await registry.invoke({
      tool: 'agents:fix',
      sideEffect: 'read',
      params: { cwd },
    });

    expect(evaluateCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd,
      })
    );
  });

  it('uses conservative side effect for exec-command policy checks', async () => {
    const registry = new ToolRegistry({
      policyEngine: new DefaultPolicyEngine(createDefaultApprovalPolicy()),
      defaultMode: 'interactive',
    });

    const result = await registry.invoke({
      tool: 'exec-command',
      sideEffect: 'read',
      params: {
        command: 'echo hi > ./tmp.txt',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.payload.policyOutcome).toMatchObject({
      allowed: false,
      requiresApproval: true,
      sideEffect: 'write',
    });
  });

  it('returns policy denial and structured payload for blocked commands', async () => {
    const registry = new ToolRegistry({
      policyEngine: new DefaultPolicyEngine(
        createDefaultApprovalPolicy({
          blockedCommandPatterns: ['dangerous-command'],
        })
      ),
      agentsConfig: {
        commands: [{ name: 'explode', command: 'dangerous-command --now' }],
        hooks: [],
        warnings: [],
      },
    });

    const result = await registry.invoke({
      tool: 'agents:explode',
      sideEffect: 'read',
      params: {},
    });

    expect(result.ok).toBe(false);
    expect(result.payload).toMatchObject({
      actionName: 'explode',
      resolvedCommand: 'dangerous-command --now',
      executionSummary: expect.stringContaining('denied'),
    });
    expect(result.payload.policyOutcome).toMatchObject({
      allowed: false,
      requiresApproval: false,
      reason: expect.stringContaining('blocked pattern'),
    });
  });

  it('captures structured execution summary on success', async () => {
    const registry = new ToolRegistry({
      policyEngine: new DefaultPolicyEngine(createDefaultApprovalPolicy()),
      agentsConfig: {
        commands: [{ name: 'hello', command: 'printf "hello"' }],
        hooks: [],
        warnings: [],
      },
    });

    const result = await registry.invoke(
      {
        tool: 'agents:hello',
        sideEffect: 'read',
        params: {},
      },
      {
        mode: 'interactive',
      }
    );

    expect(result.ok).toBe(true);
    expect(result.payload).toMatchObject({
      actionName: 'hello',
      resolvedCommand: 'printf "hello"',
      executionSummary: 'Command succeeded',
    });
    expect(result.payload.policyOutcome).toMatchObject({
      allowed: true,
      requiresApproval: false,
      sideEffect: 'read',
    });
  });
});
