import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type AgentCommand = {
  name: string;
  command: string;
};

export type AgentsConfigWarning = {
  type: 'duplicate-command';
  commandName: string;
  keptIndex: number;
  ignoredIndexes: number[];
  message: string;
};

export type AgentsConfig = {
  commands: AgentCommand[];
  hooks: Array<{ event: string; command: string }>;
  warnings: AgentsConfigWarning[];
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
    return { commands: [], hooks: [], warnings: [] };
  }

  const commandLines = parseSectionLines(content, '## Commands');
  const hookLines = parseSectionLines(content, '## Hooks');

  const parsedCommands = commandLines
    .map((line) => line.match(/^[-*]\s*`?([^:`]+)`?\s*:\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ name: match[1].trim(), command: match[2].trim() }));

  const warnings: AgentsConfigWarning[] = [];
  const commandNameToFirstIndex = new Map<string, number>();
  const duplicateIndexes = new Map<string, number[]>();
  for (const [index, command] of parsedCommands.entries()) {
    const name = command.name;
    const existing = commandNameToFirstIndex.get(name);
    if (existing === undefined) {
      commandNameToFirstIndex.set(name, index);
      continue;
    }
    const duplicates = duplicateIndexes.get(name) ?? [];
    duplicates.push(index);
    duplicateIndexes.set(name, duplicates);
  }

  const commands = parsedCommands.filter((command, index) => {
    const firstIndex = commandNameToFirstIndex.get(command.name);
    return firstIndex === index;
  });

  for (const [commandName, ignoredIndexes] of duplicateIndexes.entries()) {
    const keptIndex = commandNameToFirstIndex.get(commandName) ?? 0;
    warnings.push({
      type: 'duplicate-command',
      commandName,
      keptIndex,
      ignoredIndexes,
      message: `Duplicate AGENTS command "${commandName}" found at indexes ${ignoredIndexes.join(', ')}; using index ${keptIndex}.`,
    });
  }

  const hooks = hookLines
    .map((line) => line.match(/^[-*]\s*`?([^:`]+)`?\s*:\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ event: match[1].trim(), command: match[2].trim() }));

  return { commands, hooks, warnings };
}
