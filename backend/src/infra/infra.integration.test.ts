/**
 * Integration tests against REAL Postgres, Redis and S3 storage.
 * Locally:  docker compose up -d --wait  &&  pnpm test:integration
 * In CI the same services are started with docker compose.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DeleteBucketCommand } from '@aws-sdk/client-s3';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { healthResponseSchema } from '@pj20/shared';

import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { checkDatabase, createDatabasePool } from './postgres.js';
import { checkCache, createRedisClient } from './redis.js';
import { checkStorage, createStorageClient, ensureBucket } from './storage.js';

const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = loadEnv();
const db = createDatabasePool(env.DATABASE_URL);
const redis = createRedisClient(env.REDIS_URL);
const storage = createStorageClient({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  accessKey: env.S3_ACCESS_KEY,
  secretKey: env.S3_SECRET_KEY,
});
const testBucket = `${env.S3_BUCKET}-it-${Date.now().toString(36)}`;

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({
    appOrigins: env.APP_ORIGINS,
    logger: false,
    checks: {
      database: () => checkDatabase(db),
      cache: () => checkCache(redis),
      storage: () => checkStorage(storage, testBucket),
    },
  });
});

afterAll(async () => {
  await app.close();
  await storage.send(new DeleteBucketCommand({ Bucket: testBucket })).catch(() => undefined);
  await Promise.allSettled([db.end(), redis.quit()]);
  storage.destroy();
});

describe('infrastructure (real services)', () => {
  it('connects to Postgres', async () => {
    await expect(checkDatabase(db)).resolves.toBeUndefined();
  });

  it('connects to Redis', async () => {
    await expect(checkCache(redis)).resolves.toBeUndefined();
  });

  it('creates the bucket once and is idempotent afterwards', async () => {
    await expect(ensureBucket(storage, testBucket)).resolves.toBe('created');
    await expect(ensureBucket(storage, testBucket)).resolves.toBe('exists');
    await expect(checkStorage(storage, testBucket)).resolves.toBeUndefined();
  });

  it('GET /api/health reports every real dependency as up', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(healthResponseSchema.parse(res.json()).checks).toEqual({
      database: 'up',
      cache: 'up',
      storage: 'up',
    });
  });

  it('detects an unreachable Redis', async () => {
    const broken = createRedisClient('redis://127.0.0.1:1');
    broken.on('error', () => undefined);
    await expect(checkCache(broken)).rejects.toThrow();
    broken.disconnect();
  });
});
