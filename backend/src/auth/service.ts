/**
 * Sign-in with Google (D1) → allowlist → server session (D2), plus the
 * "who am I" and consent operations. Every outcome is audited, including
 * rejected attempts, so admins can see who tried to get in.
 */
import { CONSENT_VERSION, type Me } from '@pj20/shared';
import { and, eq } from 'drizzle-orm';

import { type AuditContext, audit } from '../audit.js';
import type { Database } from '../db/client.js';
import { consents, employees } from '../db/schema.js';
import { errors } from '../errors.js';
import type { GoogleVerifier } from './google.js';
import type { NonceStore } from './nonce.js';
import { recordSelfieDecision, selfieAuthorized } from './selfie.js';
import { createSession, type SessionContext } from './sessions.js';

export interface AuthDeps {
  db: Database;
  verifier: GoogleVerifier;
  nonces: NonceStore;
}

interface RequestMeta {
  userAgent?: string | undefined;
  ip?: string | undefined;
  requestId?: string | undefined;
}

export async function signInWithGoogle(
  { db, verifier, nonces }: AuthDeps,
  credential: string,
  nonce: string,
  meta: RequestMeta,
): Promise<{ token: string; expiresAt: Date; me: Me }> {
  // The nonce is consumed first: a credential can never be tried twice.
  if (!(await nonces.consume(nonce))) throw errors.invalidCredential();
  const identity = await verifier.verify(credential, nonce);

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.email, identity.email))
    .limit(1);

  const context: AuditContext = {
    actor: { id: employee?.id ?? null, name: employee?.name ?? identity.email },
    requestId: meta.requestId,
    ip: meta.ip,
  };

  if (!employee?.active) {
    await audit(db, context, {
      action: employee ? 'auth.rejected_inactive' : 'auth.rejected_unknown',
      targetType: 'auth',
      after: { email: identity.email },
    });
    // Same answer for unknown and inactive accounts: no hints for attackers.
    throw errors.accountNotAuthorized({ email: identity.email, name: identity.name });
  }

  const session = await createSession(db, employee.id, employee.role, meta);
  await audit(db, context, {
    action: 'auth.login',
    targetType: 'employee',
    targetId: employee.id,
  });
  return { ...session, me: await currentUser(db, { sessionId: '', employee }) };
}

export async function currentUser(
  db: Database,
  { employee }: Pick<SessionContext, 'employee'> & { sessionId: string },
): Promise<Me> {
  const [accepted] = await db
    .select({ id: consents.id })
    .from(consents)
    .where(and(eq(consents.employeeId, employee.id), eq(consents.version, CONSENT_VERSION)))
    .limit(1);
  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    consentRequired: !accepted,
    selfieAuthorized: await selfieAuthorized(db, employee.id),
  };
}

/**
 * Accepts the consent and records, separately, the selfie decision (D7).
 * Idempotent for the consent; the selfie decision is recorded if it changed.
 */
export async function acceptConsent(
  db: Database,
  session: SessionContext,
  selfie: boolean,
  meta: RequestMeta,
): Promise<void> {
  await db.transaction(async (tx) => {
    const context = { actor: session.employee, requestId: meta.requestId, ip: meta.ip };
    await recordSelfieDecision(tx, session.employee.id, selfie, meta, context);

    const [already] = await tx
      .select({ id: consents.id })
      .from(consents)
      .where(
        and(eq(consents.employeeId, session.employee.id), eq(consents.version, CONSENT_VERSION)),
      )
      .limit(1);
    if (already) return; // Idempotent: accepting twice is not an error.

    await tx.insert(consents).values({
      employeeId: session.employee.id,
      version: CONSENT_VERSION,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
    });
    await audit(tx, context, {
      action: 'consent.accepted',
      targetType: 'employee',
      targetId: session.employee.id,
      after: { version: CONSENT_VERSION },
    });
  });
}

/** Grant or revoke the selfie authorization at any time (D7). */
export async function setSelfieAuthorization(
  db: Database,
  session: SessionContext,
  authorized: boolean,
  meta: RequestMeta,
): Promise<Me> {
  await db.transaction(async (tx) => {
    await recordSelfieDecision(tx, session.employee.id, authorized, meta, {
      actor: session.employee,
      requestId: meta.requestId,
      ip: meta.ip,
    });
  });
  return currentUser(db, session);
}
