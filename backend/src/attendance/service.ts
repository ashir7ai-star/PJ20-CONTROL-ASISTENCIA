/**
 * Attendance use cases: current status, marking (server time + GPS + selfie)
 * and the selfie for the admin. Rules live in rules.ts; this file orchestrates
 * the database, the photo store and the transaction. The admin's timeline,
 * reviews and corrections live in admin-timeline.ts.
 */
import { randomUUID } from 'node:crypto';

import {
  type AttendanceStatus,
  CONSENT_VERSION,
  type MarkRequest,
  type MarkResponse,
  type ReviewReason,
} from '@pj20/shared';
import { and, eq } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { attendanceRecords, consents, employees } from '../db/schema.js';
import { DomainError, errors } from '../errors.js';
import type { PhotoStore } from '../infra/photo-store.js';
import { selfieAuthorized } from '../auth/selfie.js';
import { lastEffectiveEvent } from './timeline-store.js';
import {
  isValidSelfie,
  reviewReasons,
  selfieKey,
  selfieRuleError,
  selfieState,
  transitionError,
} from './rules.js';

export interface MarkMeta {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Status from the effective timeline (Fase 6): if an administrator added the
 * exit the employee forgot, the employee is off duty and can check in again.
 */
export async function attendanceStatus(
  db: Database,
  employeeId: string,
): Promise<AttendanceStatus> {
  const last = await lastEffectiveEvent(db, employeeId);
  if (!last) return { onDutySince: null, lastRecord: null };
  const at = last.at.toISOString();
  return {
    onDutySince: last.kind === 'check_in' ? at : null,
    lastRecord: { kind: last.kind, at },
  };
}

/**
 * Records a check-in/out. The employee row is locked for the whole
 * transaction, so two taps at once can never produce "entrada sobre entrada".
 * The photo is stored first; if the insert fails it is removed again, so
 * nothing is ever left half-done.
 */
export async function markAttendance(
  db: Database,
  photos: PhotoStore,
  employeeId: string,
  input: MarkRequest,
  meta: MarkMeta,
): Promise<MarkResponse> {
  const jpeg = input.photo === undefined ? null : Buffer.from(input.photo, 'base64');
  if (jpeg && !isValidSelfie(jpeg)) {
    throw new DomainError(
      'VALIDATION_ERROR',
      400,
      'La foto no es válida. Toma la selfie de nuevo.',
    );
  }

  const deviceTime = new Date(input.deviceTime);
  const locationCapturedAt = new Date(input.location.capturedAt);
  const reasons: ReviewReason[] = reviewReasons({
    accuracyM: input.location.accuracyM,
    locationCapturedAt,
    deviceTime,
  });

  return db.transaction(async (tx) => {
    const [me] = await tx
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.active, true)))
      .for('update');
    if (!me) throw errors.forbidden();

    // Location and face photo need informed consent first (Ley 1581, §3.2):
    // enforced here too, not only by the app screens.
    const [consent] = await tx
      .select({ id: consents.id })
      .from(consents)
      .where(and(eq(consents.employeeId, employeeId), eq(consents.version, CONSENT_VERSION)))
      .limit(1);
    if (!consent) {
      throw errors.ruleViolation('Antes de marcar debes aceptar el tratamiento de tus datos.');
    }

    // D7: the selfie follows the employee's own authorization, never the client's say-so.
    const selfieProblem = selfieRuleError(await selfieAuthorized(tx, employeeId), jpeg !== null);
    if (selfieProblem) throw errors.ruleViolation(selfieProblem);

    const last = await lastEffectiveEvent(tx, employeeId);
    const problem = transitionError(last?.kind ?? null, input.kind);
    if (problem) throw errors.ruleViolation(problem);

    const id = randomUUID();
    const key = jpeg ? selfieKey(employeeId, id, new Date()) : null;
    if (key && jpeg) await photos.put(key, jpeg);
    try {
      const [row] = await tx
        .insert(attendanceRecords)
        .values({
          id,
          employeeId,
          kind: input.kind,
          deviceTime,
          latitude: input.location.latitude,
          longitude: input.location.longitude,
          accuracyM: input.location.accuracyM,
          locationCapturedAt,
          photoKey: key,
          ip: meta.ip ?? null,
          userAgent: meta.userAgent?.slice(0, 400) ?? null,
          reviewStatus: reasons.length > 0 ? 'pending' : 'ok',
          reviewReasons: reasons,
        })
        .returning();
      if (!row) throw new Error('La marcación no se guardó');
      return {
        id: row.id,
        kind: row.kind,
        serverTime: row.serverTime.toISOString(),
        accuracyM: row.accuracyM,
        reviewStatus: row.reviewStatus,
        reviewReasons: row.reviewReasons as ReviewReason[],
        withSelfie: row.photoKey !== null,
      };
    } catch (error) {
      if (key) await photos.remove(key).catch(() => undefined);
      throw error;
    }
  });
}

/** Selfie bytes of one record (admin only; checked by the route). */
export async function readSelfie(
  db: Database,
  photos: PhotoStore,
  recordId: string,
): Promise<Uint8Array> {
  const [row] = await db
    .select({
      photoKey: attendanceRecords.photoKey,
      serverTime: attendanceRecords.serverTime,
      reviewStatus: attendanceRecords.reviewStatus,
    })
    .from(attendanceRecords)
    .where(eq(attendanceRecords.id, recordId));
  if (!row) throw errors.notFound('La marcación');
  if (!row.photoKey) throw errors.notFound('La selfie de esta marcación (se marcó sin selfie)');
  if (selfieState(row, new Date()) === 'expired') {
    throw errors.notFound('La selfie (se eliminó por la política de conservación)');
  }
  return photos.get(row.photoKey);
}
