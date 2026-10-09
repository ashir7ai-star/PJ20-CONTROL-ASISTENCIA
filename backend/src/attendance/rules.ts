/**
 * Attendance business rules (CLAUDE.md §2, §2B). Pure functions: no I/O, so
 * every rule is unit-tested in isolation and the service only orchestrates.
 */
import {
  type AttendanceKind,
  MAX_FIX_AGE_S,
  MAX_SELFIE_BYTES,
  type ReviewReason,
  SELFIE_RETENTION_DAYS,
  SELFIE_REVIEW_RETENTION_DAYS,
  WEAK_ACCURACY_M,
} from '@pj20/shared';

/** Bogotá has no daylight saving time: always UTC−5. */
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * No check-in over check-in, no check-out without check-in (§2.6).
 * Returns the Spanish reason when the transition is not allowed.
 */
export function transitionError(last: AttendanceKind | null, next: AttendanceKind): string | null {
  if (next === 'check_in' && last === 'check_in') {
    return 'Ya tienes una entrada registrada. Marca tu salida primero.';
  }
  if (next === 'check_out' && last !== 'check_in') {
    return 'No tienes una entrada abierta. Marca tu entrada primero.';
  }
  return null;
}

/**
 * Accepted-but-suspicious signals. The record is saved either way; these only
 * put it in the admin's review queue (§2.6, §2B.5).
 * The fix age compares two device-clock times, so a wrong phone clock does
 * not distort it.
 */
export function reviewReasons(input: {
  accuracyM: number;
  locationCapturedAt: Date;
  deviceTime: Date;
}): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  if (input.accuracyM > WEAK_ACCURACY_M) reasons.push('low_accuracy');
  const fixAgeS = (input.deviceTime.getTime() - input.locationCapturedAt.getTime()) / 1000;
  if (fixAgeS > MAX_FIX_AGE_S) reasons.push('stale_location');
  return reasons;
}

/** A real JPEG starts with FF D8 FF and ends with FF D9. */
export function isValidSelfie(bytes: Uint8Array): boolean {
  if (bytes.length < 1024 || bytes.length > MAX_SELFIE_BYTES) return false;
  const n = bytes.length;
  return (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes[n - 2] === 0xff &&
    bytes[n - 1] === 0xd9
  );
}

/** UTC instants that bound a calendar day in Bogotá ("2026-10-08"). */
export function businessDayRange(date: string): { start: Date; end: Date } {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Fecha inválida: ${date}`);
  const start = new Date(Date.UTC(y, m - 1, d) + BOGOTA_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Today's calendar date in Bogotá. */
export function businessToday(now: Date): string {
  return new Date(now.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Object key of a selfie: grouped by Bogotá day, unguessable record id. */
export function selfieKey(employeeId: string, recordId: string, serverTime: Date): string {
  const day = businessToday(serverTime);
  return `selfies/${day.replaceAll('-', '/')}/${employeeId}/${recordId}.jpg`;
}

/**
 * Retention of selfies (D7, Decreto 1377 art. 11): 90 days, or up to a year
 * while the record still waits for review. Attendance rows themselves stay.
 */
export function selfieExpired(
  record: { serverTime: Date; reviewStatus: 'ok' | 'pending' },
  now: Date,
): boolean {
  const ageDays = (now.getTime() - record.serverTime.getTime()) / DAY_MS;
  const limit =
    record.reviewStatus === 'pending' ? SELFIE_REVIEW_RETENTION_DAYS : SELFIE_RETENTION_DAYS;
  return ageDays > limit;
}

/** What the admin can see of a record's selfie. */
export function selfieState(
  record: { photoKey: string | null; serverTime: Date; reviewStatus: 'ok' | 'pending' },
  now: Date,
): 'stored' | 'not-authorized' | 'expired' {
  if (!record.photoKey) return 'not-authorized';
  return selfieExpired(record, now) ? 'expired' : 'stored';
}

/**
 * Selfie rule (D7): authorized → the photo is required; not authorized (or never
 * decided) → no photo may be sent. Returns the Spanish reason when broken.
 */
export function selfieRuleError(authorized: boolean | null, hasPhoto: boolean): string | null {
  if (authorized === true && !hasPhoto) return 'Falta la selfie. Toma la foto para marcar.';
  if (authorized !== true && hasPhoto) {
    return 'No autorizaste la selfie: marca solo con tu ubicación, o autorízala desde tu cuenta.';
  }
  return null;
}
