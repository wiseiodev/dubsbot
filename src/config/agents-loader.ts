import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type AgentCommand = {
  name: string;
  command: string;
};

export type AgentsConfig = {
  commands: AgentCommand[];
  hooks: Array<{ event: string; command: string }>;
};

function parseSectionLines(content: string, heading: string): string[] {
  const lines = content.split('\n');
  const headingIndex = lines.findIndex(
    (line) => line.trim().toLowerCase() === heading.toLowerCase()
  );
  if (headingIndex < 0) {
    return [];
  }

  const section: string[] = [];
  for (let i = headingIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('#')) {
      break;
    }
    section.push(line.trim());
  }
  return section.filter(Boolean);
}

export async function loadAgentsConfig(cwd: string): Promise<AgentsConfig> {
  const path = join(cwd, 'AGENTS.md');
  const content = await readFile(path, 'utf8').catch(() => '');
  if (!content) {
    return { commands: [], hooks: [] };
  }

  const commandLines = parseSectionLines(content, '## Commands');
  const hookLines = parseSectionLines(content, '## Hooks');

  const commands = commandLines
    .map((line) => line.match(/^[-*]\s*`?([^:`]+)`?\s*:\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ name: match[1].trim(), command: match[2].trim() }));

  const hooks = hookLines
    .map((line) => line.match(/^[-*]\s*`?([^:`]+)`?\s*:\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ event: match[1].trim(), command: match[2].trim() }));

  return { commands, hooks };
}
