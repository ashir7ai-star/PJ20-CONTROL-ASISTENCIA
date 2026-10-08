/**
 * Verifies Google ID tokens (decision D1): signature against Google's public
 * keys, issuer, audience (our client id), expiry, verified e-mail and the
 * single-use nonce. No client secret is involved.
 */
import { createRemoteJWKSet, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from 'jose';

import { errors } from '../errors.js';

export interface GoogleIdentity {
  email: string;
  name: string;
  /** Google's stable account id. */
  subject: string;
}

export interface GoogleVerifier {
  verify(idToken: string, expectedNonce: string): Promise<GoogleIdentity>;
}

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_JWKS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');

/** `keys` is injectable so tests can sign tokens with their own key pair. */
export function createGoogleVerifier(
  clientId: string,
  keys: JWTVerifyGetKey = createRemoteJWKSet(GOOGLE_JWKS_URL),
): GoogleVerifier {
  return {
    async verify(idToken, expectedNonce) {
      let payload: JWTPayload;
      try {
        ({ payload } = await jwtVerify(idToken, keys, {
          issuer: GOOGLE_ISSUERS,
          audience: clientId,
          algorithms: ['RS256'],
          clockTolerance: 30,
        }));
      } catch {
        throw errors.invalidCredential();
      }

      const { email, email_verified: emailVerified, name, nonce, sub } = payload;
      if (
        typeof email !== 'string' ||
        emailVerified !== true ||
        typeof sub !== 'string' ||
        nonce !== expectedNonce
      ) {
        throw errors.invalidCredential();
      }
      return {
        email: email.toLowerCase(),
        name: typeof name === 'string' && name.trim() ? name.trim() : email,
        subject: sub,
      };
    },
  };
}
