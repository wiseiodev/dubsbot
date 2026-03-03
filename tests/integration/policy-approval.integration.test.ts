import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ToolRegistry } from '../../src/tools/registry';
import { createApprovalResponses, createPolicyFixture, createWorkspaceFixture } from './helpers';

describe('integration: policy and approval branches', () => {
  it('approval-granted branch continues and executes expected action', async () => {
    const workspace = await createWorkspaceFixture();
    const target = join(workspace.path, 'approved.txt');

    const registry = new ToolRegistry({
      policyEngine: createPolicyFixture({
        automationWriteAllowlist: [`sh -lc "echo approved > ${target}"`],
      }),
      defaultMode: 'automation',
      agentsConfig: {
        commands: [{ name: 'approve-me', command: `sh -lc "echo approved > ${target}"` }],
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
    const responses = createApprovalResponses();

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

    expect(responses.denies.has('/deny')).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('Approval required');
    await expect(access(target)).rejects.toThrow();

    await workspace.cleanup();
  });
});
