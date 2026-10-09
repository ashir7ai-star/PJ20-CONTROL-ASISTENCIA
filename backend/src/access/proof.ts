/**
 * Proof that THIS browser just signed in with a Google account that is not on
 * the allowlist (D6). It lets that person ask for access with the identity
 * Google verified — name and e-mail are never typed, so nobody can file a
 * request on someone else's behalf. Redis keeps only the token's hash.
 */
import { createHash, randomBytes } from 'node:crypto';

import type { Redis } from 'ioredis';

const PREFIX = 'auth:access-proof:';
export const ACCESS_PROOF_TTL_SECONDS = 900;

export interface VerifiedIdentity {
  email: string;
  name: string;
}

export interface AccessProofStore {
  issue(identity: VerifiedIdentity): Promise<string>;
  read(token: string): Promise<VerifiedIdentity | null>;
}

const keyOf = (token: string) => `${PREFIX}${createHash('sha256').update(token).digest('hex')}`;

export function createAccessProofStore(redis: Redis): AccessProofStore {
  return {
    async issue(identity) {
      const token = randomBytes(32).toString('base64url');
      await redis.set(keyOf(token), JSON.stringify(identity), 'EX', ACCESS_PROOF_TTL_SECONDS);
      return token;
    },
    async read(token) {
      if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
      const raw = await redis.get(keyOf(token));
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<VerifiedIdentity>;
      return typeof value.email === 'string' && typeof value.name === 'string'
        ? { email: value.email, name: value.name }
        : null;
    },
  };
}
