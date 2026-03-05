import { describe, expect, it } from 'vitest';
import { McpBridgeService, type McpServerAdapter } from '../../src/mcp/bridge';
import { createDefaultApprovalPolicy } from '../../src/policy/defaults';
import { DefaultPolicyEngine } from '../../src/policy/engine';

describe('integration: mcp bridge discover/connect/execute flow', () => {
  it('runs end-to-end flow with correlation propagation and normalized envelopes', async () => {
    const adapter: McpServerAdapter = {
      discover: async () => [
        {
          serverId: 'mcp-a',
          displayName: 'MCP A',
          transport: 'stdio',
          availability: 'available',
        },
      ],
      connect: async (serverId) => ({
        id: `session-${serverId}`,
        serverId,
      }),
      isSessionHealthy: async () => true,
      invoke: async (_session, toolName, input) => ({
        output: {
          ok: true,
          toolName,
          echo: input,
        },
      }),
    };

    const bridge = new McpBridgeService({
      adapter,
      policyEngine: new DefaultPolicyEngine(
        createDefaultApprovalPolicy({
          requireApprovalFor: [],
        })
      ),
      correlationIdFactory: () => 'corr-integration',
    });

    const discovered = await bridge.discover();
    const connected = await bridge.connect('mcp-a', discovered.correlationId);
    const executed = await bridge.execute({
      serverId: 'mcp-a',
      toolName: 'echo',
      input: { msg: 'hello' },
      sideEffect: 'read',
      correlationId: discovered.correlationId,
    });

    expect(discovered.servers).toHaveLength(1);
    expect(connected).toMatchObject({
      ok: true,
      state: 'connected',
      correlationId: discovered.correlationId,
      serverId: 'mcp-a',
    });
    expect(executed).toMatchObject({
      ok: true,
      correlationId: discovered.correlationId,
      serverId: 'mcp-a',
      toolName: 'echo',
      error: null,
    });
    expect(executed.output).toMatchObject({
      ok: true,
      toolName: 'echo',
      echo: {
        msg: 'hello',
      },
    });
  });
});
