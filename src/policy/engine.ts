import type { ToolInvocation } from '../tools/schemas';
import type { ApprovalDecision, ApprovalPolicy } from './schemas';

export type CommandEvaluationInput = {
  command: string;
  cwd: string;
  mode: 'interactive' | 'automation';
  sideEffect: 'read' | 'write' | 'destructive' | 'network';
};

export class DefaultPolicyEngine {
  constructor(private readonly policy: ApprovalPolicy) {}

  getPolicy(): ApprovalPolicy {
    return this.policy;
  }

  evaluateCommand(input: CommandEvaluationInput): ApprovalDecision {
    for (const pattern of this.policy.blockedCommandPatterns) {
      if (input.command.includes(pattern)) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: `Command matches blocked pattern: ${pattern}`,
          sideEffect: input.sideEffect,
        };
      }
    }

    if (input.mode === 'automation' && input.sideEffect === 'write') {
      const allowed = this.policy.automationWriteAllowlist.some((allowedCommand) =>
        input.command.startsWith(allowedCommand)
      );
      return {
        allowed,
        requiresApproval: !allowed,
        reason: allowed
          ? 'Allowed by automation write allowlist'
          : 'Write action not in automation allowlist',
        sideEffect: input.sideEffect,
      };
    }

    if (this.policy.requireApprovalFor.includes(input.sideEffect)) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: `Approval required for side effect: ${input.sideEffect}`,
        sideEffect: input.sideEffect,
      };
    }

    return {
      allowed: true,
      requiresApproval: false,
      reason: 'Allowed by policy',
      sideEffect: input.sideEffect,
    };
  }

  evaluateToolInvocation(input: {
    invocation: ToolInvocation;
    mode: 'interactive' | 'automation';
  }): ApprovalDecision {
    return this.evaluateCommand({
      command: `${input.invocation.tool} ${JSON.stringify(input.invocation.params)}`,
      cwd: process.cwd(),
      mode: input.mode,
      sideEffect: input.invocation.sideEffect,
    });
  }
}
