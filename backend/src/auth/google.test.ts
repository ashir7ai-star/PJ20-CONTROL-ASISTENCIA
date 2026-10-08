import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';

import { DomainError } from '../errors.js';
import { createGoogleVerifier, type GoogleVerifier } from './google.js';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const NONCE = 'nonce-de-prueba-1234567890';

type Keys = Awaited<ReturnType<typeof generateKeyPair>>;
let googleKeys: Keys;
let attackerKeys: Keys;
let verifier: GoogleVerifier;

beforeAll(async () => {
  googleKeys = await generateKeyPair('RS256');
  attackerKeys = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(googleKeys.publicKey)), kid: 'google-1', alg: 'RS256' };
  verifier = createGoogleVerifier(CLIENT_ID, createLocalJWKSet({ keys: [jwk] }));
});

interface TokenOptions {
  claims?: Record<string, unknown>;
  issuer?: string;
  audience?: string;
  expiresIn?: string;
  key?: Keys['privateKey'];
}

function token({
  claims = {},
  issuer = 'https://accounts.google.com',
  audience = CLIENT_ID,
  expiresIn = '10m',
  key = googleKeys.privateKey,
}: TokenOptions = {}) {
  return new SignJWT({
    email: 'Laura.Gomez@Gmail.com',
    email_verified: true,
    name: 'Laura Gómez',
    nonce: NONCE,
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'google-1' })
    .setSubject('google-sub-123')
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba un rechazo');
}

describe('verificación de credenciales de Google (D1)', () => {
  it('acepta una credencial válida y normaliza el correo a minúsculas', async () => {
    const identity = await verifier.verify(await token(), NONCE);
    expect(identity).toEqual({
      email: 'laura.gomez@gmail.com',
      name: 'Laura Gómez',
      subject: 'google-sub-123',
    });
  });

  it.each<[string, () => Promise<string>]>([
    ['firmada por otra llave (falsificada)', () => token({ key: attackerKeys.privateKey })],
    ['para otra aplicación (audiencia distinta)', () => token({ audience: 'otra-app' })],
    ['de otro emisor', () => token({ issuer: 'https://evil.example' })],
    ['vencida', () => token({ expiresIn: '-5m' })],
    ['con correo no verificado', () => token({ claims: { email_verified: false } })],
    ['sin correo', () => token({ claims: { email: undefined } })],
    ['con otro nonce (repetición)', () => token({ claims: { nonce: 'otro-nonce-0000000000' } })],
  ])('rechaza una credencial %s', async (_case, make) => {
    const error = await rejection(verifier.verify(await make(), NONCE));
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('INVALID_CREDENTIAL');
  });

  it('rechaza texto que no es un token', async () => {
    const error = await rejection(verifier.verify('esto-no-es-un-jwt', NONCE));
    expect((error as DomainError).code).toBe('INVALID_CREDENTIAL');
  });
});
