import { randomUUID } from 'node:crypto';
import { AutomationRunner } from '../../automation/runner';
import { AutomationScheduler } from '../../automation/scheduler';
import { type AutomationSpec, AutomationSpecSchema } from '../../automation/schemas';
import { createRuntime } from '../runtime';

async function loadAutomations(): Promise<AutomationSpec[]> {
  const runtime = await createRuntime();
  const rows = await runtime.db.query<{ spec: string }>(
    'SELECT spec::text AS spec FROM automations WHERE enabled = TRUE'
  );
  return rows.rows.map((row) => AutomationSpecSchema.parse(JSON.parse(row.spec)));
}

export async function runAutomationsListCommand(): Promise<void> {
  const automations = await loadAutomations();
  if (automations.length === 0) {
    console.log('No automations configured.');
    return;
  }

  for (const automation of automations) {
    console.log(`${automation.id}\t${automation.name}\t${automation.trigger.type}`);
  }
}

export async function runAutomationsAddCommand(input: {
  name: string;
  cron: string;
  prompt: string;
  workspace: string;
}): Promise<void> {
  const runtime = await createRuntime();
  const spec = AutomationSpecSchema.parse({
    id: randomUUID(),
    name: input.name,
    enabled: true,
    trigger: { type: 'schedule', cron: input.cron },
    prompt: input.prompt,
    workspace: input.workspace,
    writePolicy: 'safe-write',
    retries: 2,
  });

  await runtime.db.query(
    'INSERT INTO automations (id, name, spec, enabled) VALUES ($1, $2, $3::jsonb, TRUE)',
    [spec.id, spec.name, JSON.stringify(spec)]
  );

  console.log(`Added automation ${spec.id}`);
}

export async function runAutomationsRunCommand(): Promise<void> {
  const runtime = await createRuntime();
  const specs = await loadAutomations();
  const scheduler = new AutomationScheduler();
  const runner = new AutomationRunner(runtime.orchestrator);

  for (const spec of specs) {
    scheduler.schedule(spec, async (currentSpec) => {
      await runner.run(currentSpec);
    });
  }

  console.log(`Scheduled ${specs.length} automations. Press Ctrl+C to stop.`);
}
