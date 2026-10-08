/**
 * Official Google Sign-In button (Google Identity Services), redirect mode
 * (decision D5: the popup cannot report back on iPhone). Flow:
 *   1. our server issues a single-use nonce and binds it to this browser
 *      with an HttpOnly cookie,
 *   2. the same tab goes to Google, which signs the nonce into the ID token,
 *   3. Google posts the token to /api/v1/auth/google/redirect; the server
 *      verifies token + nonce + cookie, opens the session and sends the
 *      browser back to the app.
 */
import { useEffect, useRef, useState } from 'react';

import type { NonceResponse } from '@pj20/shared';

import { api } from '../api/client.js';
import { Button } from '../components/ui/button.js';
import { resolveTheme, useThemePreference } from '../lib/theme.js';

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    nonce: string;
    ux_mode: 'redirect';
    /** Must be listed in Google Cloud → Authorized redirect URIs. */
    login_uri: string;
    context?: 'signin' | 'signup' | 'use';
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      logo_alignment?: 'left' | 'center';
      width?: number;
      locale?: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
/** Our nonces live 5 minutes on the server: refresh the button before that. */
const NONCE_REFRESH_MS = 4 * 60_000;

let scriptPromise: Promise<GoogleIdApi> | null = null;

function loadGoogleScript(): Promise<GoogleIdApi> {
  const existing = window.google?.accounts.id;
  if (existing) return Promise.resolve(existing);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.google) resolve(window.google.accounts.id);
      else reject(new Error('Google Identity Services no disponible'));
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('No se pudo cargar Google Identity Services'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface GoogleButtonProps {
  clientId: string;
}

/**
 * Renders Google's button once the script and a fresh nonce are both ready.
 * If either fails (no internet, server down) it says so and offers a manual
 * retry: never an automatic loop that would hammer the server.
 */
export function GoogleButton({ clientId }: GoogleButtonProps) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const theme = resolveTheme(useThemePreference());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const render = async () => {
      try {
        const [google, { nonce }] = await Promise.all([
          loadGoogleScript(),
          api<NonceResponse>('/auth/nonce', { method: 'POST' }),
        ]);
        const element = container.current;
        if (cancelled || !element) return;
        google.initialize({
          client_id: clientId,
          nonce,
          ux_mode: 'redirect',
          login_uri: new URL('/api/v1/auth/google/redirect', window.location.origin).href,
          context: 'signin',
        });
        element.replaceChildren();
        google.renderButton(element, {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
          width: Math.min(400, Math.max(240, element.clientWidth)),
          locale: 'es',
        });
        setStatus('ready');
        timer = setTimeout(() => void render(), NONCE_REFRESH_MS);
      } catch {
        if (!cancelled) setStatus('failed');
      }
    };

    void render();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clientId, theme, attempt]);

  if (status === 'failed') {
    return (
      <div className="flex w-full flex-col items-center gap-3">
        <p role="alert" className="text-center text-[14px] text-danger">
          No se pudo cargar el inicio de sesión. Revisa tu conexión.
        </p>
        <Button
          variant="secondary"
          block
          onClick={() => {
            setStatus('loading');
            setAttempt((n) => n + 1);
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-11 w-full justify-center">
      <div ref={container} className="flex w-full justify-center" />
      {status === 'loading' && (
        <span className="absolute inset-0 animate-pulse rounded-full bg-line" aria-hidden="true" />
      )}
    </div>
  );
}
