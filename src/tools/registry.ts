import { z } from 'zod';
import { executeCommand } from './exec-command';
import { ToolInvocationSchema, type ToolResult } from './schemas';

export type ToolHandler = (params: Record<string, unknown>) => Promise<ToolResult>;

export class ToolRegistry {
  private handlers = new Map<string, ToolHandler>();

  constructor() {
    this.register('exec-command', async (params) => {
      const command = z.string().parse(params.command);
      const cwd = z.string().default(process.cwd()).parse(params.cwd);
      const timeoutMs = z.number().int().positive().optional().parse(params.timeoutMs);
      return executeCommand({ command, cwd, timeoutMs });
    });
  }

  register(name: string, handler: ToolHandler): void {
    this.handlers.set(name, handler);
  }

  async invoke(raw: unknown): Promise<ToolResult> {
    const invocation = ToolInvocationSchema.parse(raw);
    const handler = this.handlers.get(invocation.tool);
    if (!handler) {
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

    return handler(invocation.params);
  }
}
