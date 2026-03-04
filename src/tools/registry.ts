import { z } from 'zod';
import type { AgentsConfig } from '../config/agents-loader';
import type { DefaultPolicyEngine } from '../policy/engine';
import type { ApprovalDecision } from '../policy/schemas';
import { classifyCommandSideEffect, executeCommand } from './exec-command';
import { ToolInvocationSchema, type ToolResult } from './schemas';

export type ToolHandlerContext = {
  invocationTool: string;
  sideEffect: 'read' | 'write' | 'destructive' | 'network';
  mode: 'interactive' | 'automation';
  approvalGranted: boolean;
};

export type ToolHandler = (
  params: Record<string, unknown>,
  context: ToolHandlerContext
) => Promise<ToolResult>;

export type ToolInvokeOptions = {
  mode?: 'interactive' | 'automation';
  approvalGranted?: boolean;
};

export type ToolRegistryOptions = {
  policyEngine?: DefaultPolicyEngine;
  defaultMode?: 'interactive' | 'automation';
  agentsConfig?: AgentsConfig;
  onWarning?: (message: string) => void;
};

const SIDE_EFFECT_RANK: Record<ToolHandlerContext['sideEffect'], number> = {
  read: 0,
  write: 1,
  network: 2,
  destructive: 3,
};

function resolveConservativeSideEffect(
  declared: ToolHandlerContext['sideEffect'],
  inferred: ToolHandlerContext['sideEffect']
): ToolHandlerContext['sideEffect'] {
  return SIDE_EFFECT_RANK[declared] >= SIDE_EFFECT_RANK[inferred] ? declared : inferred;
}

function deniedResult(input: {
  tool: string;
  actionName?: string;
  resolvedCommand: string;
  decision: ApprovalDecision;
  summary: string;
}): ToolResult {
  return {
    tool: input.tool,
    ok: false,
    summary: input.summary,
    payload: {
      actionName: input.actionName ?? input.tool,
      resolvedCommand: input.resolvedCommand,
      policyOutcome: input.decision,
      executionSummary: input.summary,
    },
    stdout: '',
    stderr: input.decision.reason,
    exitCode: 126,
  };
}

export class ToolRegistry {
  private handlers = new Map<string, ToolHandler>();
  private policyEngine?: DefaultPolicyEngine;
  private defaultMode: 'interactive' | 'automation';

  constructor(options: ToolRegistryOptions = {}) {
    this.policyEngine = options.policyEngine;
    this.defaultMode = options.defaultMode ?? 'interactive';

    this.register('exec-command', async (params, context) => {
      const command = z.string().parse(params.command);
      const cwd = z.string().default(process.cwd()).parse(params.cwd);
      const timeoutMs = z.number().int().positive().optional().parse(params.timeoutMs);
      const inferredSideEffect = classifyCommandSideEffect(command);
      const effectiveSideEffect = resolveConservativeSideEffect(
        context.sideEffect,
        inferredSideEffect
      );

      const decision = this.evaluatePolicy({
        command,
        cwd,
        mode: context.mode,
        sideEffect: effectiveSideEffect,
      });
      if (decision && !decision.allowed && !decision.requiresApproval) {
        return deniedResult({
          tool: context.invocationTool,
          resolvedCommand: command,
          decision,
          summary: `Execution denied by policy: ${decision.reason}`,
        });
      }
      if (decision?.requiresApproval && !context.approvalGranted) {
        return deniedResult({
          tool: context.invocationTool,
          resolvedCommand: command,
          decision,
          summary: 'Approval required before command execution',
        });
      }

      const result = await executeCommand({
        command,
        cwd,
        timeoutMs,
        toolName: context.invocationTool,
      });
      return {
        ...result,
        payload: {
          ...result.payload,
          policyOutcome:
            decision ??
            ({
              allowed: true,
              requiresApproval: false,
              reason: 'Policy engine unavailable',
              sideEffect: effectiveSideEffect,
            } satisfies ApprovalDecision),
          executionSummary: result.summary,
        },
      };
    });

    for (const warning of options.agentsConfig?.warnings ?? []) {
      options.onWarning?.(warning.message);
    }

    for (const command of options.agentsConfig?.commands ?? []) {
      this.registerAgentsCommand(command.name, command.command, options.onWarning);
    }
  }

  register(name: string, handler: ToolHandler): void {
    this.handlers.set(name, handler);
  }

  async invoke(raw: unknown, options: ToolInvokeOptions = {}): Promise<ToolResult> {
    const invocation = ToolInvocationSchema.parse(raw);
    const handler = this.handlers.get(invocation.tool);
    const mode = options.mode ?? this.defaultMode;
    const approvalGranted = options.approvalGranted ?? false;
    if (!handler) {
      if (invocation.tool.startsWith('agents:')) {
        const commandName = invocation.tool.slice('agents:'.length);
        return {
          tool: invocation.tool,
          ok: false,
          summary: `AGENTS command not found: ${commandName}`,
          payload: {
            actionName: commandName,
            resolvedCommand: null,
            policyOutcome: null,
            executionSummary: 'Unknown AGENTS command',
          },
          stdout: '',
          stderr: `Unknown AGENTS command: ${commandName}`,
          exitCode: 127,
        };
      }
      return {
        tool: invocation.tool,
        ok: false,
        summary: `No handler registered for ${invocation.tool}`,
        payload: {},
        stdout: '',
        stderr: `No handler for ${invocation.tool}`,
        exitCode: 127,
      };
    }

    return handler(invocation.params, {
      invocationTool: invocation.tool,
      sideEffect: invocation.sideEffect,
      mode,
      approvalGranted,
    });
  }

  private registerAgentsCommand(
    name: string,
    command: string,
    onWarning?: (message: string) => void
  ): void {
    const namespacedTool = `agents:${name}`;

    this.register(namespacedTool, async (params, context) => {
      const cwd = z.string().default(process.cwd()).parse(params.cwd);
      const timeoutMs = z.number().int().positive().optional().parse(params.timeoutMs);
      const resolvedCommand = command;
      const inferredSideEffect = classifyCommandSideEffect(resolvedCommand);
      const decision = this.evaluatePolicy({
        command: resolvedCommand,
        cwd,
        mode: context.mode,
        sideEffect: inferredSideEffect,
      });

      if (decision && !decision.allowed && !decision.requiresApproval) {
        return deniedResult({
          tool: context.invocationTool,
          actionName: name,
          resolvedCommand,
          decision,
          summary: `AGENTS command denied by policy: ${decision.reason}`,
        });
      }

      if (decision?.requiresApproval && !context.approvalGranted) {
        return deniedResult({
          tool: context.invocationTool,
          actionName: name,
          resolvedCommand,
          decision,
          summary: 'Approval required before AGENTS command execution',
        });
      }

      const result = await executeCommand({
        command: resolvedCommand,
        cwd,
        timeoutMs,
        toolName: context.invocationTool,
      });

      return {
        ...result,
        payload: {
          ...result.payload,
          actionName: name,
          resolvedCommand,
          policyOutcome:
            decision ??
            ({
              allowed: true,
              requiresApproval: false,
              reason: 'Policy engine unavailable',
              sideEffect: inferredSideEffect,
            } satisfies ApprovalDecision),
          executionSummary: result.summary,
        },
      };
    });

    if (!this.handlers.has(name)) {
      this.register(
        name,
        async (params, context) =>
          this.handlers.get(namespacedTool)?.(params, context) ??
          Promise.resolve({
            tool: context.invocationTool,
            ok: false,
            summary: `No handler registered for ${context.invocationTool}`,
            payload: {},
            stdout: '',
            stderr: `No handler for ${context.invocationTool}`,
            exitCode: 127,
          })
      );
      return;
    }

    onWarning?.(
      `Skipping unprefixed AGENTS command alias "${name}" because a tool with that name already exists. Use "${namespacedTool}".`
    );
  }

  private evaluatePolicy(input: {
    command: string;
    cwd: string;
    mode: 'interactive' | 'automation';
    sideEffect: 'read' | 'write' | 'destructive' | 'network';
  }): ApprovalDecision | null {
    if (!this.policyEngine) {
      return null;
    }
    return this.policyEngine.evaluateCommand({
      command: input.command,
      cwd: input.cwd,
      mode: input.mode,
      sideEffect: input.sideEffect,
    });
  }
}
