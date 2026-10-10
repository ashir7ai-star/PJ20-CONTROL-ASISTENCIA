/**
 * The administrator's side of the timeline (Fase 6): the day list with
 * verdicts and corrections, the review queue, and the two ways to fix the
 * timeline without ever touching a record (CLAUDE.md §2.4): review verdicts
 * and corrections. Every change is audited in the same transaction.
 */
import type {
  AdminAttendanceEntry,
  AdminCorrectionEntry,
  AdminTimelineEntry,
  CorrectionRequest,
  ReviewReason,
  ReviewRequest,
} from '@pj20/shared';
import { and, asc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';

import { type AuditContext, audit } from '../audit.js';
import type { Database, Executor } from '../db/client.js';
import {
  attendanceCorrections,
  attendanceRecords,
  attendanceReviews,
  employees,
} from '../db/schema.js';
import { errors } from '../errors.js';
import { businessDayRange, selfieState } from './rules.js';
import { type TimelineEvent, timelineError } from './timeline.js';
import { effectiveTimeline } from './timeline-store.js';

/** How far back a forgotten mark may be added (a payroll quarter). */
export const MAX_CORRECTION_AGE_DAYS = 92;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Tolerance for the administrator's clock when adding "just now". */
const CLOCK_SKEW_MS = 60_000;
const REVIEW_QUEUE_LIMIT = 200;

type RecordRow = typeof attendanceRecords.$inferSelect;
type EmployeeRow = typeof employees.$inferSelect;
type Verdicts = Map<string, AdminAttendanceEntry['verdict']>;
type Voids = Map<string, NonNullable<AdminAttendanceEntry['voided']>>;

const employeeRef = (e: EmployeeRow) => ({ id: e.id, name: e.name, email: e.email });

/** Latest verdict of each record. */
async function verdictsFor(db: Executor, recordIds: string[]): Promise<Verdicts> {
  const verdicts: Verdicts = new Map();
  if (recordIds.length === 0) return verdicts;
  const rows = await db
    .select()
    .from(attendanceReviews)
    .where(inArray(attendanceReviews.recordId, recordIds))
    .orderBy(asc(attendanceReviews.decidedAt));
  for (const r of rows) {
    verdicts.set(r.recordId, {
      decision: r.decision,
      note: r.note,
      by: r.reviewerName,
      at: r.decidedAt.toISOString(),
    });
  }
  return verdicts;
}

/** Void corrections pointing at these records or added marks. */
async function voidsFor(db: Executor, ids: { records: string[]; added: string[] }): Promise<Voids> {
  const voids: Voids = new Map();
  const conditions = [
    ids.records.length > 0 ? inArray(attendanceCorrections.voidsRecordId, ids.records) : undefined,
    ids.added.length > 0 ? inArray(attendanceCorrections.voidsCorrectionId, ids.added) : undefined,
  ].filter((c) => c !== undefined);
  if (conditions.length === 0) return voids;
  const rows = await db
    .select()
    .from(attendanceCorrections)
    .where(conditions.length === 1 ? conditions[0] : sql.join(conditions, sql` OR `));
  for (const v of rows) {
    const target = v.voidsRecordId ?? v.voidsCorrectionId;
    if (target) {
      voids.set(target, { reason: v.reason, by: v.authorName, at: v.createdAt.toISOString() });
    }
  }
  return voids;
}

function toRecordEntry(
  r: RecordRow,
  e: EmployeeRow,
  verdicts: Verdicts,
  voids: Voids,
  now: Date,
): AdminAttendanceEntry {
  return {
    source: 'record',
    id: r.id,
    employee: employeeRef(e),
    kind: r.kind,
    serverTime: r.serverTime.toISOString(),
    deviceTime: r.deviceTime?.toISOString() ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
    accuracyM: r.accuracyM,
    reviewStatus: r.reviewStatus,
    reviewReasons: r.reviewReasons as ReviewReason[],
    ip: r.ip,
    userAgent: r.userAgent,
    selfie: selfieState(r, now),
    verdict: verdicts.get(r.id) ?? null,
    voided: voids.get(r.id) ?? null,
  };
}

/** Records and added marks of one Bogotá calendar day, newest first. */
export async function listDay(db: Database, date: string): Promise<AdminTimelineEntry[]> {
  const { start, end } = businessDayRange(date);
  const now = new Date();
  const records = await db
    .select({ record: attendanceRecords, employee: employees })
    .from(attendanceRecords)
    .innerJoin(employees, eq(employees.id, attendanceRecords.employeeId))
    .where(and(gte(attendanceRecords.serverTime, start), lt(attendanceRecords.serverTime, end)));
  const added = await db
    .select({ correction: attendanceCorrections, employee: employees })
    .from(attendanceCorrections)
    .innerJoin(employees, eq(employees.id, attendanceCorrections.employeeId))
    .where(
      and(
        eq(attendanceCorrections.action, 'add'),
        gte(attendanceCorrections.effectiveTime, start),
        lt(attendanceCorrections.effectiveTime, end),
      ),
    );

  const recordIds = records.map(({ record }) => record.id);
  const verdicts = await verdictsFor(db, recordIds);
  const voids = await voidsFor(db, {
    records: recordIds,
    added: added.map(({ correction }) => correction.id),
  });

  const entries: AdminTimelineEntry[] = records.map(({ record, employee }) =>
    toRecordEntry(record, employee, verdicts, voids, now),
  );
  for (const { correction: c, employee } of added) {
    if (!c.kind || !c.effectiveTime) continue;
    const entry: AdminCorrectionEntry = {
      source: 'correction',
      id: c.id,
      employee: employeeRef(employee),
      kind: c.kind,
      at: c.effectiveTime.toISOString(),
      reason: c.reason,
      by: c.authorName,
      createdAt: c.createdAt.toISOString(),
      voided: voids.get(c.id) ?? null,
    };
    entries.push(entry);
  }
  const instant = (e: AdminTimelineEntry) => (e.source === 'record' ? e.serverTime : e.at);
  return entries.sort(
    (a, b) =>
      instant(b).localeCompare(instant(a)) || a.employee.name.localeCompare(b.employee.name, 'es'),
  );
}

/** Flagged records without a verdict yet (and not voided), oldest first. */
export async function reviewQueue(db: Database): Promise<AdminAttendanceEntry[]> {
  const now = new Date();
  const rows = await db
    .select({ record: attendanceRecords, employee: employees })
    .from(attendanceRecords)
    .innerJoin(employees, eq(employees.id, attendanceRecords.employeeId))
    .leftJoin(attendanceReviews, eq(attendanceReviews.recordId, attendanceRecords.id))
    .leftJoin(attendanceCorrections, eq(attendanceCorrections.voidsRecordId, attendanceRecords.id))
    .where(
      and(
        eq(attendanceRecords.reviewStatus, 'pending'),
        isNull(attendanceReviews.id),
        isNull(attendanceCorrections.id),
      ),
    )
    .orderBy(asc(attendanceRecords.serverTime))
    .limit(REVIEW_QUEUE_LIMIT);
  return rows.map(({ record, employee }) =>
    toRecordEntry(record, employee, new Map(), new Map(), now),
  );
}

/** Who signs a verdict or a correction: always a signed-in administrator. */
function signer(context: AuditContext): { id: string; name: string } {
  const { id, name } = context.actor;
  if (!id || !name) throw errors.forbidden();
  return { id, name };
}

/** Locks the employee row: corrections and marks of one person never interleave. */
async function lockEmployee(tx: Executor, employeeId: string): Promise<void> {
  const [row] = await tx
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .for('update');
  if (!row) throw errors.notFound('El empleado');
}

/** Records the administrator's verdict on a record. */
export async function reviewRecord(
  db: Database,
  recordId: string,
  request: ReviewRequest,
  context: AuditContext,
): Promise<void> {
  const reviewer = signer(context);
  await db.transaction(async (tx) => {
    const [record] = await tx
      .select({ id: attendanceRecords.id, employeeId: attendanceRecords.employeeId })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.id, recordId));
    if (!record) throw errors.notFound('La marcación');
    const before = (await verdictsFor(tx, [recordId])).get(recordId) ?? null;
    const note = request.note?.trim() ? request.note.trim() : null;
    await tx.insert(attendanceReviews).values({
      recordId,
      decision: request.decision,
      note,
      reviewerId: reviewer.id,
      reviewerName: reviewer.name,
    });
    await audit(tx, context, {
      action: 'attendance.reviewed',
      targetType: 'attendance_record',
      targetId: recordId,
      before,
      after: { decision: request.decision, note, employeeId: record.employeeId },
    });
  });
}

/** The single employee all void targets belong to, with each target's source. */
async function voidTargets(tx: Executor, targetIds: string[]) {
  const records = await tx
    .select({ id: attendanceRecords.id, employeeId: attendanceRecords.employeeId })
    .from(attendanceRecords)
    .where(inArray(attendanceRecords.id, targetIds));
  const added = await tx
    .select({
      id: attendanceCorrections.id,
      employeeId: attendanceCorrections.employeeId,
      action: attendanceCorrections.action,
    })
    .from(attendanceCorrections)
    .where(inArray(attendanceCorrections.id, targetIds));
  if (added.some((c) => c.action !== 'add')) {
    throw errors.ruleViolation('Una anulación no se puede anular. Agrega la marcación de nuevo.');
  }
  const found = [...records, ...added];
  if (found.length !== new Set(targetIds).size) throw errors.notFound('Una de las marcaciones');
  const owners = new Set(found.map((t) => t.employeeId));
  const [employeeId] = owners;
  if (owners.size !== 1 || !employeeId) {
    throw errors.ruleViolation('Solo se pueden anular juntas marcaciones de una misma persona.');
  }
  return { employeeId, recordIds: new Set(records.map((r) => r.id)) };
}

/**
 * Adds forgotten marks or voids mistaken ones. The resulting timeline must
 * still alternate entry → exit; otherwise nothing is saved and the reason
 * says what is missing.
 */
export async function applyCorrection(
  db: Database,
  request: CorrectionRequest,
  context: AuditContext,
  now = new Date(),
): Promise<void> {
  const { id: authorId, name: authorName } = signer(context);
  const author = { authorId, authorName };
  await db.transaction(async (tx) => {
    if (request.action === 'add') {
      const events = request.events.map((e, i) => ({
        id: `nuevo-${String(i)}`,
        kind: e.kind,
        at: new Date(e.at),
      }));
      for (const e of events) {
        if (e.at.getTime() > now.getTime() + CLOCK_SKEW_MS) {
          throw errors.ruleViolation('No se puede agregar una marcación en el futuro.');
        }
        if (now.getTime() - e.at.getTime() > MAX_CORRECTION_AGE_DAYS * DAY_MS) {
          throw errors.ruleViolation(
            `Solo se pueden agregar marcaciones de los últimos ${String(MAX_CORRECTION_AGE_DAYS)} días.`,
          );
        }
      }
      await lockEmployee(tx, request.employeeId);
      const timeline: TimelineEvent[] = await effectiveTimeline(tx, request.employeeId);
      const problem = timelineError([...timeline, ...events]);
      if (problem) throw errors.ruleViolation(problem);
      const rows = await tx
        .insert(attendanceCorrections)
        .values(
          events.map((e) => ({
            employeeId: request.employeeId,
            action: 'add' as const,
            kind: e.kind,
            effectiveTime: e.at,
            reason: request.reason,
            ...author,
          })),
        )
        .returning({ id: attendanceCorrections.id });
      await audit(tx, context, {
        action: 'attendance.corrected',
        targetType: 'employee',
        targetId: request.employeeId,
        after: {
          added: request.events.map((e, i) => ({ id: rows[i]?.id, kind: e.kind, at: e.at })),
          reason: request.reason,
        },
      });
      return;
    }

    const { employeeId, recordIds } = await voidTargets(tx, request.targetIds);
    await lockEmployee(tx, employeeId);
    const timeline = await effectiveTimeline(tx, employeeId);
    const targets = new Set(request.targetIds);
    const inForce = new Set(timeline.map((e) => e.id));
    if (request.targetIds.some((id) => !inForce.has(id))) {
      throw errors.conflict('Esa marcación ya estaba anulada.');
    }
    const problem = timelineError(timeline.filter((e) => !targets.has(e.id)));
    if (problem) throw errors.ruleViolation(problem);
    await tx.insert(attendanceCorrections).values(
      request.targetIds.map((id) => ({
        employeeId,
        action: 'void' as const,
        voidsRecordId: recordIds.has(id) ? id : null,
        voidsCorrectionId: recordIds.has(id) ? null : id,
        reason: request.reason,
        ...author,
      })),
    );
    await audit(tx, context, {
      action: 'attendance.voided',
      targetType: 'employee',
      targetId: employeeId,
      before: {
        voided: timeline
          .filter((e) => targets.has(e.id))
          .map((e) => ({ id: e.id, kind: e.kind, at: e.at.toISOString(), source: e.source })),
      },
      after: { reason: request.reason },
    });
  });
}
