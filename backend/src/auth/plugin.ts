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

/**
 * Binds the sign-in nonce to THIS browser (decision D5). Google's redirect is a
 * cross-site form POST, which only carries SameSite=None cookies; HttpOnly and
 * 5 minutes like the nonce itself. Without it, an attacker could make a victim
 * sign in with the attacker's account (login CSRF).
 */
export const NONCE_COOKIE = '__Host-pj20_nonce';
const NONCE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/',
} as const;

export function setNonceCookie(reply: FastifyReply, nonce: string): void {
  void reply.setCookie(NONCE_COOKIE, nonce, { ...NONCE_COOKIE_OPTIONS, maxAge: 300 });
}

export function clearNonceCookie(reply: FastifyReply): void {
  void reply.clearCookie(NONCE_COOKIE, NONCE_COOKIE_OPTIONS);
}

/**
 * Proof that this browser just failed the allowlist with a verified Google
 * account (D6): lets that person request access for 15 minutes. Strict: it is
 * only ever sent by the app itself.
 */
export const ACCESS_PROOF_COOKIE = '__Host-pj20_solicitud';
const ACCESS_PROOF_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
} as const;

export function setAccessProofCookie(reply: FastifyReply, token: string, maxAge: number): void {
  void reply.setCookie(ACCESS_PROOF_COOKIE, token, { ...ACCESS_PROOF_COOKIE_OPTIONS, maxAge });
}

/**
 * Per-route exception to the Origin check: only Google's sign-in redirect uses
 * it. Safari may send "null" for that cross-site POST; the nonce cookie above
 * is what actually ties the request to this browser.
 */
export interface CrossSiteConfig {
  crossSiteOrigins?: readonly string[];
}

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
        const extra = (request.routeOptions.config as CrossSiteConfig).crossSiteOrigins ?? [];
        if (!origin || !(allowedOrigins.includes(origin) || extra.includes(origin))) {
          throw errors.originNotAllowed();
        }
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
