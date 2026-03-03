import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';

export type McpRequest = {
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

export class McpClient {
  private proc?: ChildProcessWithoutNullStreams;
  private seq = 0;

  constructor(
    private readonly command: string,
    private readonly args: string[] = [],
    private readonly cwd = process.cwd()
  ) {}

  start(): void {
    this.proc = spawn(this.command, this.args, {
      cwd: this.cwd,
      shell: false,
      stdio: 'pipe',
    });
  }

  stop(): void {
    this.proc?.kill('SIGTERM');
    this.proc = undefined;
  }

  async request(method: string, params?: Record<string, unknown>): Promise<void> {
    if (!this.proc) {
      throw new Error('MCP client not started');
    }

    const request: McpRequest = {
      id: `mcp-${++this.seq}`,
      method,
      params,
    };

    this.proc.stdin.write(`${JSON.stringify(request)}\n`);
  }
}
