/**
 * End-to-end API tests against REAL Postgres (throw-away `pj20_test`) and
 * Redis. Google is simulated with our own signing key: everything else —
 * nonces, sessions, cookies, roles, rules, audit — is the production code.
 */
import { randomUUID } from 'node:crypto';

import { CONSENT_VERSION } from '@pj20/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { Redis } from 'ioredis';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { ACCESS_PROOF_COOKIE, NONCE_COOKIE, SESSION_COOKIE } from './auth/plugin.js';
import { createGoogleVerifier } from './auth/google.js';
import { createNonceStore } from './auth/nonce.js';
import { createAccessProofStore } from './access/proof.js';
import { purgeExpiredSelfies } from './attendance/retention.js';
import { selfieKey } from './attendance/rules.js';
import { createDatabase } from './db/client.js';
import { ensureLoginRole } from './db/login-role.js';
import { createPhotoStore, type PhotoStore } from './infra/photo-store.js';
import { createStorageClient, ensureBucket } from './infra/storage.js';
import { attendanceRecords, employees } from './db/schema.js';
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
let photos: PhotoStore;
/** Separate bucket so tests never touch development selfies. */
const TEST_BUCKET = 'pj20-test';

async function makeApp(authRateLimitMax = 1000) {
  const instance = await buildApp({
    appOrigins: [ORIGIN],
    logger: false,
    checks: { database: up, cache: up, storage: up },
    api: {
      db,
      redis,
      googleClientId: CLIENT_ID,
      verifier: createGoogleVerifier(
        CLIENT_ID,
        createLocalJWKSet({
          keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'RS256' }],
        }),
      ),
      nonces: createNonceStore(redis),
      photos,
      accessProofs: createAccessProofStore(redis),
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
  const storage = createStorageClient({
    endpoint: process.env.S3_ENDPOINT ?? '',
    region: process.env.S3_REGION ?? 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY ?? '',
    secretKey: process.env.S3_SECRET_KEY ?? '',
  });
  await ensureBucket(storage, TEST_BUCKET);
  photos = createPhotoStore(storage, TEST_BUCKET);
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
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
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

describe('inicio de sesión por redirección (D5, iPhone)', () => {
  const GOOGLE = 'https://accounts.google.com';

  /** The browser gets a nonce (and its binding cookie) before going to Google. */
  async function nonceWithCookie() {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/nonce',
      headers: { origin: ORIGIN },
    });
    const cookie = res.cookies.find((c) => c.name === NONCE_COOKIE);
    if (!cookie) throw new Error('sin cookie de nonce');
    return { nonce: res.json<{ nonce: string }>().nonce, cookie };
  }

  function googlePost(credential: string, cookie?: string, origin = GOOGLE) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/redirect',
      headers: {
        origin,
        'content-type': 'application/x-www-form-urlencoded',
        ...(cookie ? { cookie } : {}),
      },
      payload: new URLSearchParams({ credential, g_csrf_token: 'x' }).toString(),
    });
  }

  it('la cookie del nonce es HttpOnly, Secure, SameSite=None y vence en 5 minutos', async () => {
    const { cookie } = await nonceWithCookie();
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'None', path: '/' });
    expect(cookie.maxAge).toBe(300);
  });

  it('Google redirige con la credencial: abre sesión y vuelve a la app', async () => {
    const user = await addUser('employee');
    const { nonce, cookie } = await nonceWithCookie();
    const res = await googlePost(
      await googleToken(user.email, nonce),
      `${NONCE_COOKIE}=${cookie.value}`,
    );
    expect(res.statusCode).toBe(303);
    expect(res.headers.location).toBe('/');
    const me = await call('GET', '/me', sessionCookie(res));
    expect(me.json()).toMatchObject({ id: user.id });
    // The nonce cookie is cleared and the nonce cannot be reused.
    expect(res.cookies.find((c) => c.name === NONCE_COOKIE)?.value).toBe('');
    const replay = await googlePost(
      await googleToken(user.email, nonce),
      `${NONCE_COOKIE}=${cookie.value}`,
    );
    expect(replay.headers.location).toBe('/?acceso=error');
  });

  it('login CSRF: una credencial con el nonce de OTRO navegador se rechaza', async () => {
    const attacker = await addUser('employee');
    const attackerNonce = (await nonceWithCookie()).nonce;
    const victim = await nonceWithCookie();
    const res = await googlePost(
      await googleToken(attacker.email, attackerNonce),
      `${NONCE_COOKIE}=${victim.cookie.value}`,
    );
    expect(res.headers.location).toBe('/?acceso=error');
    expect(res.cookies.find((c) => c.name === SESSION_COOKIE)).toBeUndefined();
  });

  it('sin la cookie del nonce no hay sesión', async () => {
    const user = await addUser('employee');
    const { nonce } = await nonceWithCookie();
    const res = await googlePost(await googleToken(user.email, nonce));
    expect(res.headers.location).toBe('/?acceso=error');
  });

  it('una cuenta no autorizada vuelve a la app con el aviso, sin sesión', async () => {
    const { nonce, cookie } = await nonceWithCookie();
    const res = await googlePost(
      await googleToken(unique('extrano'), nonce),
      `${NONCE_COOKIE}=${cookie.value}`,
    );
    expect(res.headers.location).toBe('/?acceso=no-autorizada');
    expect(res.cookies.find((c) => c.name === SESSION_COOKIE)).toBeUndefined();
  });

  it('solo Google puede enviar a esta dirección: otro sitio recibe 403', async () => {
    const user = await addUser('employee');
    const { nonce, cookie } = await nonceWithCookie();
    const res = await googlePost(
      await googleToken(user.email, nonce),
      `${NONCE_COOKIE}=${cookie.value}`,
      'https://sitio-malicioso.com',
    );
    expect(res.statusCode).toBe(403);
  });
});

describe('inicio de sesión en la app instalada en iPhone (D9)', () => {
  const GOOGLE = 'https://accounts.google.com';

  /** The app's window starts here: nonce cookie + redirect to Google. */
  async function start(host = 'localhost:5173') {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/google/start',
      headers: { host },
    });
    const cookie = res.cookies.find((c) => c.name === NONCE_COOKIE);
    if (!cookie) throw new Error('sin cookie de nonce');
    return { res, cookie, google: new URL(res.headers.location ?? '') };
  }

  function windowPost(fields: Record<string, string>, cookie?: string) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/redirect',
      headers: {
        origin: GOOGLE,
        'content-type': 'application/x-www-form-urlencoded',
        ...(cookie ? { cookie } : {}),
      },
      payload: new URLSearchParams(fields).toString(),
    });
  }

  it('va a Google con el nonce atado a la cookie de la ventana y nuestra dirección registrada', async () => {
    const { res, cookie, google } = await start();
    expect(res.statusCode).toBe(302);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(google.origin).toBe(GOOGLE);
    expect(google.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(google.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/v1/auth/google/redirect`);
    expect(google.searchParams.get('nonce')).toBe(cookie.value);
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'None', maxAge: 300 });
  });

  it('un Host ajeno nunca cambia la dirección de regreso', async () => {
    const { google } = await start('malicioso.com');
    expect(google.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/v1/auth/google/redirect`);
  });

  it('Google devuelve el id_token: abre sesión y la ventana avisa a la app', async () => {
    const user = await addUser('employee');
    const { cookie } = await start();
    const res = await windowPost(
      { id_token: await googleToken(user.email, cookie.value), state: 'ventana' },
      `${NONCE_COOKIE}=${cookie.value}`,
    );
    expect(res.statusCode).toBe(303);
    expect(res.headers.location).toBe('/acceso-listo.html?resultado=ok');
    const me = await call('GET', '/me', sessionCookie(res));
    expect(me.json()).toMatchObject({ id: user.id });
  });

  it('nonce reutilizado o de otro navegador: error, sin sesión', async () => {
    const user = await addUser('employee');
    const { cookie } = await start();
    const fields = { id_token: await googleToken(user.email, cookie.value), state: 'ventana' };
    await windowPost(fields, `${NONCE_COOKIE}=${cookie.value}`);
    const replay = await windowPost(fields, `${NONCE_COOKIE}=${cookie.value}`);
    expect(replay.headers.location).toBe('/acceso-listo.html?resultado=error');
    const other = await start();
    const csrf = await windowPost(fields, `${NONCE_COOKIE}=${other.cookie.value}`);
    expect(csrf.headers.location).toBe('/acceso-listo.html?resultado=error');
    expect(csrf.cookies.find((c) => c.name === SESSION_COOKIE)).toBeUndefined();
  });

  it('cuenta no autorizada: la ventana lo informa y deja el comprobante para pedir acceso', async () => {
    const { cookie } = await start();
    const res = await windowPost(
      { id_token: await googleToken(unique('extrano'), cookie.value), state: 'ventana' },
      `${NONCE_COOKIE}=${cookie.value}`,
    );
    expect(res.headers.location).toBe('/acceso-listo.html?resultado=no-autorizada');
    expect(res.cookies.find((c) => c.name === ACCESS_PROOF_COOKIE)).toBeDefined();
    expect(res.cookies.find((c) => c.name === SESSION_COOKIE)).toBeUndefined();
  });

  it('si la persona cancela en Google, la ventana se cierra sin error', async () => {
    const { cookie } = await start();
    const res = await windowPost(
      { error: 'access_denied', state: 'ventana' },
      `${NONCE_COOKIE}=${cookie.value}`,
    );
    expect(res.headers.location).toBe('/acceso-listo.html?resultado=cancelado');
  });
});

describe('solicitudes de acceso (D6)', () => {
  /** Unknown account goes through Google's redirect: returns the proof cookie. */
  async function failedSignIn(email: string) {
    const nonceRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/nonce',
      headers: { origin: ORIGIN },
    });
    const nonceCookie = nonceRes.cookies.find((c) => c.name === NONCE_COOKIE);
    const { nonce } = nonceRes.json<{ nonce: string }>();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google/redirect',
      headers: {
        origin: 'https://accounts.google.com',
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `${NONCE_COOKIE}=${nonceCookie?.value ?? ''}`,
      },
      payload: new URLSearchParams({ credential: await googleToken(email, nonce) }).toString(),
    });
    expect(res.headers.location).toBe('/?acceso=no-autorizada');
    const proof = res.cookies.find((c) => c.name === ACCESS_PROOF_COOKIE);
    if (!proof) throw new Error('sin comprobante');
    expect(proof).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict' });
    return `${ACCESS_PROOF_COOKIE}=${proof.value}`;
  }

  it('sin comprobante nadie puede pedir acceso (ni consultar)', async () => {
    expect((await call('POST', '/access-requests')).statusCode).toBe(404);
    expect((await call('GET', '/access-requests/current')).statusCode).toBe(404);
    const forged = `${ACCESS_PROOF_COOKIE}=${'a'.repeat(43)}`;
    expect((await call('POST', '/access-requests', forged)).statusCode).toBe(404);
  });

  it('con el comprobante pide acceso con el nombre y correo verificados por Google; no se duplica', async () => {
    const email = unique('aspirante');
    const proof = await failedSignIn(email);
    expect((await call('GET', '/access-requests/current', proof)).json()).toEqual({
      name: 'Nombre en Google',
      email,
      pending: false,
    });
    expect((await call('POST', '/access-requests', proof)).json()).toEqual({ status: 'created' });
    expect((await call('POST', '/access-requests', proof)).json()).toEqual({ status: 'pending' });
    expect(
      (await call('GET', '/access-requests/current', proof)).json<{ pending: boolean }>().pending,
    ).toBe(true);
  });

  it('aprobar crea al empleado y ya puede iniciar sesión; queda en la auditoría', async () => {
    const email = unique('aprobado');
    await call('POST', '/access-requests', await failedSignIn(email));
    const admin = await loggedIn('admin');
    const pending = await call('GET', '/admin/access-requests', admin.cookie);
    const request = pending.json<{ id: string; email: string }[]>().find((r) => r.email === email);
    if (!request) throw new Error('no aparece la solicitud');

    const approved = await call(
      'POST',
      `/admin/access-requests/${request.id}/approve`,
      admin.cookie,
    );
    expect(approved.statusCode).toBe(204);
    expect((await login(email)).statusCode).toBe(200);

    const again = await call('POST', `/admin/access-requests/${request.id}/approve`, admin.cookie);
    expect(again.statusCode).toBe(409);
    const audit = await call('GET', '/admin/audit?limit=20', admin.cookie);
    expect(audit.json<{ action: string }[]>().map((a) => a.action)).toContain(
      'access_request.approved',
    );
  });

  it('aprobar a un empleado desactivado lo reactiva', async () => {
    const admin = await loggedIn('admin');
    const former = await addUser('employee');
    await call('PATCH', `/admin/employees/${former.id}`, admin.cookie, { active: false });
    await call('POST', '/access-requests', await failedSignIn(former.email));
    const list = await call('GET', '/admin/access-requests', admin.cookie);
    const request = list
      .json<{ id: string; email: string; deactivatedEmployee: boolean }[]>()
      .find((r) => r.email === former.email);
    expect(request?.deactivatedEmployee).toBe(true);
    await call('POST', `/admin/access-requests/${request?.id ?? ''}/approve`, admin.cookie);
    expect((await login(former.email)).statusCode).toBe(200);
  });

  it('rechazar deja a la persona sin acceso', async () => {
    const email = unique('rechazado');
    await call('POST', '/access-requests', await failedSignIn(email));
    const admin = await loggedIn('admin');
    const list = await call('GET', '/admin/access-requests', admin.cookie);
    const request = list.json<{ id: string; email: string }[]>().find((r) => r.email === email);
    const res = await call(
      'POST',
      `/admin/access-requests/${request?.id ?? ''}/reject`,
      admin.cookie,
    );
    expect(res.statusCode).toBe(204);
    expect((await login(email)).statusCode).toBe(403);
  });

  it('un empleado no ve ni resuelve solicitudes', async () => {
    const { cookie } = await loggedIn('employee');
    expect((await call('GET', '/admin/access-requests', cookie)).statusCode).toBe(403);
    expect(
      (await call('POST', `/admin/access-requests/${randomUUID()}/approve`, cookie)).statusCode,
    ).toBe(403);
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
      (await call('POST', '/me/consent', cookie, { version: CONSENT_VERSION, selfie: true }))
        .statusCode,
    ).toBe(204);
    expect(
      (await call('POST', '/me/consent', cookie, { version: CONSENT_VERSION, selfie: true }))
        .statusCode,
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
    await call('POST', '/me/consent', used.cookie, { version: CONSENT_VERSION, selfie: true });
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

describe('marcaciones (Fase 3)', () => {
  /** Smallest structurally valid JPEG for the server checks (SOI … EOI). */
  const selfie = (() => {
    const bytes = new Uint8Array(4096);
    bytes.set([0xff, 0xd8, 0xff, 0xe0]);
    bytes.set([0xff, 0xd9], bytes.length - 2);
    return Buffer.from(bytes).toString('base64');
  })();

  const markBody = (
    kind: 'check_in' | 'check_out',
    /** photo: null = marking without selfie (D7). */
    over: { accuracyM?: number; fixAgeS?: number; photo?: string | null } = {},
  ) => {
    const now = Date.now();
    return {
      kind,
      location: {
        latitude: 3.4516,
        longitude: -76.532,
        accuracyM: over.accuracyM ?? 8,
        capturedAt: new Date(now - (over.fixAgeS ?? 2) * 1000).toISOString(),
      },
      deviceTime: new Date(now).toISOString(),
      ...(over.photo === null ? {} : { photo: over.photo ?? selfie }),
    };
  };

  async function readyEmployee(selfie = true) {
    const session = await loggedIn('employee');
    const consent = await call('POST', '/me/consent', session.cookie, {
      version: CONSENT_VERSION,
      selfie,
    });
    expect(consent.statusCode).toBe(204);
    return session;
  }

  it('marca entrada y salida con hora del servidor; el estado refleja el turno', async () => {
    const { cookie } = await readyEmployee();
    expect((await call('GET', '/attendance/status', cookie)).json()).toEqual({
      onDutySince: null,
      lastRecord: null,
    });

    const before = Date.now();
    const checkIn = await call('POST', '/attendance', cookie, markBody('check_in'));
    expect(checkIn.statusCode).toBe(201);
    const record = checkIn.json<{ serverTime: string; reviewStatus: string }>();
    expect(Date.parse(record.serverTime)).toBeGreaterThanOrEqual(before - 1000);
    expect(record.reviewStatus).toBe('ok');

    const onDuty: unknown = (await call('GET', '/attendance/status', cookie)).json();
    expect(onDuty).toEqual({
      onDutySince: record.serverTime,
      lastRecord: { kind: 'check_in', at: record.serverTime },
    });

    const checkOut = await call('POST', '/attendance', cookie, markBody('check_out'));
    expect(checkOut.statusCode).toBe(201);
    expect(
      (await call('GET', '/attendance/status', cookie)).json<{ onDutySince: unknown }>()
        .onDutySince,
    ).toBeNull();
  });

  it('rechaza entrada sobre entrada y salida sin entrada, aunque lleguen al mismo tiempo', async () => {
    const { cookie } = await readyEmployee();
    const noEntry = await call('POST', '/attendance', cookie, markBody('check_out'));
    expect(noEntry.statusCode).toBe(422);

    // Two taps at the same instant: the row lock lets exactly one through.
    const results = await Promise.all([
      call('POST', '/attendance', cookie, markBody('check_in')),
      call('POST', '/attendance', cookie, markBody('check_in')),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 422]);
  });

  it('sin consentimiento no se puede marcar (Ley 1581), aunque se llame a la API directamente', async () => {
    const { cookie } = await loggedIn('employee');
    const res = await call('POST', '/attendance', cookie, markBody('check_in'));
    expect(res.statusCode).toBe(422);
    expect(res.json<{ error: { message: string } }>().error.message).toMatch(/aceptar/);
  });

  it('precisión baja o ubicación vieja: se acepta pero queda para revisión', async () => {
    const { cookie } = await readyEmployee();
    const res = await call(
      'POST',
      '/attendance',
      cookie,
      markBody('check_in', { accuracyM: 250, fixAgeS: 90 }),
    );
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      reviewStatus: 'pending',
      reviewReasons: ['low_accuracy', 'stale_location'],
    });
  });

  it('rechaza una foto que no es JPEG y no deja nada guardado', async () => {
    const { cookie } = await readyEmployee();
    const png = Buffer.alloc(4096, 1);
    png.set([0x89, 0x50, 0x4e, 0x47]);
    const res = await call(
      'POST',
      '/attendance',
      cookie,
      markBody('check_in', { photo: png.toString('base64') }),
    );
    expect(res.statusCode).toBe(400);
    expect(
      (await call('GET', '/attendance/status', cookie)).json<{ lastRecord: unknown }>().lastRecord,
    ).toBeNull();
  });

  it('sin sesión no se marca ni se consulta el estado', async () => {
    expect((await call('POST', '/attendance', undefined, markBody('check_in'))).statusCode).toBe(
      401,
    );
    expect((await call('GET', '/attendance/status')).statusCode).toBe(401);
  });

  it('el administrador ve las marcaciones del día y la selfie; un empleado no', async () => {
    const employee = await readyEmployee();
    const marked = await call('POST', '/attendance', employee.cookie, markBody('check_in'));
    const { id } = marked.json<{ id: string }>();

    const forbidden = [
      await call('GET', '/admin/attendance', employee.cookie),
      await call('GET', `/admin/attendance/${id}/selfie`, employee.cookie),
    ];
    expect(forbidden.map((r) => r.statusCode)).toEqual([403, 403]);
    expect((await call('GET', `/admin/attendance/${id}/selfie`)).statusCode).toBe(401);

    const admin = await loggedIn('admin');
    const list = await call('GET', '/admin/attendance', admin.cookie);
    expect(list.statusCode).toBe(200);
    const entry = list.json<{ id: string; employee: { id: string } }[]>().find((e) => e.id === id);
    expect(entry?.employee.id).toBe(employee.user.id);

    const photo = await call('GET', `/admin/attendance/${id}/selfie`, admin.cookie);
    expect(photo.statusCode).toBe(200);
    expect(photo.headers['content-type']).toBe('image/jpeg');
    expect(photo.headers['cache-control']).toBe('private, no-store');
    expect(photo.rawPayload.equals(Buffer.from(selfie, 'base64'))).toBe(true);
  });

  it('las marcaciones son inmutables: la API no puede editarlas ni borrarlas', async () => {
    const { cookie } = await readyEmployee();
    await call('POST', '/attendance', cookie, markBody('check_in'));
    await expect(pool.query("UPDATE attendance_records SET kind = 'check_out'")).rejects.toThrow(
      /permission denied/,
    );
    await expect(pool.query('DELETE FROM attendance_records')).rejects.toThrow(/permission denied/);
  });

  it('el límite de marcaciones es por persona: la oficina comparte IP y nadie se bloquea por otro', async () => {
    const abuser = await readyEmployee();
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await call(
        'POST',
        '/attendance',
        abuser.cookie,
        markBody(i % 2 === 0 ? 'check_in' : 'check_out'),
      );
      codes.push(res.statusCode);
    }
    expect(codes.slice(0, 10).every((c) => c === 201)).toBe(true);
    expect(codes[10]).toBe(429);

    // Same IP (all inject() calls share it), different person: still allowed.
    const colleague = await readyEmployee();
    const res = await call('POST', '/attendance', colleague.cookie, markBody('check_in'));
    expect(res.statusCode).toBe(201);
  });

  it('un empleado con marcaciones no se puede borrar: solo desactivar', async () => {
    const employee = await readyEmployee();
    await call('POST', '/attendance', employee.cookie, markBody('check_in'));
    const admin = await loggedIn('admin');
    const res = await call('DELETE', `/admin/employees/${employee.user.id}`, admin.cookie);
    expect(res.statusCode).toBe(422);

    // The list tells the panel in advance: consent + 1 record = 2.
    const list = await call('GET', '/admin/employees', admin.cookie);
    const row = list
      .json<{ id: string; recordCount: number }[]>()
      .find((e) => e.id === employee.user.id);
    expect(row?.recordCount).toBe(2);
  });

  describe('selfie opcional (D7)', () => {
    it('quien no autoriza la selfie marca sin foto; mandarla igual se rechaza', async () => {
      const { cookie } = await readyEmployee(false);
      expect((await call('GET', '/me', cookie)).json()).toMatchObject({ selfieAuthorized: false });
      const withPhoto = await call('POST', '/attendance', cookie, markBody('check_in'));
      expect(withPhoto.statusCode).toBe(422);
      const res = await call('POST', '/attendance', cookie, markBody('check_in', { photo: null }));
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ withSelfie: false });
    });

    it('quien autorizó debe enviar la selfie', async () => {
      const { cookie } = await readyEmployee(true);
      const res = await call('POST', '/attendance', cookie, markBody('check_in', { photo: null }));
      expect(res.statusCode).toBe(422);
    });

    it('puede cambiar de opinión cuando quiera; cada decisión queda como prueba inmutable', async () => {
      const { user, cookie } = await readyEmployee(true);
      const revoked = await call('PUT', '/me/selfie-authorization', cookie, { authorized: false });
      expect(revoked.json()).toMatchObject({ selfieAuthorized: false });
      const again = await call('PUT', '/me/selfie-authorization', cookie, { authorized: true });
      expect(again.json()).toMatchObject({ selfieAuthorized: true });

      const { rows } = await pool.query<{ authorized: boolean }>(
        'SELECT authorized FROM selfie_authorizations WHERE employee_id = $1 ORDER BY decided_at',
        [user.id],
      );
      expect(rows.map((r) => r.authorized)).toEqual([true, false, true]);
      await expect(pool.query('DELETE FROM selfie_authorizations')).rejects.toThrow(
        /permission denied/,
      );
    });

    it('el administrador ve la marcación «sin selfie» y no hay foto que pedir', async () => {
      const employee = await readyEmployee(false);
      const marked = await call(
        'POST',
        '/attendance',
        employee.cookie,
        markBody('check_in', { photo: null }),
      );
      const { id } = marked.json<{ id: string }>();
      const admin = await loggedIn('admin');
      const list = await call('GET', '/admin/attendance', admin.cookie);
      const entry = list.json<{ id: string; selfie: string }[]>().find((e) => e.id === id);
      expect(entry?.selfie).toBe('not-authorized');
      expect(
        (await call('GET', '/admin/attendance/' + id + '/selfie', admin.cookie)).statusCode,
      ).toBe(404);
    });

    it('conservación: borra las selfies de más de 90 días; las que esperan revisión, hasta un año', async () => {
      const { user } = await readyEmployee(true);
      const old = new Date(Date.now() - 120 * 86_400_000);
      const plant = async (status: 'ok' | 'pending') => {
        const id = randomUUID();
        const key = selfieKey(user.id, id, old);
        await photos.put(key, Buffer.from(selfie, 'base64'));
        await pool.query(
          `INSERT INTO attendance_records (id, employee_id, kind, server_time, latitude, longitude,
             accuracy_m, location_captured_at, photo_key, review_status)
           VALUES ($1, $2, 'check_in', $3, 3.45, -76.53, 8, $3, $4, $5)`,
          [id, user.id, old, key, status],
        );
        return { id, key };
      };
      const expired = await plant('ok');
      const underReview = await plant('pending');

      const { deleted } = await purgeExpiredSelfies(db, photos, new Date());
      expect(deleted).toBeGreaterThanOrEqual(1);
      await expect(photos.get(expired.key)).rejects.toThrow();
      expect((await photos.get(underReview.key)).length).toBeGreaterThan(0);

      const admin = await loggedIn('admin');
      const res = await call('GET', `/admin/attendance/${expired.id}/selfie`, admin.cookie);
      expect(res.statusCode).toBe(404);
      expect(res.json<{ error: { message: string } }>().error.message).toMatch(/conservación/);
    });
  });
});

describe('copias de seguridad (D8)', () => {
  /** The owner writes runs the way the backup service would. */
  async function asOwner<T>(work: (owner: pg.Client) => Promise<T>): Promise<T> {
    const owner = new pg.Client({
      connectionString: withDatabase(process.env.DATABASE_MIGRATION_URL ?? '', TEST_DB),
    });
    await owner.connect();
    try {
      return await work(owner);
    } finally {
      await owner.end();
    }
  }

  it('el panel avisa si no hay copia reciente y muestra la última buena', async () => {
    const admin = await loggedIn('admin');
    await asOwner((owner) => owner.query('DELETE FROM backup_runs'));
    const empty = await call('GET', '/admin/backups', admin.cookie);
    expect(empty.json()).toMatchObject({ stale: true, database: { lastSuccessAt: null } });

    await asOwner((owner) =>
      owner.query(
        `INSERT INTO backup_runs (kind, ok, detail, finished_at) VALUES
           ('db-daily', true, '28 KB', now() - interval '40 hours'),
           ('db-daily', false, 'sin conexión con Drive', now() - interval '1 hour')`,
      ),
    );
    const old = (await call('GET', '/admin/backups', admin.cookie)).json<{
      stale: boolean;
      database: { lastFailure: { detail: string } | null };
    }>();
    expect(old.stale).toBe(true);
    expect(old.database.lastFailure?.detail).toBe('sin conexión con Drive');

    await asOwner((owner) =>
      owner.query("INSERT INTO backup_runs (kind, ok, detail) VALUES ('db-daily', true, '30 KB')"),
    );
    const fresh = (await call('GET', '/admin/backups', admin.cookie)).json<{
      stale: boolean;
      database: { lastFailure: unknown };
    }>();
    expect(fresh.stale).toBe(false);
    expect(fresh.database.lastFailure).toBeNull();
  });

  it('un empleado no ve el estado de las copias', async () => {
    const { cookie } = await loggedIn('employee');
    expect((await call('GET', '/admin/backups', cookie)).statusCode).toBe(403);
  });

  it('el usuario de respaldos lee todo y registra copias, pero no puede cambiar ningún registro', async () => {
    const password = randomUUID();
    const backupUrl = withDatabase(
      `postgres://pj20_respaldos_test:${password}@localhost:15432/x`,
      TEST_DB,
    );
    const serverUrl = new URL(process.env.DATABASE_URL ?? '');
    const url = new URL(backupUrl);
    url.host = serverUrl.host;
    await ensureLoginRole({
      ownerUrl: withDatabase(process.env.DATABASE_MIGRATION_URL ?? '', TEST_DB),
      userUrl: url.href,
      group: 'pj20_backup',
      label: 'prueba',
    });
    const backup = new pg.Client({ connectionString: url.href });
    await backup.connect();
    try {
      await expect(backup.query('SELECT count(*) FROM attendance_records')).resolves.toBeTruthy();
      await expect(
        backup.query("INSERT INTO backup_runs (kind, ok) VALUES ('selfies', true)"),
      ).resolves.toBeTruthy();
      await expect(backup.query("UPDATE employees SET name = 'x'")).rejects.toThrow(
        /permission denied/,
      );
      await expect(backup.query('DELETE FROM backup_runs')).rejects.toThrow(/permission denied/);
      await expect(
        backup.query("INSERT INTO employees (name, email) VALUES ('x', 'x@x.co')"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await backup.end();
    }
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

describe('revisión y correcciones (Fase 6A)', () => {
  /** Marking without selfie keeps these tests about the timeline only. */
  const markBody = (kind: 'check_in' | 'check_out', over: { accuracyM?: number } = {}) => {
    const now = Date.now();
    return {
      kind,
      location: {
        latitude: 3.4516,
        longitude: -76.532,
        accuracyM: over.accuracyM ?? 8,
        capturedAt: new Date(now - 2000).toISOString(),
      },
      deviceTime: new Date(now).toISOString(),
    };
  };

  async function employeeReady() {
    const session = await loggedIn('employee');
    const consent = await call('POST', '/me/consent', session.cookie, {
      version: CONSENT_VERSION,
      selfie: false,
    });
    expect(consent.statusCode).toBe(204);
    return session;
  }

  async function mark(cookie: string, kind: 'check_in' | 'check_out', accuracyM?: number) {
    const res = await call(
      'POST',
      '/attendance',
      cookie,
      markBody(kind, accuracyM ? { accuracyM } : {}),
    );
    expect(res.statusCode).toBe(201);
    return res.json<{ id: string; serverTime: string }>();
  }

  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

  it('bandeja: una marcación con GPS impreciso espera revisión; aprobarla la saca', async () => {
    const admin = await loggedIn('admin');
    const employee = await employeeReady();
    const record = await mark(employee.cookie, 'check_in', 250);

    const queue = await call('GET', '/admin/review', admin.cookie);
    expect(queue.statusCode).toBe(200);
    expect(queue.json<{ id: string }[]>().map((e) => e.id)).toContain(record.id);

    const approve = await call('POST', `/admin/attendance/${record.id}/review`, admin.cookie, {
      decision: 'approved',
    });
    expect(approve.statusCode).toBe(204);
    const after = await call('GET', '/admin/review', admin.cookie);
    expect(after.json<{ id: string }[]>().map((e) => e.id)).not.toContain(record.id);

    const day = await call('GET', '/admin/attendance', admin.cookie);
    expect(day.json<{ id: string }[]>().find((e) => e.id === record.id)).toMatchObject({
      source: 'record',
      verdict: { decision: 'approved', note: null },
    });
  });

  it('rechazar exige el motivo; queda auditado', async () => {
    const admin = await loggedIn('admin');
    const employee = await employeeReady();
    const record = await mark(employee.cookie, 'check_in', 250);
    const url = `/admin/attendance/${record.id}/review`;

    expect((await call('POST', url, admin.cookie, { decision: 'rejected' })).statusCode).toBe(400);
    expect(
      (await call('POST', url, admin.cookie, { decision: 'rejected', note: 'corto' })).statusCode,
    ).toBe(400);
    const ok = await call('POST', url, admin.cookie, {
      decision: 'rejected',
      note: 'Marcó desde la casa, no desde la obra.',
    });
    expect(ok.statusCode).toBe(204);

    const audit = await call('GET', '/admin/audit?limit=20', admin.cookie);
    expect(
      audit.json<{ action: string; targetId: string }[]>().find((a) => a.targetId === record.id),
    ).toMatchObject({ action: 'attendance.reviewed' });
  });

  it('olvidó la salida: el administrador la agrega y la persona puede volver a entrar', async () => {
    const admin = await loggedIn('admin');
    const employee = await employeeReady();
    await mark(employee.cookie, 'check_in');
    // She cannot check in again: her exit is missing.
    expect(
      (await call('POST', '/attendance', employee.cookie, markBody('check_in'))).statusCode,
    ).toBe(422);

    const add = await call('POST', '/admin/corrections', admin.cookie, {
      action: 'add',
      employeeId: employee.user.id,
      events: [{ kind: 'check_out', at: new Date(Date.now() + 1000).toISOString() }],
      reason: 'Olvidó marcar la salida; confirmado con el supervisor.',
    });
    expect(add.statusCode).toBe(204);

    const status = await call('GET', '/attendance/status', employee.cookie);
    expect(status.json()).toMatchObject({ onDutySince: null, lastRecord: { kind: 'check_out' } });
    await mark(employee.cookie, 'check_in');

    const day = await call('GET', '/admin/attendance', admin.cookie);
    expect(
      day
        .json<{ source: string; employee: { id: string } }[]>()
        .find((e) => e.source === 'correction' && e.employee.id === employee.user.id),
    ).toMatchObject({ kind: 'check_out', by: 'Usuario de prueba', voided: null });
  });

  it('un día olvidado completo (entrada y salida) se agrega junto', async () => {
    const admin = await loggedIn('admin');
    const employee = await employeeReady();
    const res = await call('POST', '/admin/corrections', admin.cookie, {
      action: 'add',
      employeeId: employee.user.id,
      events: [
        { kind: 'check_in', at: hoursAgo(30) },
        { kind: 'check_out', at: hoursAgo(21) },
      ],
      reason: 'Trabajó en la obra sin señal todo el día.',
    });
    expect(res.statusCode).toBe(204);
  });

  it('una corrección que rompe la alternancia, futura o muy vieja se rechaza', async () => {
    const admin = await loggedIn('admin');
    const employee = await employeeReady();
    await mark(employee.cookie, 'check_in');
    const add = (events: { kind: string; at: string }[]) =>
      call('POST', '/admin/corrections', admin.cookie, {
        action: 'add',
        employeeId: employee.user.id,
        events,
        reason: 'Prueba de una corrección inválida.',
      });

    const double = await add([{ kind: 'check_in', at: hoursAgo(1) }]);
    expect(double.statusCode).toBe(422);
    expect(double.json<{ error: { message: string } }>().error.message).toMatch(
      /dos entradas seguidas/,
    );
    expect((await add([{ kind: 'check_out', at: hoursAgo(-2) }])).statusCode).toBe(422);
    expect((await add([{ kind: 'check_in', at: hoursAgo(24 * 100) }])).statusCode).toBe(422);
    const noReason = await call('POST', '/admin/corrections', admin.cookie, {
      action: 'add',
      employeeId: employee.user.id,
      events: [{ kind: 'check_out', at: hoursAgo(0) }],
      reason: 'corto',
    });
    expect(noReason.statusCode).toBe(400);
  });

  it('anular: un par por error se anula junto; la entrada sola no (dejaría la salida suelta)', async () => {
    const admin = await loggedIn('admin');
    const employee = await employeeReady();
    const checkIn = await mark(employee.cookie, 'check_in');
    const checkOut = await mark(employee.cookie, 'check_out');
    const voidIds = (targetIds: string[]) =>
      call('POST', '/admin/corrections', admin.cookie, {
        action: 'void',
        targetIds,
        reason: 'Marcó por error al probar la app.',
      });

    const alone = await voidIds([checkIn.id]);
    expect(alone.statusCode).toBe(422);
    expect(alone.json<{ error: { message: string } }>().error.message).toMatch(
      /salida sin entrada/,
    );

    expect((await voidIds([checkIn.id, checkOut.id])).statusCode).toBe(204);
    expect((await voidIds([checkOut.id])).statusCode).toBe(409);

    const day = await call('GET', '/admin/attendance', admin.cookie);
    const entry = day.json<{ id: string }[]>().find((e) => e.id === checkIn.id);
    expect(entry).toMatchObject({ voided: { reason: 'Marcó por error al probar la app.' } });
    // The original record is still there, untouched.
    const [row] = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.id, checkIn.id));
    expect(row?.kind).toBe('check_in');
    // Off duty again: the voided marks do not count.
    expect((await call('GET', '/attendance/status', employee.cookie)).json()).toEqual({
      onDutySince: null,
      lastRecord: null,
    });
  });

  it('una salida agregada por error se anula y el turno vuelve a quedar abierto', async () => {
    const admin = await loggedIn('admin');
    const employee = await employeeReady();
    await mark(employee.cookie, 'check_in');
    await call('POST', '/admin/corrections', admin.cookie, {
      action: 'add',
      employeeId: employee.user.id,
      events: [{ kind: 'check_out', at: new Date(Date.now() + 1000).toISOString() }],
      reason: 'Salida agregada para la prueba de anulación.',
    });
    const day = await call('GET', '/admin/attendance', admin.cookie);
    const added = day
      .json<{ id: string; source: string; employee: { id: string } }[]>()
      .find((e) => e.source === 'correction' && e.employee.id === employee.user.id);
    if (!added) throw new Error('sin corrección');
    const voided = await call('POST', '/admin/corrections', admin.cookie, {
      action: 'void',
      targetIds: [added.id],
      reason: 'Se agregó a la persona equivocada.',
    });
    expect(voided.statusCode).toBe(204);
    const status = await call('GET', '/attendance/status', employee.cookie);
    expect(status.json()).toMatchObject({ lastRecord: { kind: 'check_in' } });
    // A void cannot be voided: re-adding is the way back.
    const audit = await call('GET', '/admin/audit?limit=5', admin.cookie);
    expect(audit.json<{ action: string }[]>()[0]).toMatchObject({ action: 'attendance.voided' });
  });

  it('no se anulan juntas marcaciones de dos personas', async () => {
    const admin = await loggedIn('admin');
    const ana = await employeeReady();
    const beto = await employeeReady();
    const a = await mark(ana.cookie, 'check_in');
    const b = await mark(beto.cookie, 'check_in');
    const res = await call('POST', '/admin/corrections', admin.cookie, {
      action: 'void',
      targetIds: [a.id, b.id],
      reason: 'Intento de anular a dos personas.',
    });
    expect(res.statusCode).toBe(422);
  });

  it('las revisiones y correcciones son inmutables, incluso para la API', async () => {
    await expect(pool.query('UPDATE attendance_corrections SET reason = reason')).rejects.toThrow(
      /permission denied/,
    );
    await expect(pool.query('DELETE FROM attendance_reviews')).rejects.toThrow(/permission denied/);
  });

  it('un empleado no puede revisar ni corregir', async () => {
    const employee = await employeeReady();
    const record = await mark(employee.cookie, 'check_in');
    expect((await call('GET', '/admin/review', employee.cookie)).statusCode).toBe(403);
    const review = await call('POST', `/admin/attendance/${record.id}/review`, employee.cookie, {
      decision: 'approved',
    });
    expect(review.statusCode).toBe(403);
    const correction = await call('POST', '/admin/corrections', employee.cookie, {
      action: 'add',
      employeeId: employee.user.id,
      events: [{ kind: 'check_out', at: hoursAgo(0) }],
      reason: 'Me agrego la salida yo mismo.',
    });
    expect(correction.statusCode).toBe(403);
  });
});
