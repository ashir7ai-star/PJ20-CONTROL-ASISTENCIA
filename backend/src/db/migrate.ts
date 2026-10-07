/**
 * Applies pending migrations with the OWNER role (DATABASE_MIGRATION_URL).
 * Usage: pnpm db:migrate   (also run on each deploy, before starting the API)
 */
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = process.env.DATABASE_MIGRATION_URL;
if (!url) {
  process.stderr.write(
    'Falta la variable DATABASE_MIGRATION_URL (usuario dueño de la base de datos).\n',
  );
  process.exit(1);
}

// Works both from source (src/db) and from the bundle (dist/), which ships
// the migrations folder next to it.
const migrationsFolder =
  process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL('../../migrations', import.meta.url));

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder });
  process.stdout.write('✓ Migraciones aplicadas\n');
} catch (error) {
  process.stderr.write(
    `✗ Error al migrar: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
