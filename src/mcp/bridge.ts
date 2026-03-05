import { randomUUID } from 'node:crypto';
import type { DefaultPolicyEngine } from '../policy/engine';
import type { ApprovalDecision } from '../policy/schemas';
import type { ToolSideEffect } from '../tools/schemas';

export type McpBridgeErrorCategory =
  | 'validation'
  | 'policy_denied'
  | 'connection_failed'
  | 'tool_failed'
  | 'timeout'
  | 'internal';

export type McpServerAvailability = 'available' | 'unavailable';
export type McpServerTransport = 'stdio' | 'http' | 'sse' | 'unknown';
export type McpConnectionState = 'connected' | 'failed';
export type McpAuditOperation = 'discover' | 'connect' | 'execute';
export type McpAuditOutcome = 'success' | 'failure' | 'denied';
export type McpDiscoveryDiagnosticCode = 'unreachable' | 'misconfigured' | 'timeout' | 'unknown';

export type McpBridgeError = {
  category: McpBridgeErrorCategory;
  message: string;
  retryable: boolean;
  code?: string;
};

export type McpDiscoveryDiagnostic = {
  code: McpDiscoveryDiagnosticCode;
  message: string;
  retryable: boolean;
};

export type McpServerRecord = {
  serverId: string;
  displayName: string;
  transport: McpServerTransport;
  availability: McpServerAvailability;
  diagnostics?: McpDiscoveryDiagnostic;
  metadata?: Record<string, unknown>;
};

export type McpConnectResult =
  | {
      ok: true;
      state: 'connected';
      correlationId: string;
      serverId: string;
      sessionId: string;
      connectedAt: string;
      reusedSession: boolean;
      metadata?: Record<string, unknown>;
    }
  | {
      ok: false;
      state: 'failed';
      correlationId: string;
      serverId: string;
      error: McpBridgeError;
    };

export type McpExecuteRequest = {
  serverId: string;
  toolName: string;
  input: Record<string, unknown>;
  sideEffect?: ToolSideEffect;
  mode?: 'interactive' | 'automation';
  approvalGranted?: boolean;
  timeoutMs?: number;
  correlationId?: string;
};

export type McpExecutionEnvelope = {
  ok: boolean;
  correlationId: string;
  serverId: string;
  toolName: string;
  outputSummary: string;
  output?: unknown;
  policyDecision: ApprovalDecision | null;
  error: McpBridgeError | null;
  timing: {
    startedAt: string;
    endedAt: string;
    durationMs: number;
  };
};

export type McpAuditEvent = {
  operation: McpAuditOperation;
  outcome: McpAuditOutcome;
  correlationId: string;
  serverId?: string;
  toolName?: string;
  policyDecision?: {
    allowed: boolean;
    requiresApproval: boolean;
    reason: string;
    decision: ApprovalDecision['decision'];
    sideEffect: ToolSideEffect;
  };
  error?: McpBridgeError;
  metadata?: Record<string, unknown>;
  timing: {
    startedAt: string;
    endedAt: string;
    durationMs: number;
  };
};

export type McpBridgeSession = {
  id: string;
  serverId: string;
  metadata?: Record<string, unknown>;
};

export type McpDiscoveryResult = {
  correlationId: string;
  servers: McpServerRecord[];
};

export type McpInvokeResult = {
  output: unknown;
  metadata?: Record<string, unknown>;
};

export interface McpServerAdapter {
  discover(): Promise<McpServerRecord[]>;
  connect(serverId: string): Promise<McpBridgeSession>;
  isSessionHealthy(session: McpBridgeSession): Promise<boolean>;
  invoke(
    session: McpBridgeSession,
    toolName: string,
    input: Record<string, unknown>,
    timeoutMs?: number
  ): Promise<McpInvokeResult>;
}

export interface McpAuditSink {
  append(event: McpAuditEvent): Promise<void> | void;
}

export interface McpBridge {
  discover(correlationId?: string): Promise<McpDiscoveryResult>;
  connect(serverId: string, correlationId?: string): Promise<McpConnectResult>;
  execute(request: McpExecuteRequest): Promise<McpExecutionEnvelope>;
}

type BridgeDeps = {
  adapter: McpServerAdapter;
  policyEngine: DefaultPolicyEngine;
  auditSink?: McpAuditSink;
  now?: () => Date;
  correlationIdFactory?: () => string;
};

const SENSITIVE_KEY_PATTERN = /(token|secret|password|authorization|api[-_]?key|cookie)/i;
const MAX_SUMMARY_LENGTH = 500;

function createCorrelationId(): string {
  return `mcp-${randomUUID()}`;
}

function classifyError(
  error: unknown,
  fallback: McpBridgeErrorCategory = 'internal'
): McpBridgeError {
  if (error instanceof Error) {
    const lowerMessage = error.message.toLowerCase();
    if (lowerMessage.includes('timeout')) {
      return {
        category: 'timeout',
        message: error.message,
        retryable: true,
        code: 'timeout',
      };
    }
    if (lowerMessage.includes('policy')) {
      return {
        category: 'policy_denied',
        message: error.message,
        retryable: false,
        code: 'policy_denied',
      };
    }
    if (lowerMessage.includes('connect') || lowerMessage.includes('session')) {
      return {
        category: 'connection_failed',
        message: error.message,
        retryable: true,
        code: 'connection_failed',
      };
    }
    if (lowerMessage.includes('tool') || lowerMessage.includes('invoke')) {
      return {
        category: 'tool_failed',
        message: error.message,
        retryable: true,
        code: 'tool_failed',
      };
    }
    return {
      category: fallback,
      message: error.message,
      retryable:
        fallback === 'timeout' || fallback === 'connection_failed' || fallback === 'tool_failed',
      code: fallback,
    };
  }

  return {
    category: fallback,
    message: String(error),
    retryable:
      fallback === 'timeout' || fallback === 'connection_failed' || fallback === 'tool_failed',
    code: fallback,
  };
}

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 3) {
    return '[redacted:depth-limit]';
  }
  if (typeof value === 'string') {
    return value.length > 256 ? `${value.slice(0, 256)}...[truncated]` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => redactValue(entry, depth + 1));
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    let count = 0;
    for (const [key, entry] of Object.entries(value)) {
      if (count >= 20) {
        output.__truncated__ = true;
        break;
      }
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = '[redacted:sensitive]';
      } else {
        output[key] = redactValue(entry, depth + 1);
      }
      count += 1;
    }
    return output;
  }
  return value;
}

function summarizePayload(value: unknown): string {
  let preview: string;
  try {
    preview = JSON.stringify(redactValue(value));
  } catch {
    preview = '[unserializable]';
  }
  if (preview.length > MAX_SUMMARY_LENGTH) {
    return `${preview.slice(0, MAX_SUMMARY_LENGTH)}...[truncated]`;
  }
  return preview;
}

function durationMs(startedAt: Date, endedAt: Date): number {
  return Math.max(0, endedAt.getTime() - startedAt.getTime());
}

function toPolicySnapshot(decision: ApprovalDecision): McpAuditEvent['policyDecision'] {
  return {
    allowed: decision.allowed,
    requiresApproval: decision.requiresApproval,
    reason: decision.reason,
    decision: decision.decision,
    sideEffect: decision.sideEffect,
  };
}

export class McpBridgeService implements McpBridge {
  private readonly sessions = new Map<string, McpBridgeSession>();
  private readonly now: () => Date;
  private readonly correlationIdFactory: () => string;

  constructor(private readonly deps: BridgeDeps) {
    this.now = deps.now ?? (() => new Date());
    this.correlationIdFactory = deps.correlationIdFactory ?? createCorrelationId;
  }

  async discover(correlationId = this.correlationIdFactory()): Promise<McpDiscoveryResult> {
    const startedAt = this.now();
    let outcome: McpAuditOutcome = 'success';
    let metadata: Record<string, unknown> = {};
    let error: McpBridgeError | undefined;

    try {
      const servers = await this.deps.adapter.discover();
      const normalized = [...servers].sort((left, right) =>
        left.serverId.localeCompare(right.serverId)
      );
      metadata = {
        serverCount: normalized.length,
        unavailableCount: normalized.filter((server) => server.availability === 'unavailable')
          .length,
      };
      return {
        correlationId,
        servers: normalized,
      };
    } catch (caught) {
      outcome = 'failure';
      error = classifyError(caught, 'internal');
      throw caught;
    } finally {
      const endedAt = this.now();
      await this.emitAudit({
        operation: 'discover',
        outcome,
        correlationId,
        metadata: {
          ...metadata,
        },
        error,
        timing: {
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationMs: durationMs(startedAt, endedAt),
        },
      });
    }
  }

  async connect(
    serverId: string,
    correlationId = this.correlationIdFactory()
  ): Promise<McpConnectResult> {
    const startedAt = this.now();
    if (!serverId.trim()) {
      const endedAt = this.now();
      const error: McpBridgeError = {
        category: 'validation',
        message: 'serverId is required',
        retryable: false,
        code: 'server_id_required',
      };
      await this.emitAudit({
        operation: 'connect',
        outcome: 'failure',
        correlationId,
        serverId,
        error,
        timing: {
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationMs: durationMs(startedAt, endedAt),
        },
      });
      return {
        ok: false,
        state: 'failed',
        correlationId,
        serverId,
        error,
      };
    }

    const existingSession = this.sessions.get(serverId);
    if (existingSession) {
      try {
        const healthy = await this.deps.adapter.isSessionHealthy(existingSession);
        if (healthy) {
          const endedAt = this.now();
          await this.emitAudit({
            operation: 'connect',
            outcome: 'success',
            correlationId,
            serverId,
            metadata: {
              sessionId: existingSession.id,
              reusedSession: true,
            },
            timing: {
              startedAt: startedAt.toISOString(),
              endedAt: endedAt.toISOString(),
              durationMs: durationMs(startedAt, endedAt),
            },
          });
          return {
            ok: true,
            state: 'connected',
            correlationId,
            serverId,
            sessionId: existingSession.id,
            connectedAt: endedAt.toISOString(),
            reusedSession: true,
            metadata: existingSession.metadata,
          };
        }
      } catch {
        // If health checks fail, force a reconnection attempt.
      }
    }

    try {
      const session = await this.deps.adapter.connect(serverId);
      this.sessions.set(serverId, session);
      const endedAt = this.now();
      await this.emitAudit({
        operation: 'connect',
        outcome: 'success',
        correlationId,
        serverId,
        metadata: {
          sessionId: session.id,
          reusedSession: false,
        },
        timing: {
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationMs: durationMs(startedAt, endedAt),
        },
      });
      return {
        ok: true,
        state: 'connected',
        correlationId,
        serverId,
        sessionId: session.id,
        connectedAt: endedAt.toISOString(),
        reusedSession: false,
        metadata: session.metadata,
      };
    } catch (caught) {
      const endedAt = this.now();
      const classified = classifyError(caught, 'connection_failed');
      const error: McpBridgeError =
        classified.category === 'timeout'
          ? {
              category: 'connection_failed',
              message: classified.message,
              retryable: true,
              code: 'timeout',
            }
          : classified;
      await this.emitAudit({
        operation: 'connect',
        outcome: 'failure',
        correlationId,
        serverId,
        error,
        timing: {
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationMs: durationMs(startedAt, endedAt),
        },
      });
      return {
        ok: false,
        state: 'failed',
        correlationId,
        serverId,
        error,
      };
    }
  }

  async execute(request: McpExecuteRequest): Promise<McpExecutionEnvelope> {
    const correlationId = request.correlationId ?? this.correlationIdFactory();
    const startedAt = this.now();
    const validationError = this.validateExecuteRequest(request);
    if (validationError) {
      const endedAt = this.now();
      const envelope: McpExecutionEnvelope = {
        ok: false,
        correlationId,
        serverId: request.serverId,
        toolName: request.toolName,
        outputSummary: '',
        policyDecision: null,
        error: validationError,
        timing: {
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationMs: durationMs(startedAt, endedAt),
        },
      };
      await this.emitAudit({
        operation: 'execute',
        outcome: 'failure',
        correlationId,
        serverId: request.serverId,
        toolName: request.toolName,
        error: validationError,
        timing: envelope.timing,
      });
      return envelope;
    }

    const policyDecision = this.deps.policyEngine.evaluateToolInvocation({
      invocation: {
        tool: `mcp:${request.serverId}:${request.toolName}`,
        params: request.input,
        sideEffect: request.sideEffect ?? 'network',
        policyTag: 'mcp',
      },
      mode: request.mode ?? 'interactive',
      approvalGranted: request.approvalGranted ?? false,
    });

    if (!policyDecision.allowed || (policyDecision.requiresApproval && !request.approvalGranted)) {
      const endedAt = this.now();
      const error: McpBridgeError = {
        category: 'policy_denied',
        message: policyDecision.reason,
        retryable: false,
        code: 'policy_denied',
      };
      const envelope: McpExecutionEnvelope = {
        ok: false,
        correlationId,
        serverId: request.serverId,
        toolName: request.toolName,
        outputSummary: 'Execution denied by policy',
        policyDecision,
        error,
        timing: {
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationMs: durationMs(startedAt, endedAt),
        },
      };
      await this.emitAudit({
        operation: 'execute',
        outcome: 'denied',
        correlationId,
        serverId: request.serverId,
        toolName: request.toolName,
        policyDecision: toPolicySnapshot(policyDecision),
        error,
        metadata: {
          input: summarizePayload(request.input),
        },
        timing: envelope.timing,
      });
      return envelope;
    }

    const connectResult = await this.connect(request.serverId, correlationId);
    if (!connectResult.ok) {
      const endedAt = this.now();
      const envelope: McpExecutionEnvelope = {
        ok: false,
        correlationId,
        serverId: request.serverId,
        toolName: request.toolName,
        outputSummary: 'Failed to connect to MCP server',
        policyDecision,
        error: connectResult.error,
        timing: {
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationMs: durationMs(startedAt, endedAt),
        },
      };
      await this.emitAudit({
        operation: 'execute',
        outcome: 'failure',
        correlationId,
        serverId: request.serverId,
        toolName: request.toolName,
        policyDecision: toPolicySnapshot(policyDecision),
        error: connectResult.error,
        metadata: {
          input: summarizePayload(request.input),
        },
        timing: envelope.timing,
      });
      return envelope;
    }

    try {
      const session = this.sessions.get(request.serverId);
      if (!session) {
        throw new Error('Connection session missing after successful connect');
      }

      const invokeResult = await this.deps.adapter.invoke(
        session,
        request.toolName,
        request.input,
        request.timeoutMs
      );
      const endedAt = this.now();
      const envelope: McpExecutionEnvelope = {
        ok: true,
        correlationId,
        serverId: request.serverId,
        toolName: request.toolName,
        output: invokeResult.output,
        outputSummary: summarizePayload(invokeResult.output),
        policyDecision,
        error: null,
        timing: {
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationMs: durationMs(startedAt, endedAt),
        },
      };
      await this.emitAudit({
        operation: 'execute',
        outcome: 'success',
        correlationId,
        serverId: request.serverId,
        toolName: request.toolName,
        policyDecision: toPolicySnapshot(policyDecision),
        metadata: {
          input: summarizePayload(request.input),
          output: envelope.outputSummary,
          ...invokeResult.metadata,
        },
        timing: envelope.timing,
      });
      return envelope;
    } catch (caught) {
      const endedAt = this.now();
      const error = classifyError(caught, 'tool_failed');
      const envelope: McpExecutionEnvelope = {
        ok: false,
        correlationId,
        serverId: request.serverId,
        toolName: request.toolName,
        outputSummary: '',
        policyDecision,
        error,
        timing: {
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationMs: durationMs(startedAt, endedAt),
        },
      };
      await this.emitAudit({
        operation: 'execute',
        outcome: 'failure',
        correlationId,
        serverId: request.serverId,
        toolName: request.toolName,
        policyDecision: toPolicySnapshot(policyDecision),
        error,
        metadata: {
          input: summarizePayload(request.input),
        },
        timing: envelope.timing,
      });
      return envelope;
    }
  }

  private validateExecuteRequest(input: McpExecuteRequest): McpBridgeError | null {
    if (!input.serverId.trim()) {
      return {
        category: 'validation',
        message: 'serverId is required',
        retryable: false,
        code: 'server_id_required',
      };
    }
    if (!input.toolName.trim()) {
      return {
        category: 'validation',
        message: 'toolName is required',
        retryable: false,
        code: 'tool_name_required',
      };
    }
    if (!input.input || typeof input.input !== 'object' || Array.isArray(input.input)) {
      return {
        category: 'validation',
        message: 'input must be an object',
        retryable: false,
        code: 'invalid_input',
      };
    }
    return null;
  }

  private async emitAudit(event: McpAuditEvent): Promise<void> {
    await this.deps.auditSink?.append(event);
  }
}
