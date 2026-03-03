import { spawn } from 'node:child_process';
import type { ToolResult } from './schemas';

export type ExecCommandInput = {
  command: string;
  cwd: string;
  timeoutMs?: number;
};

export async function executeCommand(input: ExecCommandInput): Promise<ToolResult> {
  const timeoutMs = input.timeoutMs ?? 120_000;

  return new Promise((resolve) => {
    const child = spawn(input.command, {
      cwd: input.cwd,
      shell: true,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let killedByTimeout = false;

    const timer = setTimeout(() => {
      killedByTimeout = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        tool: 'exec-command',
        ok: code === 0 && !killedByTimeout,
        summary: killedByTimeout
          ? 'Command timed out'
          : code === 0
            ? 'Command succeeded'
            : 'Command failed',
        payload: {
          command: input.command,
          cwd: input.cwd,
        },
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });
  });
}
