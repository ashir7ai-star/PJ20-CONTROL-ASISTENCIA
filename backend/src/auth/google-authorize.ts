/**
 * Google's standard OpenID Connect sign-in address (D9), used by the window the
 * installed iPhone app opens. Same guarantees as the button flow (D1/D5): an ID
 * token signed by Google with our single-use nonce, posted back to our
 * registered redirect URI. No client secret is involved.
 */
const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

/** Echoed by Google in `state`: tells the redirect route it serves the sign-in window. */
export const SIGN_IN_WINDOW_STATE = 'ventana';

export interface AuthorizeRequest {
  clientId: string;
  /** Must be listed in Google Cloud → Authorized redirect URIs. */
  redirectUri: string;
  nonce: string;
}

export function googleAuthorizeUrl({ clientId, redirectUri, nonce }: AuthorizeRequest): string {
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    response_mode: 'form_post',
    scope: 'openid email profile',
    nonce,
    state: SIGN_IN_WINDOW_STATE,
    prompt: 'select_account',
    hl: 'es-419',
  }).toString();
  return url.href;
}

/**
 * The app origin this request belongs to: its own host when it is one of ours,
 * otherwise the first configured origin. Never an arbitrary Host header.
 */
export function appOriginFor(host: string, protocol: string, appOrigins: string[]): string {
  const candidate = `${protocol}://${host}`;
  const fallback = appOrigins[0];
  if (fallback === undefined) throw new Error('APP_ORIGINS vacío');
  return appOrigins.includes(candidate) ? candidate : fallback;
}
