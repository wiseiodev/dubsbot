import { EventEmitter } from 'node:events';
import { executeCommand } from '../tools/exec-command';
import type { HookSpec } from './schemas';

export class EventHookRunner extends EventEmitter {
  private hooks = new Map<string, HookSpec>();

  register(hook: HookSpec): void {
    this.hooks.set(hook.id, hook);
  }

  unregister(id: string): void {
    this.hooks.delete(id);
  }

  async trigger(
    eventName: string,
    context: { cwd: string; payload?: Record<string, unknown> }
  ): Promise<void> {
    const matching = Array.from(this.hooks.values()).filter(
      (hook) => hook.enabled && hook.eventName === eventName
    );
    for (const hook of matching) {
      const result = await executeCommand({
        command: hook.command,
        cwd: context.cwd,
        timeoutMs: hook.timeoutMs,
      });
      this.emit('hook-result', { hook, result, context });
    }
  }
}
