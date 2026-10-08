/**
 * Creates (or updates the password of) the login user the API connects with,
 * as a member of the least-privilege group role `pj20_app`. Idempotent.
 * Runs with the OWNER role; the password comes from the environment, never
 * from the repository.
 * Usage: pnpm db:usuario-app
 */
import pg from 'pg';

const ownerUrl = process.env.DATABASE_MIGRATION_URL;
const appUrl = process.env.DATABASE_URL;
if (!ownerUrl || !appUrl) {
  process.stderr.write('Faltan DATABASE_MIGRATION_URL y/o DATABASE_URL.\n');
  process.exit(1);
}

// The API user and password are taken from DATABASE_URL so there is a single
// source of truth for them.
const { username, password } = new URL(appUrl);
const user = decodeURIComponent(username);
const secret = decodeURIComponent(password);
if (!/^[a-z_][a-z0-9_]{2,62}$/.test(user) || secret.length < 16) {
  process.stderr.write(
    'Usuario de la API inválido o contraseña de menos de 16 caracteres en DATABASE_URL.\n',
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString: ownerUrl });
await client.connect();
try {
  const ident = client.escapeIdentifier(user);
  const literal = client.escapeLiteral(secret);
  const { rowCount } = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [user]);
  if (rowCount) {
    await client.query(
      `ALTER ROLE ${ident} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${literal}`,
    );
  } else {
    await client.query(
      `CREATE ROLE ${ident} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${literal}`,
    );
  }
  await client.query(`GRANT pj20_app TO ${ident}`);
  process.stdout.write(
    `✓ Usuario de la API «${user}» listo (miembro de pj20_app, sin privilegios de administración)\n`,
  );
} catch (error) {
  process.stderr.write(`✗ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await client.end();
}
