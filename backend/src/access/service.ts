/**
 * Access requests (D6): a person whose Google account is not on the allowlist
 * asks for access; an administrator approves (creates or reactivates the
 * employee) or rejects. Every resolution is audited.
 */
import type { AccessRequestCurrent, AccessRequestDto } from '@pj20/shared';
import { and, asc, eq, lt, ne, sql } from 'drizzle-orm';

import { type AuditContext, audit } from '../audit.js';
import type { Database, Executor } from '../db/client.js';
import { accessRequests, employees } from '../db/schema.js';
import { errors } from '../errors.js';
import type { VerifiedIdentity } from './proof.js';

const RETENTION_DAYS = 30;
const UNIQUE_VIOLATION = '23505';

async function isPending(db: Database, email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: accessRequests.id })
    .from(accessRequests)
    .where(and(eq(accessRequests.email, email), eq(accessRequests.status, 'pending')))
    .limit(1);
  return Boolean(row);
}

export async function currentRequest(
  db: Database,
  identity: VerifiedIdentity,
): Promise<AccessRequestCurrent> {
  return { ...identity, pending: await isPending(db, identity.email) };
}

/** Creates the request, or reports that one is already waiting. */
export async function createRequest(
  db: Database,
  identity: VerifiedIdentity,
  context: AuditContext,
): Promise<'created' | 'pending'> {
  const [active] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.email, identity.email), eq(employees.active, true)))
    .limit(1);
  if (active) throw errors.conflict('Tu cuenta ya tiene acceso. Inicia sesión de nuevo.');

  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(accessRequests)
        .values({ email: identity.email, name: identity.name.slice(0, 120) })
        .returning({ id: accessRequests.id });
      await audit(tx, context, {
        action: 'access_request.created',
        targetType: 'access_request',
        targetId: row?.id ?? null,
        after: identity,
      });
    });
    return 'created';
  } catch (error) {
    // One open request per e-mail (partial unique index): just say it is pending.
    if (hasCode(error, UNIQUE_VIOLATION)) return 'pending';
    throw error;
  }
}

function hasCode(error: unknown, code: string): boolean {
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    if ('code' in e && e.code === code) return true;
  }
  return false;
}

/** Pending requests, oldest first. Also purges resolved ones past retention (§3.3). */
export async function listPending(db: Database): Promise<AccessRequestDto[]> {
  await db
    .delete(accessRequests)
    .where(
      and(
        ne(accessRequests.status, 'pending'),
        lt(accessRequests.resolvedAt, sql`now() - make_interval(days => ${RETENTION_DAYS})`),
      ),
    );

  const rows = await db
    .select({ request: accessRequests, employeeActive: employees.active })
    .from(accessRequests)
    .leftJoin(employees, eq(employees.email, accessRequests.email))
    .where(eq(accessRequests.status, 'pending'))
    .orderBy(asc(accessRequests.requestedAt));

  return rows.map(({ request, employeeActive }) => ({
    id: request.id,
    name: request.name,
    email: request.email,
    requestedAt: request.requestedAt.toISOString(),
    deactivatedEmployee: employeeActive === false,
  }));
}

async function lockPending(db: Executor, id: string) {
  const [request] = await db
    .select()
    .from(accessRequests)
    .where(eq(accessRequests.id, id))
    .for('update');
  if (!request) throw errors.notFound('La solicitud');
  if (request.status !== 'pending') throw errors.conflict('Esta solicitud ya fue atendida.');
  return request;
}

/** Approve: create the employee, or reactivate a deactivated one. */
export async function approveRequest(
  db: Database,
  id: string,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const request = await lockPending(tx, id);
    const [existing] = await tx
      .select()
      .from(employees)
      .where(eq(employees.email, request.email))
      .for('update');

    if (!existing) {
      const [created] = await tx
        .insert(employees)
        .values({ name: request.name, email: request.email, role: 'employee' })
        .returning();
      await audit(tx, context, {
        action: 'employee.created',
        targetType: 'employee',
        targetId: created?.id ?? null,
        after: { name: request.name, email: request.email, role: 'employee', active: true },
      });
    } else if (!existing.active) {
      await tx.update(employees).set({ active: true }).where(eq(employees.id, existing.id));
      await audit(tx, context, {
        action: 'employee.reactivate',
        targetType: 'employee',
        targetId: existing.id,
        before: { active: false },
        after: { active: true },
      });
    }

    await resolve(tx, request.id, 'approved', context);
  });
}

export async function rejectRequest(
  db: Database,
  id: string,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const request = await lockPending(tx, id);
    await resolve(tx, request.id, 'rejected', context);
  });
}

async function resolve(
  tx: Executor,
  id: string,
  status: 'approved' | 'rejected',
  context: AuditContext,
) {
  await tx
    .update(accessRequests)
    .set({
      status,
      resolvedAt: new Date(),
      resolvedById: context.actor.id,
      resolvedByName: context.actor.name,
    })
    .where(eq(accessRequests.id, id));
  await audit(tx, context, {
    action: `access_request.${status}`,
    targetType: 'access_request',
    targetId: id,
  });
}
