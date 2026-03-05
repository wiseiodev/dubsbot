import { z } from 'zod';
import type { McpServerConfig } from '../mcp/default-adapter';

const McpServerConfigSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().optional(),
  transport: z.enum(['stdio', 'http', 'sse', 'unknown']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  url: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const McpServerConfigListSchema = z.array(McpServerConfigSchema);

export function loadMcpServerConfig(raw = process.env.DUBSBOT_MCP_SERVERS_JSON): McpServerConfig[] {
  if (!raw?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return McpServerConfigListSchema.parse(parsed);
  } catch {
    return [];
  }
}
