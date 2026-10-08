/**
 * Server-side sessions (decision D2). The client holds a random 256-bit token;
 * the database stores only its SHA-256, so a database leak cannot be replayed.
 * Revoking (logout, deactivation) takes effect on the very next request.
 */
import { createHash, randomBytes } from 'node:crypto';

import type { Role } from '@pj20/shared';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';

import type { Database, Executor } from '../db/client.js';
import { employees, sessions } from '../db/schema.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Employees: 30 days, renewed while used. Admins: 12 hours, never extended. */
export const SESSION_POLICY: Record<Role, { lifetimeMs: number; sliding: boolean }> = {
  employee: { lifetimeMs: 30 * DAY, sliding: true },
  admin: { lifetimeMs: 12 * HOUR, sliding: false },
};

/** Avoid a write on every request: renew a sliding session at most once a day. */
const RENEW_AFTER_MS = DAY;

export interface SessionContext {
  sessionId: string;
  employee: { id: string; name: string; email: string; role: Role };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  db: Executor,
  employeeId: string,
  role: Role,
  meta: { userAgent?: string | undefined; ip?: string | undefined },
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_POLICY[role].lifetimeMs);
  await db.insert(sessions).values({
    employeeId,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent: meta.userAgent?.slice(0, 512) ?? null,
    ip: meta.ip ?? null,
  });
  return { token, expiresAt };
}

/**
 * Resolves a token to an active session of an ACTIVE employee, or null.
 * Sliding sessions are renewed (at most once a day). Returns the new expiry
 * when renewed so the cookie can be refreshed.
 */
export async function resolveSession(
  db: Database,
  token: string,
  now = new Date(),
): Promise<(SessionContext & { renewedUntil: Date | null }) | null> {
  const [row] = await db
    .select({
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
      id: employees.id,
      name: employees.name,
      email: employees.email,
      role: employees.role,
    })
    .from(sessions)
    .innerJoin(employees, eq(employees.id, sessions.employeeId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        eq(employees.active, true),
      ),
    )
    .limit(1);
  if (!row) return null;

  const policy = SESSION_POLICY[row.role];
  let renewedUntil: Date | null = null;
  if (policy.sliding && now.getTime() - row.lastSeenAt.getTime() > RENEW_AFTER_MS) {
    renewedUntil = new Date(now.getTime() + policy.lifetimeMs);
    await db
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt: renewedUntil })
      .where(eq(sessions.id, row.sessionId));
  }

  return {
    sessionId: row.sessionId,
    employee: { id: row.id, name: row.name, email: row.email, role: row.role },
    renewedUntil,
  };
}

export async function revokeSession(db: Executor, sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

/** Used when an employee is deactivated or their role changes. */
export async function revokeAllSessions(db: Executor, employeeId: string): Promise<number> {
  const revoked = await db
    .update(sessions)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(sessions.employeeId, employeeId), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });
  return revoked.length;
}
