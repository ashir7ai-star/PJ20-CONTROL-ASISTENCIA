/**
 * Selfie authorization (D7). The face is sensitive data (Ley 1581 arts. 5–6):
 * it needs an express authorization of its own, the employee may refuse it
 * (Decreto 1377 art. 6) and change their mind at any time. Every decision is
 * a new, immutable row — the latest one is in force.
 */
import { CONSENT_VERSION } from '@pj20/shared';
import { desc, eq } from 'drizzle-orm';

import { type AuditContext, audit } from '../audit.js';
import type { Executor } from '../db/client.js';
import { selfieAuthorizations } from '../db/schema.js';

/** Latest decision; null when the employee has never decided. */
export async function selfieAuthorized(db: Executor, employeeId: string): Promise<boolean | null> {
  const [latest] = await db
    .select({ authorized: selfieAuthorizations.authorized })
    .from(selfieAuthorizations)
    .where(eq(selfieAuthorizations.employeeId, employeeId))
    .orderBy(desc(selfieAuthorizations.decidedAt))
    .limit(1);
  return latest ? latest.authorized : null;
}

/** Records a decision (with its proof) and audits it. No-op if it does not change. */
export async function recordSelfieDecision(
  tx: Executor,
  employeeId: string,
  authorized: boolean,
  meta: { ip?: string | undefined; userAgent?: string | undefined },
  context: AuditContext,
): Promise<void> {
  if ((await selfieAuthorized(tx, employeeId)) === authorized) return;
  await tx.insert(selfieAuthorizations).values({
    employeeId,
    authorized,
    version: CONSENT_VERSION,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent?.slice(0, 512) ?? null,
  });
  await audit(tx, context, {
    action: authorized ? 'selfie.authorized' : 'selfie.declined',
    targetType: 'employee',
    targetId: employeeId,
    after: { authorized, version: CONSENT_VERSION },
  });
}
