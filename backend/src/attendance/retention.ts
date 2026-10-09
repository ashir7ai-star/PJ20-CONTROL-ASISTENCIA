/**
 * Selfie retention (D7, Decreto 1377 art. 11): deletes the photos whose time
 * is up — 90 days, or up to a year while the record waits for review. The
 * attendance rows (time, type, place) stay: they are labour records.
 * Also removes orphan photos (an upload whose record was never saved).
 */
import { inArray } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { attendanceRecords } from '../db/schema.js';
import type { PhotoStore } from '../infra/photo-store.js';
import { selfieExpired } from './rules.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** selfies/YYYY/MM/DD/<employee>/<record>.jpg */
const KEY = /^selfies\/(\d{4})\/(\d{2})\/(\d{2})\/[^/]+\/([0-9a-f-]{36})\.jpg$/;

export async function purgeExpiredSelfies(
  db: Database,
  photos: PhotoStore,
  now: Date,
): Promise<{ deleted: number }> {
  const candidates = new Map<string, string>(); // record id → key
  for (const key of await photos.listKeys('selfies/')) {
    const match = KEY.exec(key);
    if (!match) continue;
    const [, y, m, d, recordId] = match;
    const day = Date.UTC(Number(y), Number(m) - 1, Number(d));
    // Younger than the shortest retention: nothing to decide yet.
    if (now.getTime() - day > DAY_MS && recordId) candidates.set(recordId, key);
  }
  if (candidates.size === 0) return { deleted: 0 };

  const ids = [...candidates.keys()];
  const records = new Map<string, { serverTime: Date; reviewStatus: 'ok' | 'pending' }>();
  for (let i = 0; i < ids.length; i += 500) {
    const rows = await db
      .select({
        id: attendanceRecords.id,
        serverTime: attendanceRecords.serverTime,
        reviewStatus: attendanceRecords.reviewStatus,
      })
      .from(attendanceRecords)
      .where(inArray(attendanceRecords.id, ids.slice(i, i + 500)));
    for (const row of rows) records.set(row.id, row);
  }

  let deleted = 0;
  for (const [id, key] of candidates) {
    const record = records.get(id);
    if (!record || selfieExpired(record, now)) {
      await photos.remove(key);
      deleted += 1;
    }
  }
  return { deleted };
}
