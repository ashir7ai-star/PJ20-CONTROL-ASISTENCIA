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
