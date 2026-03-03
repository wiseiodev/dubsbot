import { createHash } from 'node:crypto';
import type { ToolInvocation } from '../tools/schemas';
import {
  canonicalizeGuardedPath,
  extractCommandTargetPaths,
  isWithinAllowedRoots,
} from './path-guard';
import { PolicyReasonCode, type PolicyReasonCodeValue } from './reason-codes';
import type { ApprovalDecision, ApprovalPolicy } from './schemas';
import { type ApprovalScopeContext, InMemoryScopedApprovalStore } from './scoped-approvals';

export type CommandEvaluationInput = {
  command: string;
  cwd: string;
  mode: 'interactive' | 'automation';
  sideEffect: 'read' | 'write' | 'destructive' | 'network';
  approvalGranted?: boolean;
  principal?: string;
};

export class DefaultPolicyEngine {
  private readonly scopedApprovals = new InMemoryScopedApprovalStore();

  constructor(private readonly policy: ApprovalPolicy) {}

  getPolicy(): ApprovalPolicy {
    return this.policy;
  }

  revokeApproval(scopeId: string): boolean {
    return this.scopedApprovals.revoke(scopeId);
  }

  evaluateCommand(input: CommandEvaluationInput): ApprovalDecision {
    const scopeContext = this.buildScopeContext(input);

    for (const pattern of this.policy.blockedCommandPatterns) {
      if (input.command.includes(pattern)) {
        return this.buildDecision({
          input,
          scopeContext,
          decision: 'deny',
          reason: `Command matches blocked pattern: ${pattern}`,
          reasonCodes: [PolicyReasonCode.blockedCommandPattern],
          matchedRules: [`blocked-pattern:${pattern}`],
        });
      }
    }

    const pathGuardResult = this.evaluatePathGuard(input, scopeContext);
    if (pathGuardResult.deniedDecision) {
      return pathGuardResult.deniedDecision;
    }

    const existingApproval = this.scopedApprovals.matchExact(scopeContext);
    if (existingApproval) {
      const expired = new Date(existingApproval.expiresAt).getTime() <= Date.now();
      if (existingApproval.revokedAt) {
        return this.buildDecision({
          input,
          scopeContext: {
            ...scopeContext,
            expiresAt: existingApproval.expiresAt,
            revoked: true,
          },
          decision: 'approval_required',
          reason: 'Scoped approval was revoked; new approval required',
          reasonCodes: [PolicyReasonCode.approvalRevoked],
          matchedRules: ['approval:revoked'],
        });
      }
      if (expired) {
        return this.buildDecision({
          input,
          scopeContext: {
            ...scopeContext,
            expiresAt: existingApproval.expiresAt,
            revoked: false,
          },
          decision: 'approval_required',
          reason: 'Scoped approval expired; new approval required',
          reasonCodes: [PolicyReasonCode.approvalExpired],
          matchedRules: ['approval:expired'],
        });
      }

      return this.buildDecision({
        input,
        scopeContext: {
          ...scopeContext,
          expiresAt: existingApproval.expiresAt,
          revoked: false,
        },
        decision: 'allow',
        reason: 'Allowed by scoped persisted approval',
        reasonCodes: [
          PolicyReasonCode.approvalScopeReused,
          ...(pathGuardResult.enforced ? [PolicyReasonCode.pathAllowlistMatch] : []),
        ],
        matchedRules: ['approval:scope-match'],
      });
    }

    if (input.approvalGranted) {
      const expiresAt = new Date(Date.now() + this.policy.approvalTtlMs).toISOString();
      this.scopedApprovals.save({
        ...scopeContext,
        expiresAt,
      });
      return this.buildDecision({
        input,
        scopeContext: {
          ...scopeContext,
          expiresAt,
          revoked: false,
        },
        decision: 'allow',
        reason: 'Approved and persisted for matching scope',
        reasonCodes: [
          PolicyReasonCode.approvalScopeReused,
          ...(pathGuardResult.enforced ? [PolicyReasonCode.pathAllowlistMatch] : []),
        ],
        matchedRules: ['approval:granted-and-persisted'],
      });
    }

    if (input.mode === 'automation' && input.sideEffect === 'write') {
      const allowed = this.policy.automationWriteAllowlist.some((allowedCommand) =>
        input.command.startsWith(allowedCommand)
      );
      return this.buildDecision({
        input,
        scopeContext,
        decision: allowed ? 'allow' : 'approval_required',
        reason: allowed
          ? 'Allowed by automation write allowlist'
          : 'Write action not in automation allowlist',
        reasonCodes: [
          allowed
            ? PolicyReasonCode.automationAllowlistMatch
            : PolicyReasonCode.automationAllowlistMiss,
          ...(allowed && pathGuardResult.enforced ? [PolicyReasonCode.pathAllowlistMatch] : []),
        ],
        matchedRules: ['automation-write-allowlist'],
      });
    }

    if (this.policy.requireApprovalFor.includes(input.sideEffect)) {
      return this.buildDecision({
        input,
        scopeContext,
        decision: 'approval_required',
        reason: `Approval required for side effect: ${input.sideEffect}`,
        reasonCodes: [PolicyReasonCode.approvalRequiredSideEffect],
        matchedRules: [`require-approval:${input.sideEffect}`],
      });
    }

    return this.buildDecision({
      input,
      scopeContext,
      decision: 'allow',
      reason: 'Allowed by policy',
      reasonCodes: [
        PolicyReasonCode.allowedByPolicy,
        ...(pathGuardResult.enforced ? [PolicyReasonCode.pathAllowlistMatch] : []),
      ],
      matchedRules: ['default-allow'],
    });
  }

  evaluateToolInvocation(input: {
    invocation: ToolInvocation;
    mode: 'interactive' | 'automation';
    approvalGranted?: boolean;
  }): ApprovalDecision {
    return this.evaluateCommand({
      command: `${input.invocation.tool} ${JSON.stringify(input.invocation.params)}`,
      cwd: process.cwd(),
      mode: input.mode,
      sideEffect: input.invocation.sideEffect,
      approvalGranted: input.approvalGranted,
      principal: input.mode === 'automation' ? 'automation-runner' : 'interactive-user',
    });
  }

  private evaluatePathGuard(
    input: CommandEvaluationInput,
    scopeContext: ApprovalScopeContext
  ): { deniedDecision: ApprovalDecision | null; enforced: boolean } {
    const allowlistEnabled = this.shouldEnforceAllowlistFor(input.sideEffect, input.mode);
    if (!allowlistEnabled) {
      return { deniedDecision: null, enforced: false };
    }

    const configuredRoots =
      this.policy.pathAllowlistByOperation[input.sideEffect] ?? this.policy.pathAllowlist;
    if (configuredRoots.length === 0) {
      if (input.mode === 'interactive') {
        return { deniedDecision: null, enforced: false };
      }
      return {
        deniedDecision: this.buildDecision({
          input,
          scopeContext,
          decision: 'deny',
          reason: 'Allowlist policy is enabled but no allowlist is configured for this operation',
          reasonCodes: [PolicyReasonCode.missingAllowlist],
          matchedRules: ['path-allowlist:missing'],
        }),
        enforced: true,
      };
    }

    let canonicalRoots: string[];
    try {
      canonicalRoots = configuredRoots
        .map((root) => canonicalizeGuardedPath(input.cwd, root))
        .sort();
    } catch {
      return {
        deniedDecision: this.buildDecision({
          input,
          scopeContext,
          decision: 'deny',
          reason: 'Allowlist policy could not canonicalize configured roots',
          reasonCodes: [PolicyReasonCode.canonicalizationFailure],
          matchedRules: ['path-allowlist:root-canonicalization-failed'],
        }),
        enforced: true,
      };
    }

    const targetPaths = extractCommandTargetPaths(input.command);
    if (targetPaths.length === 0) {
      return {
        deniedDecision: this.buildDecision({
          input,
          scopeContext,
          decision: 'deny',
          reason: 'Allowlist policy requires explicit target paths for guarded operation',
          reasonCodes: [PolicyReasonCode.missingAllowlist],
          matchedRules: ['path-allowlist:no-target-paths'],
        }),
        enforced: true,
      };
    }

    try {
      const canonicalTargets = targetPaths
        .map((targetPath) => canonicalizeGuardedPath(input.cwd, targetPath))
        .sort();
      const outOfAllowlistPath = canonicalTargets.find(
        (canonicalTarget) => !isWithinAllowedRoots(canonicalTarget, canonicalRoots)
      );
      if (outOfAllowlistPath) {
        return {
          deniedDecision: this.buildDecision({
            input,
            scopeContext,
            decision: 'deny',
            reason: `Path is outside allowed roots: ${outOfAllowlistPath}`,
            reasonCodes: [PolicyReasonCode.pathOutOfAllowlist],
            matchedRules: ['path-allowlist:out-of-scope'],
          }),
          enforced: true,
        };
      }
    } catch {
      return {
        deniedDecision: this.buildDecision({
          input,
          scopeContext,
          decision: 'deny',
          reason: 'Failed to canonicalize one or more command target paths',
          reasonCodes: [PolicyReasonCode.canonicalizationFailure],
          matchedRules: ['path-allowlist:target-canonicalization-failed'],
        }),
        enforced: true,
      };
    }

    return { deniedDecision: null, enforced: true };
  }

  private shouldEnforceAllowlistFor(
    sideEffect: CommandEvaluationInput['sideEffect'],
    mode: CommandEvaluationInput['mode']
  ): boolean {
    if (mode === 'automation' && sideEffect === 'write') {
      return true;
    }
    return this.policy.allowlistPolicyOperations.includes(sideEffect);
  }

  private buildScopeContext(input: CommandEvaluationInput): ApprovalScopeContext {
    const principal =
      input.principal ?? (input.mode === 'automation' ? 'automation-runner' : 'interactive-user');
    const resourceScope = `${input.cwd}::${input.command}`;
    const scopeId = createHash('sha256')
      .update(`${principal}:${input.sideEffect}:${resourceScope}`)
      .digest('hex');

    return {
      principal,
      operationClass: input.sideEffect,
      resourceScope,
      scopeId,
    };
  }

  private buildDecision(input: {
    input: CommandEvaluationInput;
    scopeContext: ApprovalScopeContext & { expiresAt?: string | null; revoked?: boolean };
    decision: 'allow' | 'deny' | 'approval_required';
    reason: string;
    reasonCodes: PolicyReasonCodeValue[];
    matchedRules: string[];
  }): ApprovalDecision {
    return {
      allowed: input.decision === 'allow',
      requiresApproval: input.decision === 'approval_required',
      reason: input.reason,
      sideEffect: input.input.sideEffect,
      decision: input.decision,
      matchedRules: [...input.matchedRules].sort(),
      scopeContext: {
        principal: input.scopeContext.principal,
        operationClass: input.scopeContext.operationClass,
        resourceScope: input.scopeContext.resourceScope,
        scopeId: input.scopeContext.scopeId,
        expiresAt: input.scopeContext.expiresAt ?? null,
        revoked: input.scopeContext.revoked ?? false,
      },
      reasonCodes: [...input.reasonCodes].sort(),
    };
  }
}
