/**
 * Attendance contracts: marking with server time, GPS and a live selfie, the
 * employee's current status (Fase 3), and the admin's timeline with reviews
 * and corrections (Fase 6).
 */
import { z } from 'zod';

import { MAX_SELFIE_BYTES } from './constants.js';

export const attendanceKindSchema = z.enum(['check_in', 'check_out']);
export type AttendanceKind = z.infer<typeof attendanceKindSchema>;

/** Why a record was accepted but flagged for an admin to look at. */
export const reviewReasonSchema = z.enum(['low_accuracy', 'stale_location']);
export type ReviewReason = z.infer<typeof reviewReasonSchema>;

export const reviewStatusSchema = z.enum(['ok', 'pending']);

const isoDateTime = z.iso.datetime({ offset: true });

/** Base64 of the JPEG: 4 characters per 3 bytes. */
const MAX_SELFIE_BASE64 = Math.ceil(MAX_SELFIE_BYTES / 3) * 4;

export const markRequestSchema = z.object({
  kind: attendanceKindSchema,
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    /** Radius of uncertainty reported by the device, in metres. */
    accuracyM: z.number().min(0).max(100_000),
    /** When the device obtained the fix (device clock). */
    capturedAt: isoDateTime,
  }),
  /** Device clock when the request was sent: informative only (§2.1). */
  deviceTime: isoDateTime,
  /**
   * Live front-camera selfie, JPEG, base64 without the data: prefix. Omitted
   * when the employee did not authorize the selfie (D7).
   */
  photo: z
    .string()
    .min(100)
    .max(MAX_SELFIE_BASE64)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/)
    .optional(),
});
export type MarkRequest = z.infer<typeof markRequestSchema>;

export const markResponseSchema = z.object({
  id: z.uuid(),
  kind: attendanceKindSchema,
  /** The only time that counts (§2.1). */
  serverTime: isoDateTime,
  accuracyM: z.number(),
  reviewStatus: reviewStatusSchema,
  reviewReasons: z.array(reviewReasonSchema),
  withSelfie: z.boolean(),
});
export type MarkResponse = z.infer<typeof markResponseSchema>;

export const attendanceStatusSchema = z.object({
  /** null = off duty; otherwise the server time of the open check-in. */
  onDutySince: isoDateTime.nullable(),
  lastRecord: z.object({ kind: attendanceKindSchema, at: isoDateTime }).nullable(),
});
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;

/** Calendar day in America/Bogota, e.g. 2026-10-08. */
export const businessDateSchema = z.iso.date();

// ── Review and corrections (Fase 6) ────────────────────────────────────────

export const reviewDecisionSchema = z.enum(['approved', 'rejected']);
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;

/** Why a correction or a rejection was made: always written by the administrator. */
const reasonText = z
  .string()
  .trim()
  .min(10, 'Escribe el motivo (al menos 10 caracteres).')
  .max(500, 'El motivo puede tener hasta 500 caracteres.');

/** A rejection needs its reason; an approval may carry a note. */
export const reviewRequestSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approved'), note: z.string().trim().max(500).optional() }),
  z.object({ decision: z.literal('rejected'), note: reasonText }),
]);
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

/** The verdict in force on a record. */
export const reviewVerdictSchema = z.object({
  decision: reviewDecisionSchema,
  note: z.string().nullable(),
  by: z.string(),
  at: isoDateTime,
});

/** Present when a record or an added mark was voided by a correction. */
export const voidInfoSchema = z.object({ reason: z.string(), by: z.string(), at: isoDateTime });

/**
 * Add forgotten marks (1–2: a whole forgotten day is entry + exit) or void
 * mistaken ones (1–4), always with a reason. Validated together.
 */
export const correctionRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    employeeId: z.uuid(),
    events: z
      .array(z.object({ kind: attendanceKindSchema, at: isoDateTime }))
      .min(1)
      .max(2),
    reason: reasonText,
  }),
  z.object({
    action: z.literal('void'),
    targetIds: z.array(z.uuid()).min(1).max(4),
    reason: reasonText,
  }),
]);
export type CorrectionRequest = z.infer<typeof correctionRequestSchema>;

const employeeRefSchema = z.object({ id: z.uuid(), name: z.string(), email: z.string() });

export const adminAttendanceEntrySchema = z.object({
  source: z.literal('record'),
  id: z.uuid(),
  employee: employeeRefSchema,
  kind: attendanceKindSchema,
  serverTime: isoDateTime,
  deviceTime: isoDateTime.nullable(),
  latitude: z.number(),
  longitude: z.number(),
  accuracyM: z.number(),
  reviewStatus: reviewStatusSchema,
  reviewReasons: z.array(reviewReasonSchema),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  /** stored · not-authorized (marked without selfie, D7) · expired (deleted by retention). */
  selfie: z.enum(['stored', 'not-authorized', 'expired']),
  verdict: reviewVerdictSchema.nullable(),
  voided: voidInfoSchema.nullable(),
});
export type AdminAttendanceEntry = z.infer<typeof adminAttendanceEntrySchema>;

/** A mark added by an administrator: its time is theirs, never the server's. */
export const adminCorrectionEntrySchema = z.object({
  source: z.literal('correction'),
  id: z.uuid(),
  employee: employeeRefSchema,
  kind: attendanceKindSchema,
  at: isoDateTime,
  reason: z.string(),
  by: z.string(),
  createdAt: isoDateTime,
  voided: voidInfoSchema.nullable(),
});
export type AdminCorrectionEntry = z.infer<typeof adminCorrectionEntrySchema>;

/** One line of the admin's timeline: a real mark or an added one. */
export const adminTimelineEntrySchema = z.discriminatedUnion('source', [
  adminAttendanceEntrySchema,
  adminCorrectionEntrySchema,
]);
export type AdminTimelineEntry = z.infer<typeof adminTimelineEntrySchema>;
