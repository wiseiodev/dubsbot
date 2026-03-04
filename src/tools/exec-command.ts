import { spawn } from 'node:child_process';
import type { ToolInvocation, ToolResult } from './schemas';

export type ExecCommandInput = {
  command: string;
  cwd: string;
  toolName?: string;
  timeoutMs?: number;
};

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bchmod\b/i,
];

const WRITE_PATTERNS = [
  />/,
  /\btee\b/i,
  /\bmv\b/i,
  /\bcp\b/i,
  /\btouch\b/i,
  /\bmkdir\b/i,
  /\bpnpm\s+lint(?::\w+)?(?:\s+--\w+)?\s+--write\b/i,
  /\bgit\s+add\b/i,
];

const NETWORK_PATTERNS = [/\bcurl\b/i, /\bwget\b/i, /\bnpm\s+install\b/i, /\bpnpm\s+add\b/i];

export function classifyCommandSideEffect(command: string): ToolInvocation['sideEffect'] {
  if (DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(command))) {
    return 'destructive';
  }
  if (WRITE_PATTERNS.some((pattern) => pattern.test(command))) {
    return 'write';
  }
  if (NETWORK_PATTERNS.some((pattern) => pattern.test(command))) {
    return 'network';
  }
  return 'read';
}

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
        tool: input.toolName ?? 'exec-command',
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
