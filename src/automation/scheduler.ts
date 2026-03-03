import type { ScheduledTask } from 'node-cron';
import cron from 'node-cron';
import type { AutomationSpec } from './schemas';

export class AutomationScheduler {
  private jobs = new Map<string, ScheduledTask>();

  schedule(spec: AutomationSpec, onRun: (spec: AutomationSpec) => Promise<void>): void {
    if (spec.trigger.type !== 'schedule') {
      return;
    }

    this.unschedule(spec.id);

    const job = cron.schedule(spec.trigger.cron, async () => {
      if (!spec.enabled) {
        return;
      }
      await onRun(spec);
    });

    this.jobs.set(spec.id, job);
  }

  unschedule(id: string): void {
    const existing = this.jobs.get(id);
    if (!existing) {
      return;
    }
    existing.stop();
    this.jobs.delete(id);
  }

  stopAll(): void {
    for (const job of this.jobs.values()) {
      job.stop();
    }
    this.jobs.clear();
  }
}
