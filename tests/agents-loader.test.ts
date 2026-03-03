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
    expect(config.warnings).toEqual([]);
  });

  it('keeps first duplicate command and emits deterministic warning', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dubsbot-agents-dup-'));
    await writeFile(
      join(dir, 'AGENTS.md'),
      `# AGENTS\n\n## Commands\n- test: pnpm test\n- build: pnpm build\n- test: pnpm test:watch\n\n## Hooks\n- file-change: pnpm test\n`,
      'utf8'
    );

    const config = await loadAgentsConfig(dir);
    expect(config.commands).toHaveLength(2);
    expect(config.commands[0]).toEqual({ name: 'test', command: 'pnpm test' });
    expect(config.warnings).toHaveLength(1);
    expect(config.warnings[0].type).toBe('duplicate-command');
    expect(config.warnings[0].commandName).toBe('test');
    expect(config.warnings[0].keptIndex).toBe(0);
    expect(config.warnings[0].ignoredIndexes).toEqual([2]);
  });
});
