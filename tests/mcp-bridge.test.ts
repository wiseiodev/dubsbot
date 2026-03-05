import { describe, expect, it, vi } from 'vitest';
import { type McpAuditEvent, McpBridgeService, type McpServerAdapter } from '../src/mcp/bridge';
import { createDefaultApprovalPolicy } from '../src/policy/defaults';
import { DefaultPolicyEngine } from '../src/policy/engine';

function createAdapter(overrides: Partial<McpServerAdapter> = {}): McpServerAdapter {
  return {
    discover: async () => [],
    connect: async (serverId) => ({
      id: `session-${serverId}`,
      serverId,
    }),
    isSessionHealthy: async () => true,
    invoke: async (_session, toolName, input) => ({
      output: {
        toolName,
        input,
      },
    }),
    ...overrides,
  };
}

describe('McpBridgeService', () => {
  it('normalizes discovery response ordering and diagnostics metadata', async () => {
    const bridge = new McpBridgeService({
      adapter: createAdapter({
        discover: async () => [
          {
            serverId: 'zeta',
            displayName: 'Zeta',
            transport: 'stdio',
            availability: 'unavailable',
            diagnostics: {
              code: 'unreachable',
              message: 'Handshake failed',
              retryable: true,
            },
          },
          {
            serverId: 'alpha',
            displayName: 'Alpha',
            transport: 'http',
            availability: 'available',
          },
        ],
      }),
      policyEngine: new DefaultPolicyEngine(createDefaultApprovalPolicy()),
      correlationIdFactory: () => 'corr-discovery',
    });

    const result = await bridge.discover();

    expect(result.correlationId).toBe('corr-discovery');
    expect(result.servers.map((server) => server.serverId)).toEqual(['alpha', 'zeta']);
    expect(result.servers[1]?.diagnostics).toMatchObject({
      code: 'unreachable',
      retryable: true,
    });
  });

  it('returns explicit failed connection state with standardized classification', async () => {
    const bridge = new McpBridgeService({
      adapter: createAdapter({
        connect: async () => {
          throw new Error('connection timeout while opening session');
        },
      }),
      policyEngine: new DefaultPolicyEngine(createDefaultApprovalPolicy()),
      correlationIdFactory: () => 'corr-connect',
    });

    const result = await bridge.connect('server-a');

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      state: 'failed',
      correlationId: 'corr-connect',
      serverId: 'server-a',
      error: {
        category: 'connection_failed',
        code: 'timeout',
      },
    });
  });

  it('validates execute input and returns a normalized validation envelope', async () => {
    const bridge = new McpBridgeService({
      adapter: createAdapter(),
      policyEngine: new DefaultPolicyEngine(createDefaultApprovalPolicy()),
      correlationIdFactory: () => 'corr-validation',
    });

    const envelope = await bridge.execute({
      serverId: '',
      toolName: '',
      input: {},
    });

    expect(envelope.ok).toBe(false);
    expect(envelope.correlationId).toBe('corr-validation');
    expect(envelope.error).toMatchObject({
      category: 'validation',
      code: 'server_id_required',
    });
  });

  it('short-circuits on denied policy decisions and never invokes the MCP provider', async () => {
    const invoke = vi.fn(async () => ({ output: { ok: true } }));
    const bridge = new McpBridgeService({
      adapter: createAdapter({
        invoke,
      }),
      policyEngine: new DefaultPolicyEngine(
        createDefaultApprovalPolicy({
          blockedCommandPatterns: ['mcp:server-a:danger-tool'],
        })
      ),
      correlationIdFactory: () => 'corr-denied',
    });

    const envelope = await bridge.execute({
      serverId: 'server-a',
      toolName: 'danger-tool',
      input: { x: 1 },
      sideEffect: 'network',
    });

    expect(envelope.ok).toBe(false);
    expect(envelope.error).toMatchObject({
      category: 'policy_denied',
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('maps provider failures into standardized tool_failed category', async () => {
    const bridge = new McpBridgeService({
      adapter: createAdapter({
        invoke: async () => {
          throw new Error('tool invoke failed on provider');
        },
      }),
      policyEngine: new DefaultPolicyEngine(
        createDefaultApprovalPolicy({
          requireApprovalFor: [],
        })
      ),
      correlationIdFactory: () => 'corr-exec-fail',
    });

    const envelope = await bridge.execute({
      serverId: 'server-a',
      toolName: 'safe-tool',
      input: { nested: { token: 'secret-value', message: 'ok' } },
      sideEffect: 'read',
    });

    expect(envelope.ok).toBe(false);
    expect(envelope.error).toMatchObject({
      category: 'tool_failed',
    });
  });

  it('reuses only healthy sessions and validates health before reuse', async () => {
    const isSessionHealthy = vi
      .fn<NonNullable<McpServerAdapter['isSessionHealthy']>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const connect = vi
      .fn<NonNullable<McpServerAdapter['connect']>>()
      .mockResolvedValueOnce({ id: 'session-1', serverId: 'srv' })
      .mockResolvedValueOnce({ id: 'session-2', serverId: 'srv' });

    const bridge = new McpBridgeService({
      adapter: createAdapter({
        connect,
        isSessionHealthy,
      }),
      policyEngine: new DefaultPolicyEngine(createDefaultApprovalPolicy()),
      correlationIdFactory: () => 'corr-health',
    });

    const first = await bridge.connect('srv');
    const second = await bridge.connect('srv');
    const third = await bridge.connect('srv');

    expect(first).toMatchObject({ ok: true, reusedSession: false, sessionId: 'session-1' });
    expect(second).toMatchObject({ ok: true, reusedSession: false, sessionId: 'session-2' });
    expect(third).toMatchObject({ ok: true, reusedSession: true, sessionId: 'session-2' });
    expect(connect).toHaveBeenCalledTimes(2);
    expect(isSessionHealthy).toHaveBeenCalledTimes(2);
  });

  it('emits append-only audit events for success, failure, and denied scenarios with timing', async () => {
    const events: McpAuditEvent[] = [];
    const deniedBridge = new McpBridgeService({
      adapter: createAdapter(),
      policyEngine: new DefaultPolicyEngine(
        createDefaultApprovalPolicy({
          blockedCommandPatterns: ['mcp:srv:blocked'],
        })
      ),
      auditSink: {
        append: async (event) => {
          events.push(event);
        },
      },
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      correlationIdFactory: () => 'corr-audit-denied',
    });
    await deniedBridge.execute({
      serverId: 'srv',
      toolName: 'blocked',
      input: { password: 'abc123' },
      sideEffect: 'network',
    });

    const failingBridge = new McpBridgeService({
      adapter: createAdapter({
        connect: async () => {
          throw new Error('connect timeout');
        },
      }),
      policyEngine: new DefaultPolicyEngine(
        createDefaultApprovalPolicy({
          requireApprovalFor: [],
        })
      ),
      auditSink: {
        append: async (event) => {
          events.push(event);
        },
      },
      now: () => new Date('2026-01-01T00:00:01.000Z'),
      correlationIdFactory: () => 'corr-audit-fail',
    });
    await failingBridge.connect('srv');

    const successBridge = new McpBridgeService({
      adapter: createAdapter({
        discover: async () => [
          {
            serverId: 'srv',
            displayName: 'Server',
            transport: 'stdio',
            availability: 'available',
          },
        ],
      }),
      policyEngine: new DefaultPolicyEngine(
        createDefaultApprovalPolicy({
          requireApprovalFor: [],
        })
      ),
      auditSink: {
        append: async (event) => {
          events.push(event);
        },
      },
      now: () => new Date('2026-01-01T00:00:02.000Z'),
      correlationIdFactory: () => 'corr-audit-success',
    });
    await successBridge.discover();

    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(
      events.some((event) => event.operation === 'execute' && event.outcome === 'denied')
    ).toBe(true);
    expect(
      events.some((event) => event.operation === 'connect' && event.outcome === 'failure')
    ).toBe(true);
    expect(
      events.some((event) => event.operation === 'discover' && event.outcome === 'success')
    ).toBe(true);
    for (const event of events) {
      expect(typeof event.correlationId).toBe('string');
      expect(typeof event.timing.startedAt).toBe('string');
      expect(typeof event.timing.endedAt).toBe('string');
      expect(typeof event.timing.durationMs).toBe('number');
    }
  });
});
