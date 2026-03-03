import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

export type QueryResult<T> = {
  rows: T[];
};

export class DubsbotDb {
  constructor(private readonly db: PGlite) {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const result = await this.db.query<T>(sql, params);
    return { rows: result.rows };
  }

  async exec(sql: string): Promise<void> {
    await this.db.exec(sql);
  }
}

export async function createDb(dbPath?: string): Promise<DubsbotDb> {
  const resolvedPath = dbPath ?? join(homedir(), '.dubsbot', 'pgdata');
  await mkdir(dirname(resolvedPath), { recursive: true });
  const db = new PGlite(resolvedPath);
  return new DubsbotDb(db);
}
