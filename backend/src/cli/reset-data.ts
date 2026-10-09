/**
 * Wipes EVERY record (database + selfies) to start real use from zero.
 * Attendance, consents and the audit log are immutable by design — not even
 * the owner can delete rows — so the only way to start clean is to drop the
 * schema and recreate it with the migrations.
 *
 * Two independent keys, so it can never run by accident once real records
 * exist:
 *   1. the service must have PERMITIR_REINICIO_DATOS=si (set it, run, REMOVE it);
 *   2. the exact confirmation phrase, which names the database.
 *
 * Usage (API console):  node dist/reiniciar-datos.js BORRAR-TODO-<base de datos>
 * Then:                 node dist/migrate.js
 *                       node dist/db-usuario-app.js
 *                       node dist/admin-crear.js correo@empresa.com "Nombre"
 */
import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import pg from 'pg';

import { createStorageClient } from '../infra/storage.js';

const fail = (message: string): never => {
  process.stderr.write(`✗ ${message}\n`);
  process.exit(1);
};

const ownerUrl = process.env.DATABASE_MIGRATION_URL ?? fail('Falta DATABASE_MIGRATION_URL.');
if (process.env.PERMITIR_REINICIO_DATOS !== 'si') {
  fail(
    'Bloqueado. Para reiniciar, agrega PERMITIR_REINICIO_DATOS=si al servicio, ' +
      'ejecuta el comando y QUITA la variable apenas termine.',
  );
}

const database = new URL(ownerUrl).pathname.replace(/^\//, '');
const phrase = `BORRAR-TODO-${database}`;
if (process.argv[2] !== phrase) {
  fail(`Para confirmar, escribe exactamente: node dist/reiniciar-datos.js ${phrase}`);
}

const TABLES = [
  ['employees', 'empleados'],
  ['attendance_records', 'marcaciones'],
  ['consents', 'consentimientos'],
  ['access_requests', 'solicitudes de acceso'],
  ['sessions', 'sesiones'],
  ['audit_log', 'registros de auditoría'],
] as const;

const pool = new pg.Pool({ connectionString: ownerUrl, max: 1 });
try {
  process.stdout.write(`Base de datos «${database}». Se borrará:\n`);
  for (const [table, label] of TABLES) {
    const exists = await pool.query<{ ok: boolean }>('SELECT to_regclass($1) IS NOT NULL AS ok', [
      `public.${table}`,
    ]);
    if (!exists.rows[0]?.ok) continue;
    const result = await pool.query<{ total: string }>(`SELECT count(*) AS total FROM ${table}`);
    process.stdout.write(`  · ${result.rows[0]?.total ?? '0'} ${label}\n`);
  }

  // Dropping the schema bypasses row triggers by design: this is the one
  // deliberate exception, guarded by the two keys above.
  await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
  await pool.query('DROP SCHEMA public CASCADE');
  await pool.query('CREATE SCHEMA public');
  process.stdout.write('✓ Base de datos vacía\n');
} finally {
  await pool.end();
}

const bucket = process.env.S3_BUCKET ?? fail('Falta S3_BUCKET.');
const storage = createStorageClient({
  endpoint: process.env.S3_ENDPOINT ?? fail('Falta S3_ENDPOINT.'),
  region: process.env.S3_REGION ?? 'us-east-1',
  accessKey: process.env.S3_ACCESS_KEY ?? fail('Falta S3_ACCESS_KEY.'),
  secretKey: process.env.S3_SECRET_KEY ?? fail('Falta S3_SECRET_KEY.'),
});
let removed = 0;
let token: string | undefined;
do {
  const page = await storage.send(
    new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
  );
  const keys = (page.Contents ?? []).flatMap((object) => (object.Key ? [{ Key: object.Key }] : []));
  if (keys.length > 0) {
    await storage.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
    removed += keys.length;
  }
  token = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (token);
storage.destroy();
process.stdout.write(`✓ ${String(removed)} selfies borradas\n`);

process.stdout.write(
  '\nAhora ejecuta, en orden:\n' +
    '  node dist/migrate.js\n' +
    '  node dist/db-usuario-app.js\n' +
    '  node dist/admin-crear.js correo@empresa.com "Nombre"\n' +
    'y QUITA la variable PERMITIR_REINICIO_DATOS del servicio.\n',
);
