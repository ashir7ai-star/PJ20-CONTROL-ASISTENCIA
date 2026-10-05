import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { apiErrorSchema, healthResponseSchema } from '@pj20/shared';

import { buildApp } from './app.js';
import type { HealthChecks } from './routes/health.js';

const up = () => Promise.resolve();
const down = () => Promise.reject(new Error('connection refused: secret-host:5432'));

const allUp: HealthChecks = { database: up, cache: up, storage: up };

let app: FastifyInstance | undefined;

async function createApp(checks: HealthChecks = allUp): Promise<FastifyInstance> {
  app = await buildApp({ appOrigins: ['http://localhost:5173'], checks, logger: false });
  return app;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /api/health', () => {
  it('returns 200 and a valid body when every dependency is up', async () => {
    const res = await (await createApp()).inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    const body = healthResponseSchema.parse(res.json());
    expect(body.status).toBe('ok');
    expect(body.checks).toEqual({ database: 'up', cache: 'up', storage: 'up' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('returns 503 and marks only the failing dependency as down', async () => {
    const res = await (
      await createApp({ ...allUp, cache: down })
    ).inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(503);
    const body = healthResponseSchema.parse(res.json());
    expect(body.status).toBe('degraded');
    expect(body.checks).toEqual({ database: 'up', cache: 'down', storage: 'up' });
  });

  it('never exposes internal error details', async () => {
    const res = await (
      await createApp({ ...allUp, database: down })
    ).inject({ method: 'GET', url: '/api/health' });

    expect(res.body).not.toContain('secret-host');
    expect(res.body).not.toContain('connection refused');
  });

  it('marks a dependency as down when its check hangs', async () => {
    const hang = () => new Promise<void>(() => undefined);
    const res = await (
      await createApp({ ...allUp, storage: hang })
    ).inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(503);
    expect(healthResponseSchema.parse(res.json()).checks.storage).toBe('down');
  }, 5_000);
});

describe('cross-cutting behaviour', () => {
  it('adds a server-generated request id, ignoring any client-supplied one', async () => {
    const res = await (
      await createApp()
    ).inject({ method: 'GET', url: '/api/health', headers: { 'x-request-id': 'attacker-value' } });

    const requestId = res.headers['x-request-id'];
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestId).not.toBe('attacker-value');
  });

  it('sets security headers', async () => {
    const res = await (await createApp()).inject({ method: 'GET', url: '/api/health' });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows CORS only for configured origins', async () => {
    const instance = await createApp();
    const allowed = await instance.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'http://localhost:5173' },
    });
    const denied = await instance.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'https://evil.example' },
    });

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns the standard error envelope for unknown routes', async () => {
    const res = await (await createApp()).inject({ method: 'GET', url: '/does-not-exist' });

    expect(res.statusCode).toBe(404);
    const body = apiErrorSchema.parse(res.json());
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('returns the standard error envelope for malformed JSON', async () => {
    const instance = await createApp();
    instance.post('/echo', () => ({ ok: true }));
    const res = await instance.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{ not json',
    });

    expect(res.statusCode).toBe(400);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('FST_ERR_CTP_INVALID_JSON_BODY');
  });

  it('hides internal details of unexpected errors', async () => {
    const instance = await createApp();
    instance.get('/boom', () => {
      throw new Error('database password is hunter2');
    });
    const res = await instance.inject({ method: 'GET', url: '/boom' });

    expect(res.statusCode).toBe(500);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('INTERNAL_ERROR');
    expect(res.body).not.toContain('hunter2');
  });
});
