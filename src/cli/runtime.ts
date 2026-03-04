import { AgentOrchestrator } from '../agent/orchestrator';
import { loadAgentsConfig } from '../config/agents-loader';
import { loadEmbeddingStrategyConfig } from '../context/embedding/config';
import { createDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { OptionalOtelExporter } from '../observability/otel';
import { TraceStore } from '../observability/traces';
import { TranscriptStore } from '../observability/transcripts';
import { createDefaultApprovalPolicy } from '../policy/defaults';
import { DefaultPolicyEngine } from '../policy/engine';
import { createProviderAdapter, detectProvider } from '../providers';
import { ToolRegistry } from '../tools/registry';

export async function createRuntime() {
  await runMigrations();
  const db = await createDb();
  const embeddingStrategyConfig = loadEmbeddingStrategyConfig();
  const agentsConfig = await loadAgentsConfig(process.cwd());
  const provider = createProviderAdapter(detectProvider());
  const policyEngine = new DefaultPolicyEngine(createDefaultApprovalPolicy());
  const orchestrator = new AgentOrchestrator({
    provider,
    policyEngine,
    maxValidationRetries: 3,
  });

  return {
    db,
    embeddingStrategyConfig,
    provider,
    policyEngine,
    orchestrator,
    traces: new TraceStore(),
    transcripts: new TranscriptStore(),
    otel: new OptionalOtelExporter(),
    tools: new ToolRegistry({
      policyEngine,
      defaultMode: 'interactive',
      agentsConfig,
      onWarning: (message) => {
        console.warn(`[agents-config] ${message}`);
      },
    }),
  };
}
