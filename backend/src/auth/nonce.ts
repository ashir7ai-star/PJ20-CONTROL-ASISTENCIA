/**
 * Single-use nonces bound into the Google ID token, so a captured credential
 * cannot be replayed. Stored in Redis for 5 minutes; GETDEL consumes them
 * atomically (a nonce works exactly once).
 */
import { randomBytes } from 'node:crypto';

import type { Redis } from 'ioredis';

const PREFIX = 'auth:nonce:';
const TTL_SECONDS = 300;

export interface NonceStore {
  issue(): Promise<string>;
  /** True only the first time a valid, unexpired nonce is presented. */
  consume(nonce: string): Promise<boolean>;
}

export function createNonceStore(redis: Redis): NonceStore {
  return {
    async issue() {
      const nonce = randomBytes(24).toString('base64url');
      await redis.set(`${PREFIX}${nonce}`, '1', 'EX', TTL_SECONDS);
      return nonce;
    },
    async consume(nonce) {
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) return false;
      return (await redis.getdel(`${PREFIX}${nonce}`)) === '1';
    },
  };
}
