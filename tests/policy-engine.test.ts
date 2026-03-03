import { mkdir, mkdtemp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDefaultApprovalPolicy } from '../src/policy/defaults';
import { DefaultPolicyEngine } from '../src/policy/engine';
import { PolicyReasonCode } from '../src/policy/reason-codes';

describe('DefaultPolicyEngine', () => {
  it('requires approval for mutating commands by default', () => {
    const engine = new DefaultPolicyEngine(createDefaultApprovalPolicy());
    const decision = engine.evaluateCommand({
      command: 'rm -rf src',
      cwd: '/tmp',
      mode: 'interactive',
      sideEffect: 'destructive',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.requiresApproval).toBe(true);
  });

  it('allows safe automation writes when allowlist matches', () => {
    const engine = new DefaultPolicyEngine(
      createDefaultApprovalPolicy({
        automationWriteAllowlist: ['echo ok > ./tmp.txt'],
        pathAllowlistByOperation: {
          write: ['/repo'],
        },
      })
    );

    const decision = engine.evaluateCommand({
      command: 'echo ok > ./tmp.txt',
      cwd: '/repo',
      mode: 'automation',
      sideEffect: 'write',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(false);
  });

  it('reuses scoped approvals only for identical scope', () => {
    const engine = new DefaultPolicyEngine(createDefaultApprovalPolicy());
    const cwd = '/repo';
    const command = 'echo hi > ./tmp.txt';

    const first = engine.evaluateCommand({
      command,
      cwd,
      mode: 'interactive',
      sideEffect: 'write',
    });
    expect(first.requiresApproval).toBe(true);

    const approved = engine.evaluateCommand({
      command,
      cwd,
      mode: 'interactive',
      sideEffect: 'write',
      approvalGranted: true,
    });
    expect(approved.allowed).toBe(true);
    expect(approved.reasonCodes).toContain(PolicyReasonCode.approvalScopeReused);

    const reused = engine.evaluateCommand({
      command,
      cwd,
      mode: 'interactive',
      sideEffect: 'write',
    });
    expect(reused.allowed).toBe(true);
    expect(reused.reasonCodes).toContain(PolicyReasonCode.approvalScopeReused);

    const mismatch = engine.evaluateCommand({
      command: 'echo hi > ./other.txt',
      cwd,
      mode: 'interactive',
      sideEffect: 'write',
    });
    expect(mismatch.allowed).toBe(false);
    expect(mismatch.requiresApproval).toBe(true);
  });

  it('treats expired scoped approval as invalid', async () => {
    const engine = new DefaultPolicyEngine(
      createDefaultApprovalPolicy({
        approvalTtlMs: 1,
      })
    );
    const command = 'echo hi > ./tmp.txt';
    const cwd = '/repo';

    engine.evaluateCommand({
      command,
      cwd,
      mode: 'interactive',
      sideEffect: 'write',
      approvalGranted: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));

    const decision = engine.evaluateCommand({
      command,
      cwd,
      mode: 'interactive',
      sideEffect: 'write',
    });

    expect(decision.requiresApproval).toBe(true);
    expect(decision.reasonCodes).toContain(PolicyReasonCode.approvalExpired);
  });

  it('excludes revoked scoped approvals from reuse', () => {
    const engine = new DefaultPolicyEngine(createDefaultApprovalPolicy());
    const command = 'echo hi > ./tmp.txt';
    const cwd = '/repo';

    const approved = engine.evaluateCommand({
      command,
      cwd,
      mode: 'interactive',
      sideEffect: 'write',
      approvalGranted: true,
    });
    const revoked = engine.revokeApproval(approved.scopeContext.scopeId);
    expect(revoked).toBe(true);

    const decision = engine.evaluateCommand({
      command,
      cwd,
      mode: 'interactive',
      sideEffect: 'write',
    });
    expect(decision.requiresApproval).toBe(true);
    expect(decision.reasonCodes).toContain(PolicyReasonCode.approvalRevoked);
  });

  it('returns deterministic explanation payload for identical inputs', () => {
    const engine = new DefaultPolicyEngine(createDefaultApprovalPolicy());

    const first = engine.evaluateCommand({
      command: 'ls',
      cwd: '/repo',
      mode: 'interactive',
      sideEffect: 'read',
    });
    const second = engine.evaluateCommand({
      command: 'ls',
      cwd: '/repo',
      mode: 'interactive',
      sideEffect: 'read',
    });

    expect(first).toEqual(second);
  });

  it('enforces canonical path allowlists for automation writes', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'policy-path-'));
    const allowed = join(workspace, 'allowed');
    const denied = join(workspace, 'denied');
    await mkdir(allowed, { recursive: true });
    await mkdir(denied, { recursive: true });
    await symlink(allowed, join(workspace, 'allowed-link')).catch(() => undefined);

    const engine = new DefaultPolicyEngine(
      createDefaultApprovalPolicy({
        pathAllowlistByOperation: {
          write: [allowed],
        },
        automationWriteAllowlist: ['echo hi >'],
      })
    );

    const inAllowlist = engine.evaluateCommand({
      command: `echo hi > ${join(workspace, 'allowed-link', 'file.txt')}`,
      cwd: workspace,
      mode: 'automation',
      sideEffect: 'write',
    });
    expect(inAllowlist.allowed).toBe(true);
    expect(inAllowlist.reasonCodes).toContain(PolicyReasonCode.pathAllowlistMatch);

    const outOfAllowlist = engine.evaluateCommand({
      command: `echo hi > ${join(denied, 'file.txt')}`,
      cwd: workspace,
      mode: 'automation',
      sideEffect: 'write',
    });
    expect(outOfAllowlist.allowed).toBe(false);
    expect(outOfAllowlist.requiresApproval).toBe(false);
    expect(outOfAllowlist.reasonCodes).toContain(PolicyReasonCode.pathOutOfAllowlist);
  });

  it('denies missing allowlist in allowlist-enabled automation mode', () => {
    const engine = new DefaultPolicyEngine(
      createDefaultApprovalPolicy({
        pathAllowlistByOperation: {},
      })
    );

    const decision = engine.evaluateCommand({
      command: 'echo hi > ./tmp.txt',
      cwd: '/repo',
      mode: 'automation',
      sideEffect: 'write',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.requiresApproval).toBe(false);
    expect(decision.reasonCodes).toContain(PolicyReasonCode.missingAllowlist);
  });

  it('falls back to approval-gated flow in interactive mode without allowlist', () => {
    const engine = new DefaultPolicyEngine(
      createDefaultApprovalPolicy({
        pathAllowlistByOperation: {},
      })
    );

    const decision = engine.evaluateCommand({
      command: 'echo hi > ./tmp.txt',
      cwd: '/repo',
      mode: 'interactive',
      sideEffect: 'write',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.requiresApproval).toBe(true);
    expect(decision.reasonCodes).toContain(PolicyReasonCode.approvalRequiredSideEffect);
  });

  it('denies when canonicalization fails for command target path', () => {
    const engine = new DefaultPolicyEngine(
      createDefaultApprovalPolicy({
        pathAllowlistByOperation: {
          write: ['/repo'],
        },
      })
    );

    const decision = engine.evaluateCommand({
      command: `echo hi > "./bad\0path.txt"`,
      cwd: '/repo',
      mode: 'automation',
      sideEffect: 'write',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain(PolicyReasonCode.canonicalizationFailure);
  });
});
