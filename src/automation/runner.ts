import { randomUUID } from 'node:crypto';
import type { AgentOrchestrator } from '../agent/orchestrator';
import type { AutomationSpec } from './schemas';

export class AutomationRunner {
  constructor(private readonly orchestrator: AgentOrchestrator) {}

  async run(spec: AutomationSpec): Promise<void> {
    await this.orchestrator.runTurn({
      userMessage: spec.prompt,
      sessionId: `automation-${spec.id}-${randomUUID()}`,
      mode: 'automation',
    });
  }
}
