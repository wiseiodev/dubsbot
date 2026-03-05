import { randomUUID } from 'node:crypto';
import type {
  McpBridgeSession,
  McpInvokeResult,
  McpServerAdapter,
  McpServerRecord,
  McpServerTransport,
} from './bridge';
import { McpClient } from './client';

export type McpServerConfig = {
  id: string;
  displayName?: string;
  transport: McpServerTransport;
  command?: string;
  args?: string[];
  cwd?: string;
  url?: string;
  metadata?: Record<string, unknown>;
};

type SessionState = {
  session: McpBridgeSession;
  client?: McpClient;
  healthy: boolean;
};

export class DefaultMcpServerAdapter implements McpServerAdapter {
  private readonly servers = new Map<string, McpServerConfig>();
  private readonly sessions = new Map<string, SessionState>();

  constructor(configs: McpServerConfig[]) {
    for (const config of configs) {
      this.servers.set(config.id, config);
    }
  }

  async discover(): Promise<McpServerRecord[]> {
    const records: McpServerRecord[] = [];
    for (const server of this.servers.values()) {
      const diagnostics = this.validateConfig(server);
      records.push({
        serverId: server.id,
        displayName: server.displayName ?? server.id,
        transport: server.transport,
        availability: diagnostics ? 'unavailable' : 'available',
        diagnostics: diagnostics ?? undefined,
        metadata: server.metadata,
      });
    }
    return records;
  }

  async connect(serverId: string): Promise<McpBridgeSession> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Connection failed: unknown MCP server "${serverId}"`);
    }
    const diagnostics = this.validateConfig(server);
    if (diagnostics) {
      throw new Error(`Connection failed: ${diagnostics.message}`);
    }

    const session: McpBridgeSession = {
      id: `mcp-session-${randomUUID()}`,
      serverId,
      metadata: {
        transport: server.transport,
      },
    };

    if (server.transport === 'stdio') {
      const client = new McpClient(
        server.command ?? '',
        server.args ?? [],
        server.cwd ?? process.cwd()
      );
      client.start();
      this.sessions.set(session.id, { session, client, healthy: true });
      return session;
    }

    this.sessions.set(session.id, { session, healthy: true });
    return session;
  }

  async isSessionHealthy(session: McpBridgeSession): Promise<boolean> {
    const state = this.sessions.get(session.id);
    return state?.healthy ?? false;
  }

  async invoke(
    session: McpBridgeSession,
    toolName: string,
    input: Record<string, unknown>
  ): Promise<McpInvokeResult> {
    const state = this.sessions.get(session.id);
    if (!state || !state.healthy) {
      throw new Error('Connection failed: session is unavailable');
    }
    const server = this.servers.get(session.serverId);
    if (!server) {
      throw new Error('Connection failed: server missing for active session');
    }

    if (server.transport !== 'stdio') {
      throw new Error(`Tool invocation failed: unsupported transport "${server.transport}"`);
    }

    if (!state.client) {
      throw new Error('Connection failed: stdio client not initialized');
    }

    await state.client.request(toolName, input);
    return {
      output: {
        ok: true,
        transport: server.transport,
        toolName,
      },
    };
  }

  private validateConfig(server: McpServerConfig): McpServerRecord['diagnostics'] | null {
    if (!server.id.trim()) {
      return {
        code: 'misconfigured',
        message: 'Server id is required',
        retryable: false,
      };
    }
    if (server.transport === 'stdio') {
      if (!server.command?.trim()) {
        return {
          code: 'misconfigured',
          message: 'Stdio transport requires a command',
          retryable: false,
        };
      }
      return null;
    }
    if (!server.url?.trim()) {
      return {
        code: 'misconfigured',
        message: 'HTTP/SSE transport requires a URL',
        retryable: false,
      };
    }
    return null;
  }
}
