/**
 * Database schema (PostgreSQL 18). Migrations are generated from this file
 * with drizzle-kit and committed as versioned SQL (CLAUDE.md §4.6).
 * Security-related SQL (immutability triggers, least-privilege role) lives in
 * a hand-written migration next to the generated ones.
 */
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigserial,
  boolean,
  check,
  doublePrecision,
  index,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum('role', ['employee', 'admin']);

/** Allowlist: only these Google accounts can sign in. */
export const employees = pgTable(
  'employees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** Always stored lowercase (enforced by a CHECK constraint). */
    email: text('email').notNull().unique(),
    role: roleEnum('role').notNull().default('employee'),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('employees_email_lowercase', sql`${t.email} = lower(${t.email})`)],
);

/** Server-side sessions (decision D2). Only the SHA-256 of the token is stored. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    ip: text('ip'),
  },
  (t) => [index('sessions_employee_id_idx').on(t.employeeId)],
);

/**
 * Proof of informed consent (Ley 1581). Append-only: a trigger rejects
 * UPDATE/DELETE, and an employee with consent records cannot be deleted
 * (only deactivated) because of ON DELETE RESTRICT.
 */
export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'restrict' }),
    version: text('version').notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [index('consents_employee_version_idx').on(t.employeeId, t.version)],
);

/**
 * Immutable audit trail (CLAUDE.md §2.5). No foreign keys on purpose: the
 * actor name is snapshotted so entries stay meaningful forever.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    actorId: uuid('actor_id'),
    actorName: text('actor_name'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    requestId: text('request_id'),
    ip: text('ip'),
  },
  (t) => [index('audit_log_at_idx').on(t.at)],
);

export const attendanceKindEnum = pgEnum('attendance_kind', ['check_in', 'check_out']);
export const reviewStatusEnum = pgEnum('review_status', ['ok', 'pending']);

/**
 * Clock-in/out records (CLAUDE.md §2). Immutable: a trigger rejects UPDATE,
 * DELETE and TRUNCATE and the API role may only SELECT and INSERT. A
 * correction will be a new adjustment record (Fase 6), never an edit.
 * server_time is the only time that counts; device_time is informative.
 */
export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: uuid('id').primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'restrict' }),
    kind: attendanceKindEnum('kind').notNull(),
    serverTime: timestamp('server_time', { withTimezone: true }).notNull().defaultNow(),
    deviceTime: timestamp('device_time', { withTimezone: true }),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    accuracyM: real('accuracy_m').notNull(),
    locationCapturedAt: timestamp('location_captured_at', { withTimezone: true }).notNull(),
    /**
     * Object key of the selfie in the private bucket; null when the employee
     * did not authorize the selfie (sensitive data, D7) and marked without it.
     */
    photoKey: text('photo_key'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    reviewStatus: reviewStatusEnum('review_status').notNull(),
    reviewReasons: text('review_reasons')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
  },
  (t) => [
    index('attendance_employee_time_idx').on(t.employeeId, t.serverTime),
    index('attendance_server_time_idx').on(t.serverTime),
    check('attendance_latitude_range', sql`${t.latitude} BETWEEN -90 AND 90`),
    check('attendance_longitude_range', sql`${t.longitude} BETWEEN -180 AND 180`),
    check('attendance_accuracy_positive', sql`${t.accuracyM} >= 0`),
  ],
);

export const accessRequestStatusEnum = pgEnum('access_request_status', [
  'pending',
  'approved',
  'rejected',
]);

/**
 * Access requests from Google accounts that failed the allowlist (D6). Name and
 * e-mail come from a server-verified Google ID token, never typed by hand.
 * Resolved requests are deleted after 30 days (Ley 1581: minimum retention).
 */
export const accessRequests = pgTable(
  'access_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    status: accessRequestStatusEnum('status').notNull().default('pending'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    /** Snapshot of who resolved it (no FK: kept meaningful like the audit log). */
    resolvedById: uuid('resolved_by_id'),
    resolvedByName: text('resolved_by_name'),
  },
  (t) => [
    check('access_requests_email_lowercase', sql`${t.email} = lower(${t.email})`),
    // One open request per e-mail.
    uniqueIndex('access_requests_one_pending_idx')
      .on(t.email)
      .where(sql`${t.status} = 'pending'`),
  ],
);

/**
 * Selfie authorization history (D7). The face is sensitive data (Ley 1581
 * art. 5): it needs its own express authorization, separate from the general
 * one, and the employee may refuse or revoke it at any time. Append-only: the
 * latest row is the current decision; earlier rows are the proof of each one.
 */
export const selfieAuthorizations = pgTable(
  'selfie_authorizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'restrict' }),
    authorized: boolean('authorized').notNull(),
    /** Version of the consent text shown when deciding. */
    version: text('version').notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [index('selfie_authorizations_employee_idx').on(t.employeeId, t.decidedAt)],
);

/**
 * Result of every off-server backup run (D8). Written by the backup service
 * with its own read-only role (it may only INSERT here); read by the admin
 * panel to show the last good copy and warn when backups stop.
 */
export const backupRuns = pgTable(
  'backup_runs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** db-daily · db-monthly · selfies */
    kind: text('kind').notNull(),
    ok: boolean('ok').notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }).notNull().defaultNow(),
    /** Short, non-sensitive summary (size, files, or the error line). */
    detail: text('detail'),
  },
  (t) => [
    index('backup_runs_finished_idx').on(t.finishedAt),
    check('backup_runs_kind', sql`${t.kind} IN ('db-daily', 'db-monthly', 'selfies')`),
  ],
);

export const reviewDecisionEnum = pgEnum('review_decision', ['approved', 'rejected']);

/**
 * The administrator's verdict on a record waiting for review (Fase 6). A
 * rejected record stays in the timeline but its shift does not count as worked
 * time. Append-only: the latest row is the verdict in force.
 */
export const attendanceReviews = pgTable(
  'attendance_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordId: uuid('record_id')
      .notNull()
      .references(() => attendanceRecords.id, { onDelete: 'restrict' }),
    decision: reviewDecisionEnum('decision').notNull(),
    note: text('note'),
    /** Snapshot of who decided (no FK: kept meaningful like the audit log). */
    reviewerId: uuid('reviewer_id').notNull(),
    reviewerName: text('reviewer_name').notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('attendance_reviews_record_idx').on(t.recordId, t.decidedAt),
    check('attendance_reviews_note_length', sql`char_length(${t.note}) <= 500`),
    check(
      'attendance_reviews_rejection_note',
      sql`${t.decision} = 'approved' OR coalesce(char_length(${t.note}), 0) >= 10`,
    ),
  ],
);

export const correctionActionEnum = pgEnum('correction_action', ['add', 'void']);

/**
 * Corrections of the attendance timeline (CLAUDE.md §2.4): records are never
 * edited, so a forgotten mark is ADDED with the time the administrator sets,
 * and a mistaken one is VOIDED, always with a reason. Append-only.
 */
export const attendanceCorrections = pgTable(
  'attendance_corrections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'restrict' }),
    action: correctionActionEnum('action').notNull(),
    /** add: the kind and time of the forgotten mark. */
    kind: attendanceKindEnum('kind'),
    effectiveTime: timestamp('effective_time', { withTimezone: true }),
    /** void: exactly one target, a record or an earlier "add" correction. */
    voidsRecordId: uuid('voids_record_id').references(() => attendanceRecords.id, {
      onDelete: 'restrict',
    }),
    voidsCorrectionId: uuid('voids_correction_id').references(
      (): AnyPgColumn => attendanceCorrections.id,
      { onDelete: 'restrict' },
    ),
    reason: text('reason').notNull(),
    /** Snapshot of who corrected (no FK: kept meaningful like the audit log). */
    authorId: uuid('author_id').notNull(),
    authorName: text('author_name').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('attendance_corrections_employee_idx').on(t.employeeId, t.effectiveTime),
    uniqueIndex('attendance_corrections_voids_record_idx')
      .on(t.voidsRecordId)
      .where(sql`${t.voidsRecordId} IS NOT NULL`),
    uniqueIndex('attendance_corrections_voids_correction_idx')
      .on(t.voidsCorrectionId)
      .where(sql`${t.voidsCorrectionId} IS NOT NULL`),
    check('attendance_corrections_reason_length', sql`char_length(${t.reason}) BETWEEN 10 AND 500`),
    check(
      'attendance_corrections_shape',
      sql`(${t.action} = 'add' AND ${t.kind} IS NOT NULL AND ${t.effectiveTime} IS NOT NULL
            AND ${t.voidsRecordId} IS NULL AND ${t.voidsCorrectionId} IS NULL)
        OR (${t.action} = 'void' AND ${t.kind} IS NULL AND ${t.effectiveTime} IS NULL
            AND num_nonnulls(${t.voidsRecordId}, ${t.voidsCorrectionId}) = 1)`,
    ),
  ],
);
