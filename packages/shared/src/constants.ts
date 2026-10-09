/**
 * Plain constants with no zod dependency, importable as `@pj20/shared/constants`
 * by the employee bundle without shipping the validation library to every phone.
 */

/** Current version of the data-processing consent text (Ley 1581). */
export const CONSENT_VERSION = '2026-10';
export const CONSENT_LABEL = 'Versión 1 · octubre de 2026';

/** Machine-readable error codes the app maps to Spanish messages. */
export const apiErrorCodes = [
  'VALIDATION_ERROR',
  'INVALID_CREDENTIAL',
  'ACCOUNT_NOT_AUTHORIZED',
  'SESSION_REQUIRED',
  'FORBIDDEN',
  'RULE_VIOLATION',
  'CONFLICT',
  'NOT_FOUND',
  'RATE_LIMITED',
  'ORIGIN_NOT_ALLOWED',
  'INTERNAL_ERROR',
] as const;
export type ApiErrorCode = (typeof apiErrorCodes)[number];

// ── Attendance (CLAUDE.md §2) ──────────────────────────────────────────────

/** GPS accuracy above this (metres) is accepted but flagged for review (§2.6). */
export const WEAK_ACCURACY_M = 100;
/** A GPS fix older than this when marking is flagged for review (§2B.5). */
export const MAX_FIX_AGE_S = 30;
/** Largest accepted selfie (JPEG bytes). The app sends ~150–400 KB. */
export const MAX_SELFIE_BYTES = 2 * 1024 * 1024;
/**
 * Retention (D7, Decreto 1377 art. 11): selfies are deleted after 90 days, or
 * after a year at most while their record waits for review. Attendance records
 * are kept for the employment plus 3 years (art. 488 CST, Ley 2466 art. 12).
 */
export const SELFIE_RETENTION_DAYS = 90;
export const SELFIE_REVIEW_RETENTION_DAYS = 365;
export const RECORD_RETENTION_YEARS_AFTER_EMPLOYMENT = 3;

/** Business time zone (no daylight saving: always UTC−5). */
export const BUSINESS_TIME_ZONE = 'America/Bogota';
