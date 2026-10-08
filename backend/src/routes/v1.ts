/**
 * Public API v1. Every route declares its input/output schema (validated by
 * zod, documented in OpenAPI) and its access level: public, session or admin.
 */
import {
  auditEntrySchema,
  consentRequestSchema,
  createEmployeeSchema,
  employeeSchema,
  googleLoginRequestSchema,
  meSchema,
  nonceResponseSchema,
  updateEmployeeSchema,
} from '@pj20/shared';
import { desc } from 'drizzle-orm';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  clearSessionCookie,
  requireAdmin,
  requireSession,
  setSessionCookie,
} from '../auth/plugin.js';
import { acceptConsent, type AuthDeps, currentUser, signInWithGoogle } from '../auth/service.js';
import { revokeSession } from '../auth/sessions.js';
import { auditLog } from '../db/schema.js';
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
} from '../employees/service.js';

const idParams = z.object({ id: z.uuid() });

export interface V1Options extends AuthDeps {
  /** Sign-in attempts per minute per IP (brute-force protection, CLAUDE.md §1.9). */
  authRateLimitMax?: number;
}

export const v1Routes: FastifyPluginCallbackZod<V1Options> = (app, deps, done) => {
  const { db } = deps;
  const AUTH_RATE_LIMIT = {
    rateLimit: { max: deps.authRateLimitMax ?? 10, timeWindow: '1 minute' },
  };
  const meta = (request: { headers: Record<string, unknown>; ip: string; id: string }) => ({
    userAgent:
      typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
    ip: request.ip,
    requestId: request.id,
  });

  // ── Auth ────────────────────────────────────────────────────────────────
  app.post(
    '/auth/nonce',
    { config: AUTH_RATE_LIMIT, schema: { tags: ['auth'], response: { 200: nonceResponseSchema } } },
    async () => ({ nonce: await deps.nonces.issue() }),
  );

  app.post(
    '/auth/google',
    {
      config: AUTH_RATE_LIMIT,
      schema: { tags: ['auth'], body: googleLoginRequestSchema, response: { 200: meSchema } },
    },
    async (request, reply) => {
      const { token, expiresAt, me } = await signInWithGoogle(
        deps,
        request.body.credential,
        request.body.nonce,
        meta(request),
      );
      setSessionCookie(reply, token, expiresAt);
      return me;
    },
  );

  app.post('/auth/logout', { schema: { tags: ['auth'] } }, async (request, reply) => {
    if (request.session) await revokeSession(db, request.session.sessionId);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  // ── Current user ────────────────────────────────────────────────────────
  app.get('/me', { schema: { tags: ['me'], response: { 200: meSchema } } }, async (request) =>
    currentUser(db, requireSession(request)),
  );

  app.post(
    '/me/consent',
    { schema: { tags: ['me'], body: consentRequestSchema } },
    async (request, reply) => {
      await acceptConsent(db, requireSession(request), meta(request));
      return reply.code(204).send();
    },
  );

  // ── Admin ───────────────────────────────────────────────────────────────
  const adminContext = (request: Parameters<typeof requireAdmin>[0]) => {
    const session = requireAdmin(request);
    return {
      me: { id: session.employee.id },
      audit: { actor: session.employee, requestId: request.id, ip: request.ip },
    };
  };

  app.get(
    '/admin/employees',
    { schema: { tags: ['admin'], response: { 200: z.array(employeeSchema) } } },
    async (request) => {
      requireAdmin(request);
      return listEmployees(db);
    },
  );

  app.post(
    '/admin/employees',
    { schema: { tags: ['admin'], body: createEmployeeSchema, response: { 201: employeeSchema } } },
    async (request, reply) => {
      const { audit } = adminContext(request);
      return reply.code(201).send(await createEmployee(db, request.body, audit));
    },
  );

  app.patch(
    '/admin/employees/:id',
    {
      schema: {
        tags: ['admin'],
        params: idParams,
        body: updateEmployeeSchema,
        response: { 200: employeeSchema },
      },
    },
    async (request) => {
      const { me, audit } = adminContext(request);
      return updateEmployee(db, request.params.id, request.body, me, audit);
    },
  );

  app.delete(
    '/admin/employees/:id',
    { schema: { tags: ['admin'], params: idParams } },
    async (request, reply) => {
      const { me, audit } = adminContext(request);
      await deleteEmployee(db, request.params.id, me, audit);
      return reply.code(204).send();
    },
  );

  app.get(
    '/admin/audit',
    {
      schema: {
        tags: ['admin'],
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }),
        response: { 200: z.array(auditEntrySchema) },
      },
    },
    async (request) => {
      requireAdmin(request);
      const rows = await db
        .select()
        .from(auditLog)
        .orderBy(desc(auditLog.id))
        .limit(request.query.limit);
      return rows.map((r) => ({
        id: r.id,
        at: r.at.toISOString(),
        actorId: r.actorId,
        actorName: r.actorName,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        before: r.before,
        after: r.after,
      }));
    },
  );

  done();
};
