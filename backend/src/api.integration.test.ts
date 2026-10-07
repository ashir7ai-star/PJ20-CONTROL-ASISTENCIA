/**
 * End-to-end API tests against REAL Postgres (throw-away `pj20_test`) and
 * Redis. Google is simulated with our own signing key: everything else —
 * nonces, sessions, cookies, roles, rules, audit — is the production code.
 */
import { randomUUID } from 'node:crypto';

import { CONSENT_VERSION } from '@pj20/shared';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { Redis } from 'ioredis';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { SESSION_COOKIE } from './auth/plugin.js';
import { createGoogleVerifier } from './auth/google.js';
import { createNonceStore } from './auth/nonce.js';
import { createDatabase } from './db/client.js';
import { employees } from './db/schema.js';
import { loadLocalEnv, TEST_DB, withDatabase } from './test/integration-setup.js';

loadLocalEnv();

const CLIENT_ID = 'pruebas.apps.googleusercontent.com';
const ORIGIN = 'http://localhost:5173';
const up = () => Promise.resolve();

let pool: pg.Pool;
let redis: Redis;
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let app: FastifyInstance;
let db: ReturnType<typeof createDatabase>;

async function makeApp(authRateLimitMax = 1000) {
  const instance = await buildApp({
    appOrigins: [ORIGIN],
    logger: false,
    checks: { database: up, cache: up, storage: up },
    api: {
      db,
      redis,
      verifier: createGoogleVerifier(
        CLIENT_ID,
        createLocalJWKSet({
          keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'RS256' }],
        }),
      ),
      nonces: createNonceStore(redis),
      authRateLimitMax,
    },
  });
  return instance;
}

beforeAll(async () => {
  const apiUrl = process.env.DATABASE_URL ?? '';
  // Same restricted API user as production, pointed at the test database.
  pool = new pg.Pool({ connectionString: withDatabase(apiUrl, TEST_DB) });
  db = createDatabase(pool);
  redis = new Redis(process.env.REDIS_URL ?? '', { db: 15 });
  await redis.flushdb();
  keys = await generateKeyPair('RS256');
  app = await makeApp();
});

afterAll(async () => {
  await app.close();
  await redis.flushdb();
  redis.disconnect();
  await pool.end();
});

// ── helpers ──────────────────────────────────────────────────────────────

const unique = (name: string) => `${name}.${randomUUID().slice(0, 8)}@gmail.com`;

async function addUser(role: 'employee' | 'admin', name = 'Usuario de prueba') {
  const [row] = await db
    .insert(employees)
    .values({ name, email: unique(role), role })
    .returning();
  if (!row) throw new Error('seed failed');
  return row;
}

async function googleToken(email: string, nonce: string, extra: Record<string, unknown> = {}) {
  return new SignJWT({ email, email_verified: true, name: 'Nombre en Google', nonce, ...extra })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject(`sub-${email}`)
    .setIssuer('https://accounts.google.com')
    .setAudience(CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(keys.privateKey);
}

async function newNonce(instance = app) {
  const res = await instance.inject({
    method: 'POST',
    url: '/api/v1/auth/nonce',
    headers: { origin: ORIGIN },
  });
  return res.json<{ nonce: string }>().nonce;
}

function sessionCookie(res: LightMyRequestResponse): string {
  const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE);
  if (!cookie) throw new Error('no session cookie');
  return `${SESSION_COOKIE}=${cookie.value}`;
}

async function login(email: string) {
  const nonce = await newNonce();
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/google',
    headers: { origin: ORIGIN },
    payload: { credential: await googleToken(email, nonce), nonce },
  });
  return res;
}

async function loggedIn(role: 'employee' | 'admin') {
  const user = await addUser(role);
  const res = await login(user.email);
  expect(res.statusCode).toBe(200);
  return { user, cookie: sessionCookie(res) };
}

function call(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  cookie?: string,
  payload?: object,
) {
  return app.inject({
    method,
    url: `/api/v1${url}`,
    headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) },
    ...(payload ? { payload } : {}),
  });
}

const errorCode = (res: LightMyRequestResponse) =>
  res.json<{ error: { code: string } }>().error.code;

// ── tests ────────────────────────────────────────────────────────────────

describe('inicio de sesión con Google', () => {
  it('un usuario autorizado obtiene sesión con una cookie segura', async () => {
    const user = await addUser('admin', 'Andrés Admin');
    const res = await login(user.email.toUpperCase()); // Google may return any casing

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ email: user.email, role: 'admin', consentRequired: true });
    const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE);
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: '/' });
    expect(cookie?.value.length).toBeGreaterThanOrEqual(43); // 256 bits base64url
  });

  it('un correo no autorizado es rechazado sin sesión y queda en la auditoría', async () => {
    const res = await login(unique('intruso'));
    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('ACCOUNT_NOT_AUTHORIZED');
    expect(res.cookies.find((c) => c.name === SESSION_COOKIE)).toBeUndefined();

    const { cookie } = await loggedIn('admin');
    const audit = (await call('GET', '/admin/audit', cookie)).json<{ action: string }[]>();
    expect(audit.some((e) => e.action === 'auth.rejected_unknown')).toBe(true);
  });

  it('un usuario desactivado recibe la misma respuesta que uno desconocido', async () => {
    const user = await addUser('employee');
    await pool.query('UPDATE employees SET active = false WHERE id = $1', [user.id]);
    const res = await login(user.email);
    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('ACCOUNT_NOT_AUTHORIZED');
  });

  it('un nonce solo sirve una vez (no se puede repetir una credencial)', async () => {
    const user = await addUser('employee');
    const nonce = await newNonce();
    const credential = await googleToken(user.email, nonce);
    const body = { credential, nonce };
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google',
      headers: { origin: ORIGIN },
      payload: body,
    });
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google',
      headers: { origin: ORIGIN },
      payload: body,
    });
    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(401);
    expect(errorCode(replay)).toBe('INVALID_CREDENTIAL');
  });

  it('una credencial firmada por otra llave es rechazada', async () => {
    const user = await addUser('employee');
    const nonce = await newNonce();
    const attacker = await generateKeyPair('RS256');
    const forged = await new SignJWT({ email: user.email, email_verified: true, nonce })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer('https://accounts.google.com')
      .setAudience(CLIENT_ID)
      .setSubject('x')
      .setExpirationTime('10m')
      .sign(attacker.privateKey);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google',
      headers: { origin: ORIGIN },
      payload: { credential: forged, nonce },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('sesiones (D2)', () => {
  it('administrador: 12 horas · empleado: 30 días', async () => {
    const admin = await addUser('admin');
    const employee = await addUser('employee');
    const hours = (res: LightMyRequestResponse) => {
      const expires = res.cookies.find((c) => c.name === SESSION_COOKIE)?.expires;
      return expires ? (expires.getTime() - Date.now()) / 3_600_000 : 0;
    };
    expect(hours(await login(admin.email))).toBeCloseTo(12, 0);
    expect(hours(await login(employee.email))).toBeCloseTo(720, 0);
  });

  it('sin sesión, /me responde 401', async () => {
    const res = await call('GET', '/me');
    expect(res.statusCode).toBe(401);
    expect(errorCode(res)).toBe('SESSION_REQUIRED');
  });

  it('una cookie inventada no da acceso', async () => {
    const res = await call('GET', '/me', `${SESSION_COOKIE}=${'a'.repeat(43)}`);
    expect(res.statusCode).toBe(401);
  });

  it('cerrar sesión invalida la cookie en el servidor', async () => {
    const { cookie } = await loggedIn('employee');
    expect((await call('GET', '/me', cookie)).statusCode).toBe(200);
    expect((await call('POST', '/auth/logout', cookie)).statusCode).toBe(204);
    expect((await call('GET', '/me', cookie)).statusCode).toBe(401);
  });

  it('desactivar a un empleado corta su sesión AL INSTANTE', async () => {
    const admin = await loggedIn('admin');
    const employee = await loggedIn('employee');
    expect((await call('GET', '/me', employee.cookie)).statusCode).toBe(200);

    const res = await call('PATCH', `/admin/employees/${employee.user.id}`, admin.cookie, {
      active: false,
    });
    expect(res.statusCode).toBe(200);
    expect((await call('GET', '/me', employee.cookie)).statusCode).toBe(401);
  });
});

describe('protección CSRF', () => {
  it('rechaza peticiones que modifican datos sin Origin o desde otro sitio', async () => {
    const { cookie } = await loggedIn('employee');
    const none = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie },
    });
    const evil = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie, origin: 'https://evil.example' },
    });
    expect(none.statusCode).toBe(403);
    expect(errorCode(evil)).toBe('ORIGIN_NOT_ALLOWED');
    expect((await call('GET', '/me', cookie)).statusCode).toBe(200); // still logged in
  });
});

describe('consentimiento (Ley 1581)', () => {
  it('se registra una vez, es idempotente y es inmutable', async () => {
    const { user, cookie } = await loggedIn('employee');
    expect((await call('GET', '/me', cookie)).json()).toMatchObject({ consentRequired: true });
    expect(
      (await call('POST', '/me/consent', cookie, { version: CONSENT_VERSION })).statusCode,
    ).toBe(204);
    expect(
      (await call('POST', '/me/consent', cookie, { version: CONSENT_VERSION })).statusCode,
    ).toBe(204);
    expect((await call('GET', '/me', cookie)).json()).toMatchObject({ consentRequired: false });

    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM consents WHERE employee_id = $1',
      [user.id],
    );
    expect(rows[0]).toEqual({ n: 1 });
    await expect(
      pool.query('DELETE FROM consents WHERE employee_id = $1', [user.id]),
    ).rejects.toThrow(/permission denied/);
  });

  it('rechaza una versión distinta a la vigente', async () => {
    const { cookie } = await loggedIn('employee');
    const res = await call('POST', '/me/consent', cookie, { version: '1999-01' });
    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('VALIDATION_ERROR');
  });
});

describe('administración de usuarios', () => {
  it('un empleado nunca accede a /admin', async () => {
    const { user, cookie } = await loggedIn('employee');
    for (const [method, url] of [
      ['GET', '/admin/employees'],
      ['GET', '/admin/audit'],
      ['POST', '/admin/employees'],
      ['PATCH', `/admin/employees/${user.id}`],
      ['DELETE', `/admin/employees/${user.id}`],
    ] as const) {
      const res = await call(
        method,
        url,
        cookie,
        method === 'GET' || method === 'DELETE'
          ? undefined
          : { name: 'Hack', email: 'h@h.co', role: 'admin', active: true },
      );
      expect(res.statusCode, `${method} ${url}`).toBe(403);
    }
  });

  it('crea usuarios con correo normalizado y rechaza duplicados o datos inválidos', async () => {
    const { cookie } = await loggedIn('admin');
    const email = unique('nuevo');
    const created = await call('POST', '/admin/employees', cookie, {
      name: 'Pedro Sánchez',
      email: `  ${email.toUpperCase()} `,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ email, role: 'employee', active: true });

    const duplicate = await call('POST', '/admin/employees', cookie, {
      name: 'Pedro Sánchez',
      email,
    });
    expect(duplicate.statusCode).toBe(409);
    const invalid = await call('POST', '/admin/employees', cookie, {
      name: 'X',
      email: 'no-es-correo',
    });
    expect(errorCode(invalid)).toBe('VALIDATION_ERROR');
  });

  it('aplica en el servidor la regla "nadie se quita su propio rol"', async () => {
    const { user, cookie } = await loggedIn('admin');
    const res = await call('PATCH', `/admin/employees/${user.id}`, cookie, { role: 'employee' });
    expect(res.statusCode).toBe(422);
    expect(errorCode(res)).toBe('RULE_VIOLATION');
  });

  it('cambiar el rol de alguien cierra sus sesiones (sus permisos cambiaron)', async () => {
    const admin = await loggedIn('admin');
    const employee = await loggedIn('employee');
    await call('PATCH', `/admin/employees/${employee.user.id}`, admin.cookie, { role: 'admin' });
    expect((await call('GET', '/me', employee.cookie)).statusCode).toBe(401);
  });

  it('no elimina a quien ya aceptó el consentimiento; sí a quien nunca usó la app', async () => {
    const admin = await loggedIn('admin');
    const used = await loggedIn('employee');
    await call('POST', '/me/consent', used.cookie, { version: CONSENT_VERSION });
    const blocked = await call('DELETE', `/admin/employees/${used.user.id}`, admin.cookie);
    expect(blocked.statusCode).toBe(422);

    const never = await addUser('employee');
    expect((await call('DELETE', `/admin/employees/${never.id}`, admin.cookie)).statusCode).toBe(
      204,
    );
  });

  it('cada cambio queda en la auditoría con el antes y el después', async () => {
    const admin = await loggedIn('admin');
    const target = await addUser('employee', 'Para Auditar');
    await call('PATCH', `/admin/employees/${target.id}`, admin.cookie, { active: false });
    const entries = (await call('GET', '/admin/audit?limit=20', admin.cookie)).json<
      {
        action: string;
        targetId: string;
        actorId: string;
        before: { active: boolean };
        after: { active: boolean };
      }[]
    >();
    const entry = entries.find(
      (e) => e.targetId === target.id && e.action === 'employee.deactivate',
    );
    expect(entry).toMatchObject({
      actorId: admin.user.id,
      before: { active: true },
      after: { active: false },
    });
  });

  it('la API no puede alterar ni borrar la auditoría', async () => {
    await expect(pool.query("UPDATE audit_log SET action = 'borrado'")).rejects.toThrow(
      /permission denied/,
    );
    await expect(pool.query('DELETE FROM audit_log')).rejects.toThrow(/permission denied/);
  });
});

describe('límite de intentos', () => {
  it('bloquea con 429 tras demasiados intentos de inicio de sesión', async () => {
    // Counters are per IP and shared in Redis: start from zero for this test.
    await redis.flushdb();
    const limited = await makeApp(2);
    try {
      const codes = [];
      for (let i = 0; i < 3; i++)
        codes.push(
          (
            await limited.inject({
              method: 'POST',
              url: '/api/v1/auth/nonce',
              headers: { origin: ORIGIN },
            })
          ).statusCode,
        );
      expect(codes).toEqual([200, 200, 429]);
    } finally {
      await limited.close();
    }
  });
});
