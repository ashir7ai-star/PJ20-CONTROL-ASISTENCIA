/**
 * Reads the effective timeline from the database (Fase 6): records and
 * "add" corrections that no correction has voided. Shared by marking (the
 * employee marks against it) and by corrections (validated against it).
 */
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';

import type { Executor } from '../db/client.js';
import { attendanceCorrections, attendanceRecords } from '../db/schema.js';
import type { TimelineEvent } from './timeline.js';

/** No void correction points at this record. */
const recordInForce = sql`NOT EXISTS (
  SELECT 1 FROM ${attendanceCorrections} AS void_of
  WHERE void_of.voids_record_id = ${attendanceRecords.id})`;

/** An "add" correction that no void correction points at. */
const addedInForce = and(
  eq(attendanceCorrections.action, 'add'),
  sql`NOT EXISTS (
    SELECT 1 FROM ${attendanceCorrections} AS void_of
    WHERE void_of.voids_correction_id = ${attendanceCorrections.id})`,
);

export interface EffectiveEvent extends TimelineEvent {
  source: 'record' | 'correction';
}

/** The latest event in force: what the employee's next mark must follow. */
export async function lastEffectiveEvent(
  db: Executor,
  employeeId: string,
): Promise<EffectiveEvent | null> {
  const [record] = await db
    .select({
      id: attendanceRecords.id,
      kind: attendanceRecords.kind,
      at: attendanceRecords.serverTime,
    })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.employeeId, employeeId), recordInForce))
    .orderBy(desc(attendanceRecords.serverTime))
    .limit(1);
  const [added] = await db
    .select({
      id: attendanceCorrections.id,
      kind: attendanceCorrections.kind,
      at: attendanceCorrections.effectiveTime,
    })
    .from(attendanceCorrections)
    .where(
      and(
        eq(attendanceCorrections.employeeId, employeeId),
        addedInForce,
        isNotNull(attendanceCorrections.effectiveTime),
      ),
    )
    .orderBy(desc(attendanceCorrections.effectiveTime))
    .limit(1);

  const fromRecord: EffectiveEvent | null = record ? { ...record, source: 'record' } : null;
  const fromCorrection: EffectiveEvent | null =
    added?.kind && added.at
      ? { id: added.id, kind: added.kind, at: added.at, source: 'correction' }
      : null;
  if (!fromRecord) return fromCorrection;
  if (!fromCorrection) return fromRecord;
  return fromCorrection.at > fromRecord.at ? fromCorrection : fromRecord;
}

/** Every event in force for one employee, oldest first. */
export async function effectiveTimeline(
  db: Executor,
  employeeId: string,
): Promise<EffectiveEvent[]> {
  const records = await db
    .select({
      id: attendanceRecords.id,
      kind: attendanceRecords.kind,
      at: attendanceRecords.serverTime,
    })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.employeeId, employeeId), recordInForce));
  const added = await db
    .select({
      id: attendanceCorrections.id,
      kind: attendanceCorrections.kind,
      at: attendanceCorrections.effectiveTime,
    })
    .from(attendanceCorrections)
    .where(and(eq(attendanceCorrections.employeeId, employeeId), addedInForce));

  const events: EffectiveEvent[] = records.map((r) => ({ ...r, source: 'record' }));
  for (const a of added) {
    if (a.kind && a.at) events.push({ id: a.id, kind: a.kind, at: a.at, source: 'correction' });
  }
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}
