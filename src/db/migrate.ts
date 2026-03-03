import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDb } from './client';

export async function runMigrations(): Promise<void> {
  const db = await createDb();
  await db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());'
  );

  const migrationPath = join(process.cwd(), 'src', 'db', 'migrations', '0001_init.sql');
  const migrationSql = await readFile(migrationPath, 'utf8');

  const already = await db.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '0001_init') AS exists"
  );

  if (already.rows[0]?.exists) {
    return;
  }

  await db.exec(migrationSql);
  await db.query("INSERT INTO schema_migrations (version) VALUES ('0001_init')");
}
