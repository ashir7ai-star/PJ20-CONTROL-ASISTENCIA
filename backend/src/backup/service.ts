/**
 * Backup health for the admin panel (D8): the latest good copy of the database
 * and of the selfies, the latest failure if it came after it, and whether the
 * database copy is too old. The runs are written by the backup service.
 */
import type { BackupStatus } from '@pj20/shared';
import { and, desc, eq } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { backupRuns } from '../db/schema.js';

/** A day plus a margin: the daily 02:00 run may be a little late. */
export const BACKUP_STALE_AFTER_MS = 36 * 60 * 60 * 1000;

async function kindStatus(db: Database, kind: 'db-daily' | 'selfies') {
  const [success] = await db
    .select({ at: backupRuns.finishedAt })
    .from(backupRuns)
    .where(and(eq(backupRuns.kind, kind), eq(backupRuns.ok, true)))
    .orderBy(desc(backupRuns.finishedAt))
    .limit(1);
  const [latest] = await db
    .select({ at: backupRuns.finishedAt, ok: backupRuns.ok, detail: backupRuns.detail })
    .from(backupRuns)
    .where(eq(backupRuns.kind, kind))
    .orderBy(desc(backupRuns.finishedAt))
    .limit(1);
  return {
    lastSuccessAt: success?.at ?? null,
    lastFailure: latest && !latest.ok ? { at: latest.at, detail: latest.detail } : null,
  };
}

export async function backupStatus(db: Database, now: Date): Promise<BackupStatus> {
  const [database, selfies] = await Promise.all([
    kindStatus(db, 'db-daily'),
    kindStatus(db, 'selfies'),
  ]);
  const iso = (s: Awaited<ReturnType<typeof kindStatus>>) => ({
    lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
    lastFailure: s.lastFailure
      ? { at: s.lastFailure.at.toISOString(), detail: s.lastFailure.detail }
      : null,
  });
  return {
    database: iso(database),
    selfies: iso(selfies),
    stale:
      !database.lastSuccessAt ||
      now.getTime() - database.lastSuccessAt.getTime() > BACKUP_STALE_AFTER_MS,
  };
}
