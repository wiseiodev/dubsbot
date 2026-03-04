import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fg from 'fast-glob';
import { createDb } from './client';

export async function runMigrations(): Promise<void> {
  const db = await createDb();
  await db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());'
  );

  const migrationFiles = await fg(['*.sql'], {
    cwd: join(process.cwd(), 'src', 'db', 'migrations'),
    onlyFiles: true,
    absolute: false,
  });
  migrationFiles.sort();

  const existing = await db.query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  );
  const applied = new Set(existing.rows.map((row) => row.version));

  for (const file of migrationFiles) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) {
      continue;
    }

    const migrationPath = join(process.cwd(), 'src', 'db', 'migrations', file);
    const migrationSql = await readFile(migrationPath, 'utf8');

    try {
      await db.exec('BEGIN');
      await db.exec(migrationSql);
      await db.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      await db.exec('COMMIT');
    } catch (error) {
      try {
        await db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failures to avoid masking original migration errors.
      }
      throw error;
    }
  }
}
