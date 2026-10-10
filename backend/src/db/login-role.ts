/**
 * Creates (or updates the password of) a database LOGIN user as a member of a
 * least-privilege group role. Idempotent. Runs with the OWNER role; the user
 * and password come from a connection URL in the environment, never from the
 * repository.
 */
import pg from 'pg';

export async function ensureLoginRole(options: {
  ownerUrl: string;
  /** Connection URL the service will use: its user + password are taken from it. */
  userUrl: string;
  group: 'pj20_app' | 'pj20_backup';
  label: string;
}): Promise<void> {
  const { username, password } = new URL(options.userUrl);
  const user = decodeURIComponent(username);
  const secret = decodeURIComponent(password);
  if (!/^[a-z_][a-z0-9_]{2,62}$/.test(user) || secret.length < 16) {
    throw new Error(`Usuario inválido o contraseña de menos de 16 caracteres (${options.label}).`);
  }

  const client = new pg.Client({ connectionString: options.ownerUrl });
  await client.connect();
  try {
    const ident = client.escapeIdentifier(user);
    const literal = client.escapeLiteral(secret);
    const { rowCount } = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [user]);
    const verb = rowCount ? 'ALTER' : 'CREATE';
    await client.query(
      `${verb} ROLE ${ident} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${literal}`,
    );
    await client.query(`GRANT ${client.escapeIdentifier(options.group)} TO ${ident}`);
  } finally {
    await client.end();
  }
}

/** Shared CLI wrapper: reads both URLs, runs, prints a Spanish result. */
export async function runLoginRoleCli(
  userUrlVariable: 'DATABASE_URL' | 'BACKUP_DATABASE_URL',
  group: 'pj20_app' | 'pj20_backup',
  label: string,
  done: (user: string) => string,
): Promise<void> {
  const ownerUrl = process.env.DATABASE_MIGRATION_URL;
  const userUrl = process.env[userUrlVariable];
  if (!ownerUrl || !userUrl) {
    process.stderr.write(`Faltan DATABASE_MIGRATION_URL y/o ${userUrlVariable}.\n`);
    process.exit(1);
  }
  try {
    await ensureLoginRole({ ownerUrl, userUrl, group, label });
    process.stdout.write(`${done(decodeURIComponent(new URL(userUrl).username))}\n`);
  } catch (error) {
    process.stderr.write(`✗ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
