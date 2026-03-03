import { EventEmitter } from 'node:events';
import { watch } from 'chokidar';

export type FsWatchEvent = {
  path: string;
  type: 'add' | 'change' | 'unlink';
};

export class RepoFsWatcher extends EventEmitter {
  private watcher?: ReturnType<typeof watch>;

  constructor(private readonly repoRoot: string) {
    super();
  }

  start(): void {
    this.watcher = watch(['**/*', '!node_modules/**', '!.git/**', '!dist/**'], {
      cwd: this.repoRoot,
      ignoreInitial: true,
    });

    this.watcher.on('add', (path) =>
      this.emit('change', { path, type: 'add' satisfies FsWatchEvent['type'] })
    );
    this.watcher.on('change', (path) =>
      this.emit('change', { path, type: 'change' satisfies FsWatchEvent['type'] })
    );
    this.watcher.on('unlink', (path) =>
      this.emit('change', { path, type: 'unlink' satisfies FsWatchEvent['type'] })
    );
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
  }
}
