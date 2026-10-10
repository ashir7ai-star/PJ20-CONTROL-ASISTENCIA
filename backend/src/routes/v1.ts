/**
 * Public API v1. Every route declares its input/output schema (validated by
 * zod, documented in OpenAPI) and its access level: public, session or admin.
 */
import {
  accessRequestCreatedSchema,
  accessRequestCurrentSchema,
  accessRequestSchema,
  adminAttendanceEntrySchema,
  adminTimelineEntrySchema,
  correctionRequestSchema,
  attendanceStatusSchema,
  auditEntrySchema,
  backupStatusSchema,
  businessDateSchema,
  consentRequestSchema,
  createEmployeeSchema,
  employeeSchema,
  googleLoginRequestSchema,
  markRequestSchema,
  markResponseSchema,
  meSchema,
  nonceResponseSchema,
  reviewRequestSchema,
  selfieAuthorizationRequestSchema,
  SIGN_IN_WINDOW_DONE_PATH,
  type SignInOutcome,
  updateEmployeeSchema,
} from '@pj20/shared';
import { desc } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  ACCESS_PROOF_COOKIE,
  NONCE_COOKIE,
  SESSION_COOKIE,
  clearNonceCookie,
  clearSessionCookie,
  requireAdmin,
  requireSession,
  setAccessProofCookie,
  setNonceCookie,
  setSessionCookie,
} from '../auth/plugin.js';
import {
  appOriginFor,
  googleAuthorizeUrl,
  SIGN_IN_WINDOW_STATE,
} from '../auth/google-authorize.js';
import {
  acceptConsent,
  type AuthDeps,
  currentUser,
  setSelfieAuthorization,
  signInWithGoogle,
} from '../auth/service.js';
import { hashToken, revokeSession } from '../auth/sessions.js';
import { ACCESS_PROOF_TTL_SECONDS, type AccessProofStore } from '../access/proof.js';
import {
  approveRequest,
  createRequest,
  currentRequest,
  listPending,
  rejectRequest,
} from '../access/service.js';
import { attendanceStatus, markAttendance, readSelfie } from '../attendance/service.js';
import {
  applyCorrection,
  listDay,
  reviewQueue,
  reviewRecord,
} from '../attendance/admin-timeline.js';
import { businessToday } from '../attendance/rules.js';
import { backupStatus } from '../backup/service.js';
import { auditLog } from '../db/schema.js';
import { AccountNotAuthorizedError, DomainError, errors } from '../errors.js';
import type { PhotoStore } from '../infra/photo-store.js';
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
} from '../employees/service.js';

const idParams = z.object({ id: z.uuid() });

/** Google posts back here in redirect mode (D5); must be listed in Google Cloud. */
const GOOGLE_ORIGINS = ['https://accounts.google.com', 'null'] as const;

/** Registered in Google Cloud → Authorized redirect URIs (D5). */
const GOOGLE_REDIRECT_PATH = '/api/v1/auth/google/redirect';

/** Where the browser lands after Google's redirect; the app reads `acceso`. */
const AFTER_LOGIN: Record<SignInOutcome, string> = {
  ok: '/',
  'no-autorizada': '/?acceso=no-autorizada',
  error: '/?acceso=error',
  cancelado: '/',
};

/** The installed iPhone app's sign-in window (D9) reports to the app and closes instead. */
function afterLogin(outcome: SignInOutcome, inWindow: boolean): string {
  return inWindow ? `${SIGN_IN_WINDOW_DONE_PATH}?resultado=${outcome}` : AFTER_LOGIN[outcome];
}

export interface V1Options extends AuthDeps {
  /** Our own addresses (CORS), to build Google's redirect URI. */
  appOrigins: string[];
  googleClientId: string;
  photos: PhotoStore;
  accessProofs: AccessProofStore;
  /**
   * Sign-in requests per minute per IP (CLAUDE.md §1.9). Generous on purpose:
   * a whole office signs in from ONE public IP (shared wifi), and there is no
   * password to guess (Google signs the token; nonces are single-use).
   */
  authRateLimitMax?: number;
}

export const v1Routes: FastifyPluginCallbackZod<V1Options> = (app, deps, done) => {
  const { db } = deps;
  const AUTH_RATE_LIMIT = {
    rateLimit: { max: deps.authRateLimitMax ?? 60, timeWindow: '1 minute' },
  };
  const meta = (request: { headers: Record<string, unknown>; ip: string; id: string }) => ({
    userAgent:
      typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
    ip: request.ip,
    requestId: request.id,
  });

  // ── Auth ────────────────────────────────────────────────────────────────
  // Google's redirect is a classic HTML form post (application/x-www-form-urlencoded).
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string', bodyLimit: 16_384 },
    (_request, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(String(body))));
    },
  );

  app.post(
    '/auth/nonce',
    { config: AUTH_RATE_LIMIT, schema: { tags: ['auth'], response: { 200: nonceResponseSchema } } },
    async (_request, reply) => {
      const nonce = await deps.nonces.issue();
      setNonceCookie(reply, nonce);
      return { nonce };
    },
  );

  /**
   * Starts Google's sign-in in the window opened by the app installed on an
   * iPhone home screen (D9). Binds a fresh nonce to that window's cookie jar,
   * which is the app's own, then goes to Google. A plain navigation: no data.
   */
  app.get(
    '/auth/google/start',
    { config: AUTH_RATE_LIMIT, schema: { tags: ['auth'], hide: true } },
    async (request, reply) => {
      const nonce = await deps.nonces.issue();
      setNonceCookie(reply, nonce);
      const origin = appOriginFor(request.host, request.protocol, deps.appOrigins);
      void reply.header('cache-control', 'no-store');
      return reply.redirect(
        googleAuthorizeUrl({
          clientId: deps.googleClientId,
          redirectUri: `${origin}${GOOGLE_REDIRECT_PATH}`,
          nonce,
        }),
        302,
      );
    },
  );

  /**
   * Sign-in in redirect mode (D5): works on iPhone, where Google's popup
   * cannot report back. Same verification as /auth/google, plus the nonce must
   * be the one bound to THIS browser by its cookie. Always answers with a
   * redirect, never JSON: this is a full-page navigation.
   */
  app.post(
    '/auth/google/redirect',
    {
      config: { ...AUTH_RATE_LIMIT, crossSiteOrigins: GOOGLE_ORIGINS },
      schema: {
        tags: ['auth'],
        hide: true,
        // `credential`: Google's button (D5). `id_token` + `state` (+ `error` if the
        // person cancels): the standard OpenID Connect form post of the window (D9).
        body: z.looseObject({
          credential: z.string().max(4096).optional(),
          id_token: z.string().max(4096).optional(),
          state: z.string().max(64).optional(),
          error: z.string().max(256).optional(),
        }),
      },
    },
    async (request, reply) => {
      const nonce = request.cookies[NONCE_COOKIE];
      clearNonceCookie(reply);
      const { state, error: googleError } = request.body;
      const credential = request.body.credential ?? request.body.id_token;
      const inWindow = state === SIGN_IN_WINDOW_STATE;
      const finish = (outcome: SignInOutcome) => reply.redirect(afterLogin(outcome, inWindow), 303);
      if (googleError === 'access_denied') return finish('cancelado');
      if (!nonce || !credential) return finish('error');
      try {
        const { token, expiresAt } = await signInWithGoogle(deps, credential, nonce, meta(request));
        setSessionCookie(reply, token, expiresAt);
        return await finish('ok');
      } catch (error) {
        // Not on the allowlist: let THIS browser request access (D6).
        if (error instanceof AccountNotAuthorizedError && error.identity) {
          const proof = await deps.accessProofs.issue(error.identity);
          setAccessProofCookie(reply, proof, ACCESS_PROOF_TTL_SECONDS);
        }
        if (error instanceof DomainError) {
          return finish(error.code === 'ACCOUNT_NOT_AUTHORIZED' ? 'no-autorizada' : 'error');
        }
        throw error;
      }
    },
  );

  // JSON sign-in with an ID token obtained by the client itself. The web app
  // uses the redirect route below (D5); this one is for the Android APK
  // (Fase 5, native Google sign-in) and the integration tests.
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

  // ── Access requests (D6) ────────────────────────────────────────────────
  /** The verified identity behind this browser's proof cookie, or 404. */
  const provenIdentity = async (request: FastifyRequest) => {
    const token = request.cookies[ACCESS_PROOF_COOKIE];
    const identity = token ? await deps.accessProofs.read(token) : null;
    if (!identity) throw errors.notFound('La solicitud');
    return identity;
  };

  app.get(
    '/access-requests/current',
    { schema: { tags: ['access'], response: { 200: accessRequestCurrentSchema } } },
    async (request) => currentRequest(db, await provenIdentity(request)),
  );

  app.post(
    '/access-requests',
    {
      config: AUTH_RATE_LIMIT,
      schema: { tags: ['access'], response: { 200: accessRequestCreatedSchema } },
    },
    async (request) => {
      const identity = await provenIdentity(request);
      const status = await createRequest(db, identity, {
        actor: { id: null, name: identity.email },
        requestId: request.id,
        ip: request.ip,
      });
      return { status };
    },
  );

  // ── Current user ────────────────────────────────────────────────────────
  app.get('/me', { schema: { tags: ['me'], response: { 200: meSchema } } }, async (request) =>
    currentUser(db, requireSession(request)),
  );

  app.post(
    '/me/consent',
    { schema: { tags: ['me'], body: consentRequestSchema } },
    async (request, reply) => {
      await acceptConsent(db, requireSession(request), request.body.selfie, meta(request));
      return reply.code(204).send();
    },
  );

  app.put(
    '/me/selfie-authorization',
    {
      schema: { tags: ['me'], body: selfieAuthorizationRequestSchema, response: { 200: meSchema } },
    },
    async (request) =>
      setSelfieAuthorization(db, requireSession(request), request.body.authorized, meta(request)),
  );

  // ── Attendance (Fase 3) ─────────────────────────────────────────────────
  app.get(
    '/attendance/status',
    { schema: { tags: ['attendance'], response: { 200: attendanceStatusSchema } } },
    async (request) => attendanceStatus(db, requireSession(request).employee.id),
  );

  app.post(
    '/attendance',
    {
      // The selfie travels as base64 in the JSON body (~1.4× the JPEG size).
      bodyLimit: 3_500_000,
      config: {
        // Per person, not per IP: 30 employees marking at 7:58 share the office IP.
        // The key is the token hash, never the token itself.
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          keyGenerator: (request: FastifyRequest) => {
            const token = request.cookies[SESSION_COOKIE];
            return token ? `mark:${hashToken(token)}` : `mark-ip:${request.ip}`;
          },
        },
      },
      schema: {
        tags: ['attendance'],
        body: markRequestSchema,
        response: { 201: markResponseSchema },
      },
    },
    async (request, reply) => {
      const session = requireSession(request);
      const { ip, userAgent } = meta(request);
      const record = await markAttendance(db, deps.photos, session.employee.id, request.body, {
        ip,
        userAgent,
      });
      return reply.code(201).send(record);
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
    '/admin/access-requests',
    { schema: { tags: ['admin'], response: { 200: z.array(accessRequestSchema) } } },
    async (request) => {
      requireAdmin(request);
      return listPending(db);
    },
  );

  app.post(
    '/admin/access-requests/:id/approve',
    { schema: { tags: ['admin'], params: idParams } },
    async (request, reply) => {
      const { audit } = adminContext(request);
      await approveRequest(db, request.params.id, audit);
      return reply.code(204).send();
    },
  );

  app.post(
    '/admin/access-requests/:id/reject',
    { schema: { tags: ['admin'], params: idParams } },
    async (request, reply) => {
      const { audit } = adminContext(request);
      await rejectRequest(db, request.params.id, audit);
      return reply.code(204).send();
    },
  );

  app.get(
    '/admin/backups',
    { schema: { tags: ['admin'], response: { 200: backupStatusSchema } } },
    async (request) => {
      requireAdmin(request);
      return backupStatus(db, new Date());
    },
  );

  app.get(
    '/admin/attendance',
    {
      schema: {
        tags: ['admin'],
        querystring: z.object({ date: businessDateSchema.optional() }),
        response: { 200: z.array(adminTimelineEntrySchema) },
      },
    },
    async (request) => {
      requireAdmin(request);
      return listDay(db, request.query.date ?? businessToday(new Date()));
    },
  );

  // ── Review and corrections (Fase 6) ─────────────────────────────────────
  app.get(
    '/admin/review',
    { schema: { tags: ['admin'], response: { 200: z.array(adminAttendanceEntrySchema) } } },
    async (request) => {
      requireAdmin(request);
      return reviewQueue(db);
    },
  );

  app.post(
    '/admin/attendance/:id/review',
    { schema: { tags: ['admin'], params: idParams, body: reviewRequestSchema } },
    async (request, reply) => {
      const { audit } = adminContext(request);
      await reviewRecord(db, request.params.id, request.body, audit);
      return reply.code(204).send();
    },
  );

  app.post(
    '/admin/corrections',
    { schema: { tags: ['admin'], body: correctionRequestSchema } },
    async (request, reply) => {
      const { audit } = adminContext(request);
      await applyCorrection(db, request.body, audit);
      return reply.code(204).send();
    },
  );

  app.get(
    '/admin/attendance/:id/selfie',
    { schema: { tags: ['admin'], params: idParams } },
    async (request, reply) => {
      requireAdmin(request);
      const jpeg = await readSelfie(db, deps.photos, request.params.id);
      // Sensitive personal data (Ley 1581): never cached by browsers or proxies.
      return reply
        .type('image/jpeg')
        .header('cache-control', 'private, no-store')
        .send(Buffer.from(jpeg));
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
