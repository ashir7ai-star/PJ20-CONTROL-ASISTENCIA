import pg from 'pg';

export function createDatabasePool(connectionString: string): pg.Pool {
  return new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export async function checkDatabase(pool: pg.Pool): Promise<void> {
  await pool.query('SELECT 1');
}
