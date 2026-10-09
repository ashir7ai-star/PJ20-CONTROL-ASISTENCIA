/**
 * Attendance contracts (Fase 3): marking with server time, GPS and a live
 * selfie, the employee's current status and the admin's daily view.
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

export const adminAttendanceEntrySchema = z.object({
  id: z.uuid(),
  employee: z.object({ id: z.uuid(), name: z.string(), email: z.string() }),
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
});
export type AdminAttendanceEntry = z.infer<typeof adminAttendanceEntrySchema>;
