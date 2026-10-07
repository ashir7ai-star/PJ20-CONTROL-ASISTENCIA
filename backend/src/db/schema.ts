/**
 * Database schema (PostgreSQL 18). Migrations are generated from this file
 * with drizzle-kit and committed as versioned SQL (CLAUDE.md §4.6).
 * Security-related SQL (immutability triggers, least-privilege role) lives in
 * a hand-written migration next to the generated ones.
 */
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
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
