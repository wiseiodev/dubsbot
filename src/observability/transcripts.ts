import { appendFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type TranscriptEntry = {
  timestamp: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
};

export class TranscriptStore {
  private path: string;

  constructor(path?: string) {
    this.path = path ?? join(homedir(), '.dubsbot', 'logs', 'transcripts.jsonl');
  }

  async write(entry: TranscriptEntry): Promise<void> {
    await mkdir(join(this.path, '..'), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(entry)}\n`, 'utf8');
  }
}
