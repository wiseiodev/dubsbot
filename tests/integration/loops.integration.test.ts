import { describe, expect, it, vi } from 'vitest';
import { createLoopController } from './helpers';

type WorkUnit = { id: string; shouldFail?: boolean };

async function runDaemonLoop(input: {
  work: WorkUnit[];
  controller: ReturnType<typeof createLoopController>;
  onProcess: (unit: WorkUnit) => Promise<void>;
}): Promise<{ processed: string[]; termination: string | null }> {
  const processed: string[] = [];
  for (const unit of input.work) {
    if (!input.controller.tick()) {
      break;
    }
    await input.onProcess(unit);
    processed.push(unit.id);
  }

  if (!input.controller.isTerminated()) {
    input.controller.stop();
  }

  return {
    processed,
    termination: input.controller.terminationReason(),
  };
}

async function runWatcherLoop(input: {
  work: WorkUnit[];
  controller: ReturnType<typeof createLoopController>;
}): Promise<{ processed: string[]; termination: string | null; error?: string }> {
  const processed: string[] = [];
  try {
    for (const unit of input.work) {
      if (!input.controller.tick()) {
        break;
      }
      if (unit.shouldFail) {
        throw new Error(`fatal watcher error on ${unit.id}`);
      }
      processed.push(unit.id);
    }
  } catch (error) {
    input.controller.fail();
    return {
      processed,
      termination: input.controller.terminationReason(),
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (!input.controller.isTerminated()) {
    input.controller.stop();
  }

  return {
    processed,
    termination: input.controller.terminationReason(),
  };
}

describe('integration: daemon and watcher loop lifecycle', () => {
  it('daemon loop starts, processes bounded work, and exits cleanly', async () => {
    const onTerminate = vi.fn();
    const controller = createLoopController({
      maxIterations: 3,
      onTerminate,
    });

    const result = await runDaemonLoop({
      work: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      controller,
      onProcess: async () => undefined,
    });

    expect(result.processed).toEqual(['a', 'b']);
    expect(result.termination).toBe('max_iterations');
    expect(onTerminate).toHaveBeenCalledWith('max_iterations');
  });

  it('watcher loop terminates on fatal error and avoids deadlock', async () => {
    const onTerminate = vi.fn();
    const controller = createLoopController({
      maxIterations: 10,
      onTerminate,
    });

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<{ processed: string[]; termination: string; error: string }>(
      (resolve) => {
        timeoutId = setTimeout(() => {
          resolve({ processed: [], termination: 'timeout', error: 'loop hung' });
        }, 200);
      }
    );

    const result = await Promise.race([
      runWatcherLoop({
        work: [{ id: 'first' }, { id: 'second', shouldFail: true }, { id: 'third' }],
        controller,
      }),
      timeoutPromise,
    ]);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    expect(result.termination).not.toBe('timeout');
    expect(result.termination).toBe('fatal_error');
    expect(result.error).toContain('fatal watcher error');
    expect(onTerminate).toHaveBeenCalledWith('fatal_error');
  });

  it('loop scenarios include timeout safeguards for cleanup', async () => {
    const controller = createLoopController({ maxIterations: 2 });

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<{ processed: string[]; termination: string }>((resolve) => {
      timeoutId = setTimeout(() => resolve({ processed: [], termination: 'timeout' }), 200);
    });

    const run = Promise.race([
      runDaemonLoop({
        work: [{ id: 'one' }, { id: 'two' }, { id: 'three' }],
        controller,
        onProcess: async () => undefined,
      }),
      timeoutPromise,
    ]);

    const result = await run;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    expect(result.termination).not.toBe('timeout');
  });
});
