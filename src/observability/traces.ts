import { appendFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type TraceEvent = {
  timestamp: string;
  type: string;
  sessionId?: string;
  payload: Record<string, unknown>;
};

export class TraceStore {
  private path: string;

  constructor(path?: string) {
    this.path = path ?? join(homedir(), '.dubsbot', 'logs', 'traces.jsonl');
  }

  async write(event: TraceEvent): Promise<void> {
    await mkdir(join(this.path, '..'), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(event)}\n`, 'utf8');
  }
}
