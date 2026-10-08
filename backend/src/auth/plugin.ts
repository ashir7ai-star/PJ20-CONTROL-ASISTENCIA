/**
 * Resolves the session cookie on every /api/v1 request and exposes guards.
 * Also enforces the CSRF Origin check for state-changing requests.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import type { Database } from '../db/client.js';
import { errors } from '../errors.js';
import { resolveSession, type SessionContext } from './sessions.js';

/** `__Host-` prefix: Secure, Path=/, no Domain — cannot be set by subdomains. */
export const SESSION_COOKIE = '__Host-pj20_sesion';

declare module 'fastify' {
  interface FastifyRequest {
    session: SessionContext | null;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  void reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  void reply.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
}

export function requireSession(request: FastifyRequest): SessionContext {
  if (!request.session) throw errors.sessionRequired();
  return request.session;
}

export function requireAdmin(request: FastifyRequest): SessionContext {
  const session = requireSession(request);
  if (session.employee.role !== 'admin') throw errors.forbidden();
  return session;
}

interface AuthPluginOptions {
  db: Database;
  allowedOrigins: string[];
}

export const authPlugin = fp<AuthPluginOptions>(
  (app: FastifyInstance, { db, allowedOrigins }, done) => {
    app.decorateRequest('session', null);

    app.addHook('onRequest', async (request, reply) => {
      // CSRF: state-changing requests must come from our own app.
      if (!SAFE_METHODS.has(request.method)) {
        const origin = request.headers.origin;
        if (!origin || !allowedOrigins.includes(origin)) throw errors.originNotAllowed();
      }

      const token = request.cookies[SESSION_COOKIE];
      if (!token) return;
      const session = await resolveSession(db, token);
      if (!session) {
        clearSessionCookie(reply); // Expired or revoked: tidy up the browser.
        return;
      }
      request.session = { sessionId: session.sessionId, employee: session.employee };
      if (session.renewedUntil) setSessionCookie(reply, token, session.renewedUntil);
    });
    done();
  },
  { name: 'pj20-auth' },
);
