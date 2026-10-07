/**
 * Integration tests run against a throw-away database `pj20_test`, recreated
 * on every run: audit_log and consents are immutable by design, so tests can
 * never clean up after themselves in a shared database.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

export const TEST_DB = 'pj20_test';

export function loadLocalEnv(): void {
  const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

/** Vitest globalSetup: runs once before all integration test files. */
export default async function setup(): Promise<void> {
  loadLocalEnv();
  const ownerUrl = process.env.DATABASE_MIGRATION_URL;
  const apiUrl = process.env.DATABASE_URL;
  if (!ownerUrl || !apiUrl) {
    throw new Error('Integration tests need DATABASE_MIGRATION_URL and DATABASE_URL');
  }

  const admin = new pg.Client({ connectionString: withDatabase(ownerUrl, 'postgres') });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${TEST_DB}`);
  } finally {
    await admin.end();
  }

  const pool = new pg.Pool({ connectionString: withDatabase(ownerUrl, TEST_DB), max: 1 });
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)),
    });
    // Roles are cluster-wide; the API login user must exist (pnpm db:usuario-app).
    const apiUser = decodeURIComponent(new URL(apiUrl).username);
    const { rowCount } = await pool.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [apiUser]);
    if (!rowCount) {
      throw new Error(`El usuario de la API «${apiUser}» no existe: ejecuta pnpm db:usuario-app`);
    }
  } finally {
    await pool.end();
  }
}
