import { AgentOrchestrator } from '../agent/orchestrator';
import { EventHookRunner } from '../automation/event-hooks';
import { AutomationRunner } from '../automation/runner';
import { AutomationScheduler } from '../automation/scheduler';
import { loadAgentsConfig } from '../config/agents-loader';
import {
  isEmbeddingStrategyV2Enabled,
  loadEmbeddingStrategyConfig,
} from '../context/embedding/config';
import { RepoFsWatcher } from '../context/fs-watcher';
import { GitWatcher } from '../context/git-watcher';
import { runIncrementalIndex } from '../context/indexer/incremental';
import { createDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { createDefaultApprovalPolicy } from '../policy/defaults';
import { DefaultPolicyEngine } from '../policy/engine';
import { createProviderAdapter, detectProvider } from '../providers';

async function main(): Promise<void> {
  await runMigrations();
  const db = await createDb();
  if (isEmbeddingStrategyV2Enabled()) {
    loadEmbeddingStrategyConfig();
  }
  const provider = createProviderAdapter(detectProvider());
  const policy = new DefaultPolicyEngine(createDefaultApprovalPolicy());
  const orchestrator = new AgentOrchestrator({ provider, policyEngine: policy });

  const scheduler = new AutomationScheduler();
  const hooks = new EventHookRunner();
  const runner = new AutomationRunner(orchestrator);
  const repoRoot = process.cwd();
  const agentsConfig = await loadAgentsConfig(repoRoot);

  for (const hook of agentsConfig.hooks) {
    hooks.register({
      id: `agents-hook-${hook.event}`,
      eventName: hook.event,
      command: hook.command,
      enabled: true,
      timeoutMs: 60_000,
    });
  }

  scheduler.schedule(
    {
      id: 'default-heartbeat',
      name: 'heartbeat',
      enabled: true,
      trigger: { type: 'schedule', cron: '*/30 * * * *' },
      prompt: 'Summarize pending automation status.',
      workspace: repoRoot,
      writePolicy: 'read-only',
      retries: 1,
    },
    async (spec) => {
      await runner.run(spec);
    }
  );

  hooks.on('hook-result', ({ hook, result }) => {
    console.log(`[hook:${hook.eventName}] ${result.summary}`);
  });

  const fsWatcher = new RepoFsWatcher(repoRoot);
  fsWatcher.on('change', async ({ path, type }) => {
    await runIncrementalIndex({
      db,
      repoRoot,
      operations: [{ path, type: type === 'unlink' ? 'delete' : 'upsert' }],
      trigger: { source: 'fs', event: type },
      embedProvider: provider,
    });
    await hooks.trigger('file-change', { cwd: repoRoot, payload: { path, type } });
  });
  fsWatcher.start();

  const gitWatcher = new GitWatcher(repoRoot);
  gitWatcher.on('change', async ({ previous, current }) => {
    await runIncrementalIndex({
      db,
      repoRoot,
      trigger: { source: 'git-head', previous, current },
      embedProvider: provider,
    });
    await hooks.trigger('git-head-change', { cwd: repoRoot, payload: { previous, current } });
  });
  gitWatcher.start();

  process.on('SIGINT', async () => {
    scheduler.stopAll();
    await fsWatcher.stop();
    await gitWatcher.stop();
    process.exit(0);
  });

  console.log('Dubsbot daemon running');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
