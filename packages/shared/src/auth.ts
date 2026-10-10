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
  /**
   * Selfie authorization (sensitive data, D7): true/false = the latest decision,
   * null = never decided (asked together with the consent).
   */
  selfieAuthorized: z.boolean().nullable(),
});
export type Me = z.infer<typeof meSchema>;

/** The general consent and, SEPARATELY, the optional selfie authorization (D7). */
export const consentRequestSchema = z.object({
  version: z.literal(CONSENT_VERSION),
  selfie: z.boolean(),
});

/** Change of mind at any time: grant or revoke the selfie authorization. */
export const selfieAuthorizationRequestSchema = z.object({ authorized: z.boolean() });

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

// ── Access requests (D6) ──────────────────────────────────────────────────

/** The Google identity that just failed the allowlist, as the server verified it. */
export const accessRequestCurrentSchema = z.object({
  name: z.string(),
  email: z.email(),
  /** true when this e-mail already has a request waiting for an admin. */
  pending: z.boolean(),
});
export type AccessRequestCurrent = z.infer<typeof accessRequestCurrentSchema>;

export const accessRequestCreatedSchema = z.object({
  status: z.enum(['created', 'pending']),
});

export const accessRequestSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  requestedAt: z.iso.datetime(),
  /** The e-mail belongs to a deactivated employee: approving reactivates them. */
  deactivatedEmployee: z.boolean(),
});
export type AccessRequestDto = z.infer<typeof accessRequestSchema>;

// ── Off-server backups (D8) ───────────────────────────────────────────────

const backupKindStatusSchema = z.object({
  lastSuccessAt: z.iso.datetime().nullable(),
  /** The latest run, when it failed after the last success (short, non-sensitive). */
  lastFailure: z.object({ at: z.iso.datetime(), detail: z.string().nullable() }).nullable(),
});

export const backupStatusSchema = z.object({
  database: backupKindStatusSchema,
  selfies: backupKindStatusSchema,
  /** No good database copy in the last 36 hours (or ever): the panel warns. */
  stale: z.boolean(),
});
export type BackupStatus = z.infer<typeof backupStatusSchema>;
