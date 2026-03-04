import { Command } from 'commander';
import {
  runAutomationsAddCommand,
  runAutomationsListCommand,
  runAutomationsRunCommand,
} from './commands/automations';
import { runChatCommand } from './commands/chat';
import { runIndexCommand } from './commands/index';
import { runPlanCommand } from './commands/plan';
import { runRetrievalProofCommand } from './commands/retrieval-proof';

export function createProgram(): Command {
  const program = new Command();

  program.name('dubsbot').description('Model-agnostic local coding agent CLI').version('0.1.0');

  program
    .command('chat')
    .description('Run interactive chat mode or one-shot prompt')
    .argument('[prompt]', 'optional one-shot prompt')
    .action(async (prompt: string | undefined) => {
      await runChatCommand(prompt);
    });

  program
    .command('plan')
    .description('Generate a structured plan object response')
    .argument('<prompt>', 'prompt to plan')
    .action(async (prompt: string) => {
      await runPlanCommand(prompt);
    });

  program
    .command('index')
    .description('Index repository into local context graph/vector store')
    .argument('[repoRoot]', 'repository root', process.cwd())
    .action(async (repoRoot: string) => {
      await runIndexCommand(repoRoot);
    });

  program
    .command('retrieval-proof')
    .description('Run retrieval quality proofing against benchmark profiles')
    .option(
      '--benchmark <path>',
      'benchmark fixture JSON path',
      'benchmarks/retrieval-proofing/benchmark.v1.json'
    )
    .option(
      '--profiles <path>',
      'benchmark profiles JSON path',
      'benchmarks/retrieval-proofing/profiles.v1.json'
    )
    .option('--profile <name>', 'benchmark profile name', 'smoke')
    .option(
      '--output-dir <path>',
      'directory for generated reports',
      'artifacts/retrieval-proofing'
    )
    .option('--no-fail-on-gate', 'do not exit non-zero when gate fails')
    .action(
      async (options: {
        benchmark: string;
        profiles: string;
        profile: string;
        outputDir: string;
        failOnGate: boolean;
      }) => {
        await runRetrievalProofCommand(options);
      }
    );

  const automations = program.command('automations').description('Manage local automations');

  automations.command('list').action(async () => {
    await runAutomationsListCommand();
  });

  automations
    .command('add')
    .requiredOption('--name <name>', 'automation name')
    .requiredOption('--cron <cron>', 'cron schedule')
    .requiredOption('--prompt <prompt>', 'automation prompt')
    .option('--workspace <workspace>', 'workspace path', process.cwd())
    .action(async (options: { name: string; cron: string; prompt: string; workspace: string }) => {
      await runAutomationsAddCommand(options);
    });

  automations.command('run').action(async () => {
    await runAutomationsRunCommand();
  });

  return program;
}
