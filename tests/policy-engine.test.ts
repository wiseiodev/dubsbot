import { describe, expect, it } from 'vitest';
import { createDefaultApprovalPolicy } from '../src/policy/defaults';
import { DefaultPolicyEngine } from '../src/policy/engine';

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
        automationWriteAllowlist: ['npm test'],
      })
    );

    const decision = engine.evaluateCommand({
      command: 'npm test',
      cwd: '/repo',
      mode: 'automation',
      sideEffect: 'write',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(false);
  });
});
