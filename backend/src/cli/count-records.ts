/**
 * Counts the records of every table (read only) to verify a restored backup
 * against the live database (D8). Prints the same lines for both, so they can
 * be compared side by side.
 * Usage: node dist/contar-registros.js [connection-url]
 *        (without an argument it uses DATABASE_MIGRATION_URL)
 */
import pg from 'pg';

const url = process.argv[2] ?? process.env.DATABASE_MIGRATION_URL;
if (!url) {
  process.stderr.write('Uso: node dist/contar-registros.js [url de conexión]\n');
  process.exit(1);
}

const TABLES = [
  ['employees', 'empleados'],
  ['attendance_records', 'marcaciones'],
  ['attendance_reviews', 'revisiones de marcaciones'],
  ['attendance_corrections', 'correcciones de marcaciones'],
  ['consents', 'consentimientos'],
  ['selfie_authorizations', 'decisiones sobre la selfie'],
  ['access_requests', 'solicitudes de acceso'],
  ['audit_log', 'registros de auditoría'],
] as const;

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const database = new URL(url).pathname.replace(/^\//, '');
  process.stdout.write(`Base de datos «${database}»\n`);
  for (const [table, label] of TABLES) {
    const exists = await client.query<{ ok: boolean }>('SELECT to_regclass($1) IS NOT NULL AS ok', [
      `public.${table}`,
    ]);
    if (!exists.rows[0]?.ok) {
      process.stdout.write(`  · ${label}: (no existe)\n`);
      continue;
    }
    const result = await client.query<{ total: string }>(`SELECT count(*) AS total FROM ${table}`);
    process.stdout.write(`  · ${label}: ${result.rows[0]?.total ?? '0'}\n`);
  }
  const last = await client.query<{ at: Date | null }>(
    'SELECT max(server_time) AS at FROM attendance_records',
  );
  const at = last.rows[0]?.at;
  process.stdout.write(`  · última marcación: ${at ? at.toISOString() : '(ninguna)'}\n`);
} catch (error) {
  process.stderr.write(`✗ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await client.end();
}
