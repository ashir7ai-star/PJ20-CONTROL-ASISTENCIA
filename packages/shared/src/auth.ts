/**
 * API contracts for authentication, the current user and user management.
 * Validated on the server (source of truth) and reused by the app.
 */
import { z } from 'zod';

import { CONSENT_VERSION } from './constants.js';

export const roleSchema = z.enum(['employee', 'admin']);
export type Role = z.infer<typeof roleSchema>;

// ── Auth ──────────────────────────────────────────────────────────────────

export const nonceResponseSchema = z.object({ nonce: z.string().min(16) });
export type NonceResponse = z.infer<typeof nonceResponseSchema>;

export const googleLoginRequestSchema = z.object({
  /** ID token returned by Google Identity Services. */
  credential: z.string().min(20).max(4096),
  nonce: z.string().min(16).max(128),
});
export type GoogleLoginRequest = z.infer<typeof googleLoginRequestSchema>;

// ── Current user ──────────────────────────────────────────────────────────

export const meSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: roleSchema,
  /** True when the user must (re)accept the current consent version. */
  consentRequired: z.boolean(),
});
export type Me = z.infer<typeof meSchema>;

export const consentRequestSchema = z.object({ version: z.literal(CONSENT_VERSION) });

// ── User management (admin) ───────────────────────────────────────────────

const emailInput = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Correo no válido' }).max(254));

export const employeeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: roleSchema,
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  /** Consents + attendance records: anyone with history can only be deactivated. */
  recordCount: z.number().int().min(0),
});
export type EmployeeDto = z.infer<typeof employeeSchema>;

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(3, 'Escribe el nombre completo').max(120),
  email: emailInput,
  role: roleSchema.default('employee'),
});
export type CreateEmployeeRequest = z.input<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z
  .object({ role: roleSchema.optional(), active: z.boolean().optional() })
  .refine((v) => v.role !== undefined || v.active !== undefined, {
    message: 'Indica el rol o el estado a cambiar',
  });
export type UpdateEmployeeRequest = z.infer<typeof updateEmployeeSchema>;

export const auditEntrySchema = z.object({
  id: z.number().int(),
  at: z.iso.datetime(),
  actorId: z.uuid().nullable(),
  actorName: z.string().nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;
