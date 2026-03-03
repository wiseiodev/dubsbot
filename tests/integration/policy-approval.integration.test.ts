import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ToolRegistry } from '../../src/tools/registry';
import { createPolicyFixture, createWorkspaceFixture } from './helpers';

describe('integration: policy and approval branches', () => {
  it('approval-granted branch continues and executes expected action', async () => {
    const workspace = await createWorkspaceFixture();
    const target = join(workspace.path, 'approved.txt');

    const registry = new ToolRegistry({
      policyEngine: createPolicyFixture({
        automationWriteAllowlist: [`echo approved > ${target}`],
        pathAllowlistByOperation: {
          write: [workspace.path],
        },
      }),
      defaultMode: 'automation',
      agentsConfig: {
        commands: [{ name: 'approve-me', command: `echo approved > ${target}` }],
        hooks: [],
        warnings: [],
      },
    });

    const result = await registry.invoke({
      tool: 'agents:approve-me',
      sideEffect: 'read',
      params: {},
    });

    expect(result.ok).toBe(true);
    await expect(access(target)).resolves.toBeUndefined();

    await workspace.cleanup();
  });

  it('approval-denied branch stops at boundary and does not create side effect', async () => {
    const workspace = await createWorkspaceFixture();
    const target = join(workspace.path, 'denied.txt');
    const registry = new ToolRegistry({
      policyEngine: createPolicyFixture(),
      defaultMode: 'interactive',
      agentsConfig: {
        commands: [{ name: 'deny-me', command: `sh -lc "echo denied > ${target}"` }],
        hooks: [],
        warnings: [],
      },
    });

    const result = await registry.invoke({
      tool: 'agents:deny-me',
      sideEffect: 'read',
      params: {},
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toContain('Approval required');
    await expect(access(target)).rejects.toThrow();

    await workspace.cleanup();
  });

  it('reuses scoped approvals for identical scope and enforces allowlist scope boundaries', async () => {
    const workspace = await createWorkspaceFixture();
    const allowedRoot = join(workspace.path, 'safe');
    const deniedRoot = join(workspace.path, 'unsafe');
    await mkdir(allowedRoot, { recursive: true });
    await mkdir(deniedRoot, { recursive: true });

    const policyEngine = createPolicyFixture({
      pathAllowlistByOperation: {
        write: [allowedRoot],
      },
      allowlistPolicyOperations: ['write'],
    });

    const registry = new ToolRegistry({
      policyEngine,
      defaultMode: 'interactive',
    });

    const scopedWrite = {
      tool: 'exec-command',
      sideEffect: 'write' as const,
      params: {
        command: `echo approved > ${join(allowedRoot, 'scoped.txt')}`,
        cwd: workspace.path,
      },
    };

    const first = await registry.invoke(scopedWrite, { mode: 'interactive' });
    expect(first.ok).toBe(false);
    expect(first.payload.policyOutcome).toMatchObject({
      requiresApproval: true,
    });

    const approved = await registry.invoke(scopedWrite, {
      mode: 'interactive',
      approvalGranted: true,
    });
    expect(approved.ok).toBe(true);

    const reused = await registry.invoke(scopedWrite, { mode: 'interactive' });
    expect(reused.ok).toBe(true);
    expect(reused.payload.policyOutcome).toMatchObject({
      allowed: true,
      reasonCodes: expect.arrayContaining(['approval_scope_reused']),
    });

    const outOfScope = await registry.invoke(
      {
        tool: 'exec-command',
        sideEffect: 'write',
        params: {
          command: `echo denied > ${join(deniedRoot, 'denied.txt')}`,
          cwd: workspace.path,
        },
      },
      { mode: 'interactive' }
    );

    expect(outOfScope.ok).toBe(false);
    expect(outOfScope.payload.policyOutcome).toMatchObject({
      allowed: false,
      requiresApproval: false,
      reasonCodes: expect.arrayContaining(['path_out_of_allowlist']),
    });

    await workspace.cleanup();
  });
});
