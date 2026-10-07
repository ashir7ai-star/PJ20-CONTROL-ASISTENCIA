import type { ApiErrorCode } from '@pj20/shared';

/**
 * Expected, user-facing failures. The message is Spanish and safe to show;
 * anything else is treated as an internal error and never leaks details.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const errors = {
  invalidCredential: () =>
    new DomainError(
      'INVALID_CREDENTIAL',
      401,
      'No pudimos verificar tu cuenta de Google. Intenta de nuevo.',
    ),
  accountNotAuthorized: () =>
    new DomainError(
      'ACCOUNT_NOT_AUTHORIZED',
      403,
      'Tu cuenta no está autorizada. Pide acceso a tu administrador.',
    ),
  sessionRequired: () =>
    new DomainError('SESSION_REQUIRED', 401, 'Tu sesión terminó. Inicia sesión de nuevo.'),
  forbidden: () => new DomainError('FORBIDDEN', 403, 'No tienes permiso para hacer esto.'),
  originNotAllowed: () => new DomainError('ORIGIN_NOT_ALLOWED', 403, 'Solicitud no permitida.'),
  notFound: (what: string) => new DomainError('NOT_FOUND', 404, `${what} no existe.`),
  conflict: (message: string) => new DomainError('CONFLICT', 409, message),
  ruleViolation: (message: string) => new DomainError('RULE_VIOLATION', 422, message),
};
