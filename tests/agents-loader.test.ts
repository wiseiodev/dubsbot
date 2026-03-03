import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAgentsConfig } from '../src/config/agents-loader';

describe('loadAgentsConfig', () => {
  it('parses commands and hooks sections from AGENTS.md', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dubsbot-agents-'));
    await writeFile(
      join(dir, 'AGENTS.md'),
      `# AGENTS\n\n## Commands\n- build: pnpm build\n- test: pnpm test\n\n## Hooks\n- post-index: echo done\n`,
      'utf8'
    );

    const config = await loadAgentsConfig(dir);
    expect(config.commands).toHaveLength(2);
    expect(config.hooks).toHaveLength(1);
    expect(config.commands[0].name).toBe('build');
  });
});
