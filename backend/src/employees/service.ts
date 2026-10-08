/**
 * User management. The SAME rules the admin panel shows (packages/shared
 * permissions) are enforced here; the server always has the final word.
 * Every change runs in a transaction together with its audit entry and,
 * where relevant, the revocation of the user's sessions.
 */
import {
  type CreateEmployeeRequest,
  type EmployeeDto,
  type UpdateEmployeeRequest,
  type UserAction,
  blockReason,
  createEmployeeSchema,
} from '@pj20/shared';
import { asc, eq, sql } from 'drizzle-orm';

import { type AuditContext, audit } from '../audit.js';
import { revokeAllSessions } from '../auth/sessions.js';
import type { Database, Executor } from '../db/client.js';
import { employees } from '../db/schema.js';
import { errors } from '../errors.js';

type EmployeeRow = typeof employees.$inferSelect;

export function toDto(row: EmployeeRow, recordCount: number): EmployeeDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    recordCount,
  };
}

/**
 * Consents + attendance records. Anyone with history is deactivated, never
 * deleted (Ley 1581 evidence and labour records must be kept).
 */
// Explicit aliases: inside each subquery, "employees"."id" is the outer row.
const HISTORY = sql<number>`(
  (SELECT count(*) FROM consents c WHERE c.employee_id = "employees"."id")
  + (SELECT count(*) FROM attendance_records a WHERE a.employee_id = "employees"."id")
)`.mapWith(Number);

async function historyCount(db: Executor, employeeId: string): Promise<number> {
  const [row] = await db
    .select({ total: HISTORY })
    .from(employees)
    .where(eq(employees.id, employeeId));
  return row?.total ?? 0;
}

/** Snapshot used in audit entries (no timestamps noise). */
const snapshot = (row: EmployeeRow) => ({
  name: row.name,
  email: row.email,
  role: row.role,
  active: row.active,
});

export async function listEmployees(db: Database): Promise<EmployeeDto[]> {
  const rows = await db
    .select({ employee: employees, history: HISTORY })
    .from(employees)
    .orderBy(asc(employees.name));
  return rows.map((r) => toDto(r.employee, r.history));
}

export async function createEmployee(
  db: Database,
  input: CreateEmployeeRequest,
  context: AuditContext,
): Promise<EmployeeDto> {
  const data = createEmployeeSchema.parse(input);
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.email, data.email));
    if (existing) throw errors.conflict('Ya existe un usuario con ese correo.');

    const [row] = await tx.insert(employees).values(data).returning();
    if (!row) throw new Error('Insert returned no row');
    await audit(tx, context, {
      action: 'employee.created',
      targetType: 'employee',
      targetId: row.id,
      after: snapshot(row),
    });
    return toDto(row, 0);
  });
}

/**
 * Loads the target and ALL admins with row locks, so two concurrent changes
 * can never leave the company without an active administrator.
 */
async function lockForChange(tx: Executor, targetId: string) {
  const locked = await tx
    .select()
    .from(employees)
    .where(sql`${employees.id} = ${targetId} OR ${employees.role} = 'admin'`)
    .for('update');
  const target = locked.find((e) => e.id === targetId);
  if (!target) throw errors.notFound('El usuario');
  return { target, locked };
}

function ensureAllowed(
  action: UserAction,
  target: EmployeeRow,
  me: { id: string },
  people: EmployeeRow[],
  recordCount: number,
) {
  const actor = people.find((p) => p.id === me.id) ?? {
    id: me.id,
    role: 'admin' as const,
    active: true,
  };
  const reason = blockReason(action, target, actor, people, recordCount);
  if (reason) throw errors.ruleViolation(reason);
}

export async function updateEmployee(
  db: Database,
  targetId: string,
  change: UpdateEmployeeRequest,
  me: { id: string },
  context: AuditContext,
): Promise<EmployeeDto> {
  return db.transaction(async (tx) => {
    const { target, locked } = await lockForChange(tx, targetId);

    const actions: UserAction[] = [];
    if (change.role && change.role !== target.role) {
      actions.push(change.role === 'admin' ? 'make-admin' : 'remove-admin');
    }
    if (change.active !== undefined && change.active !== target.active) {
      actions.push(change.active ? 'reactivate' : 'deactivate');
    }
    if (actions.length === 0) return toDto(target, await historyCount(tx, targetId));
    for (const action of actions) ensureAllowed(action, target, me, locked, 0);

    const [row] = await tx
      .update(employees)
      .set({
        ...(change.role ? { role: change.role } : {}),
        ...(change.active !== undefined ? { active: change.active } : {}),
      })
      .where(eq(employees.id, targetId))
      .returning();
    if (!row) throw errors.notFound('El usuario');

    // Losing access or changing privileges ends current sessions immediately.
    const revoked = await revokeAllSessions(tx, targetId);
    await audit(tx, context, {
      action: `employee.${actions.join('+')}`,
      targetType: 'employee',
      targetId,
      before: snapshot(target),
      after: { ...snapshot(row), sessionsRevoked: revoked },
    });
    return toDto(row, await historyCount(tx, targetId));
  });
}

export async function deleteEmployee(
  db: Database,
  targetId: string,
  me: { id: string },
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const { target, locked } = await lockForChange(tx, targetId);
    const history = await historyCount(tx, targetId);
    ensureAllowed('delete', target, me, locked, history);

    await tx.delete(employees).where(eq(employees.id, targetId));
    await audit(tx, context, {
      action: 'employee.deleted',
      targetType: 'employee',
      targetId,
      before: snapshot(target),
    });
  });
}
