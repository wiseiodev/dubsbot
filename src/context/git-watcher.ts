import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

export class GitWatcher extends EventEmitter {
  private timer?: NodeJS.Timeout;
  private lastHead = '';

  constructor(
    private readonly repoRoot: string,
    private readonly intervalMs = 10_000
  ) {
    super();
  }

  start(): void {
    this.timer = setInterval(() => {
      this.check().catch(() => {
        // intentionally swallow to keep watcher alive
      });
    }, this.intervalMs);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async check(): Promise<void> {
    const head = await this.readHead();
    if (head && this.lastHead && head !== this.lastHead) {
      this.emit('change', { previous: this.lastHead, current: head });
    }
    this.lastHead = head;
  }

  private async readHead(): Promise<string> {
    return new Promise((resolve) => {
      const child = spawn('git', ['rev-parse', 'HEAD'], {
        cwd: this.repoRoot,
        shell: false,
      });

      let stdout = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.on('close', (code) => {
        resolve(code === 0 ? stdout.trim() : '');
      });
      child.on('error', () => resolve(''));
    });
  }
}
