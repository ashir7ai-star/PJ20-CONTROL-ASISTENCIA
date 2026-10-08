import { describe, expect, it } from 'vitest';

import { InvalidEnvError, loadEnv } from './env.js';

const validEnv = {
  APP_ORIGINS: 'http://localhost:5173',
  DATABASE_URL: 'postgres://user:secret@localhost:5432/db',
  REDIS_URL: 'redis://:secret@localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'access',
  S3_SECRET_KEY: 'super-secret-value',
  S3_BUCKET: 'selfies',
  GOOGLE_CLIENT_ID: '123-abc.apps.googleusercontent.com',
};

describe('loadEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = loadEnv(validEnv);
    expect(env.PORT).toBe(4400);
    expect(env.NODE_ENV).toBe('development');
    expect(env.APP_ORIGINS).toEqual(['http://localhost:5173']);
  });

  it('splits multiple allowed origins', () => {
    const env = loadEnv({ ...validEnv, APP_ORIGINS: 'http://a.test, https://b.test' });
    expect(env.APP_ORIGINS).toEqual(['http://a.test', 'https://b.test']);
  });

  it('reports every missing variable by name', () => {
    const { DATABASE_URL, S3_SECRET_KEY, ...incomplete } = validEnv;
    const error = captureError(() => loadEnv(incomplete));
    expect(error).toBeInstanceOf(InvalidEnvError);
    expect((error as InvalidEnvError).invalidKeys).toEqual(
      expect.arrayContaining(['DATABASE_URL', 'S3_SECRET_KEY']),
    );
  });

  it('never leaks secret values in the error message', () => {
    const error = captureError(() => loadEnv({ ...validEnv, S3_ENDPOINT: 'not-a-url' }));
    expect((error as Error).message).toContain('S3_ENDPOINT');
    expect((error as Error).message).not.toContain('super-secret-value');
  });

  it('rejects a Google client id that is not a Google client id', () => {
    expect(() => loadEnv({ ...validEnv, GOOGLE_CLIENT_ID: 'https://evil.example' })).toThrow(
      InvalidEnvError,
    );
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ ...validEnv, PORT: '99999' })).toThrow(InvalidEnvError);
  });
});

function captureError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected function to throw');
}
