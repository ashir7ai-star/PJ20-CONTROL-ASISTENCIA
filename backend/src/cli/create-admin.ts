/**
 * Creates the first administrator (or promotes/reactivates an existing user).
 * There is no default user in the code: this explicit, audited command is the
 * only way to bootstrap access.
 * Usage: pnpm admin:crear correo@ejemplo.com "Nombre Apellido"
 */
import { createEmployeeSchema } from '@pj20/shared';
import { eq } from 'drizzle-orm';
import pg from 'pg';

import { SYSTEM_ACTOR, audit } from '../audit.js';
import { createDatabase } from '../db/client.js';
import { employees } from '../db/schema.js';

const [, , emailArg, ...nameParts] = process.argv;
const parsed = createEmployeeSchema.safeParse({
  email: emailArg ?? '',
  name: nameParts.join(' ') || 'Administrador',
  role: 'admin',
});
if (!parsed.success || !process.env.DATABASE_URL) {
  process.stderr.write(
    'Uso: pnpm admin:crear correo@ejemplo.com "Nombre Apellido"   (requiere DATABASE_URL)\n',
  );
  process.exit(1);
}
const input = parsed.data;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const db = createDatabase(pool);
try {
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(employees).where(eq(employees.email, input.email));
    if (existing) {
      const [row] = await tx
        .update(employees)
        .set({ role: 'admin', active: true })
        .where(eq(employees.id, existing.id))
        .returning();
      await audit(
        tx,
        { actor: SYSTEM_ACTOR },
        {
          action: 'admin.bootstrap_promoted',
          targetType: 'employee',
          targetId: existing.id,
          before: { role: existing.role, active: existing.active },
          after: { role: row?.role, active: row?.active },
        },
      );
      return 'actualizado';
    }
    const [row] = await tx.insert(employees).values(input).returning();
    await audit(
      tx,
      { actor: SYSTEM_ACTOR },
      {
        action: 'admin.bootstrap_created',
        targetType: 'employee',
        targetId: row?.id ?? null,
        after: { name: input.name, email: input.email, role: 'admin' },
      },
    );
    return 'creado';
  });
  process.stdout.write(`✓ Administrador ${result}: ${input.email}\n`);
} catch (error) {
  process.stderr.write(`✗ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
