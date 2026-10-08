/**
 * The real application entry: session → consent → Marcar (real shift status
 * and marking with selfie + GPS since Fase 3).
 */
import type { Me } from '@pj20/shared';
import { CONSENT_VERSION } from '@pj20/shared/constants';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { api, ApiRequestError } from '../api/client.js';
import { GoogleButton } from '../auth/google-button.js';
import { AppLoading } from '../components/brand/app-loading.js';
import { LoginScreen } from '../features/employee/screens/login-screen.js';
import { ProblemScreen } from '../features/employee/screens/problem-screen.js';

// Signed-in screens load on demand: the sign-in screen (first visit) stays light.
const EmployeeHome = lazy(() =>
  import('../features/employee/employee-home.js').then((m) => ({ default: m.EmployeeHome })),
);
const ConsentScreen = lazy(() =>
  import('../features/employee/screens/consent-screen.js').then((m) => ({
    default: m.ConsentScreen,
  })),
);

type State =
  | { kind: 'loading' }
  | { kind: 'signed-out'; error: string | null }
  | { kind: 'verifying' }
  | { kind: 'not-authorized' }
  | { kind: 'offline' }
  | { kind: 'signed-in'; me: Me };

/** Who is signed in, if anyone. Never throws: every outcome is a screen. */
async function readSession(): Promise<State> {
  try {
    return { kind: 'signed-in', me: await api<Me>('/me') };
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'NETWORK_ERROR') {
      return { kind: 'offline' };
    }
    return { kind: 'signed-out', error: null };
  }
}

export function RealApp() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
  const navigate = useNavigate();

  // Incrementing this re-reads the session (on start, after consent, on retry).
  const [sessionCheck, setSessionCheck] = useState(0);
  const loadSession = useCallback(() => {
    setSessionCheck((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    readSession().then(
      (next) => {
        if (!cancelled) setState(next);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [sessionCheck]);

  const onCredential = useCallback(async (credential: string, nonce: string) => {
    setState({ kind: 'verifying' });
    try {
      const me = await api<Me>('/auth/google', {
        method: 'POST',
        body: { credential, nonce },
      });
      setState({ kind: 'signed-in', me });
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'ACCOUNT_NOT_AUTHORIZED') {
        setState({ kind: 'not-authorized' });
      } else {
        setState({
          kind: 'signed-out',
          error: error instanceof ApiRequestError ? error.message : 'No pudimos iniciar sesión.',
        });
      }
    }
  }, []);

  const onSessionExpired = useCallback(() => {
    setState({ kind: 'signed-out', error: 'Tu sesión terminó. Inicia sesión de nuevo.' });
  }, []);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setState({ kind: 'signed-out', error: null });
  };

  switch (state.kind) {
    case 'loading':
      return <AppLoading />;
    case 'offline':
      return <ProblemScreen kind="offline" onPrimary={loadSession} />;
    case 'not-authorized':
      return (
        <ProblemScreen
          kind="not-authorized"
          onPrimary={() => {
            setState({ kind: 'signed-out', error: null });
          }}
        />
      );
    case 'signed-out':
    case 'verifying':
      return (
        <LoginScreen
          verifying={state.kind === 'verifying'}
          error={state.kind === 'signed-out' ? state.error : null}
          googleButton={
            clientId ? (
              <GoogleButton clientId={clientId} onCredential={(c, n) => void onCredential(c, n)} />
            ) : (
              <p role="alert" className="text-center text-[14px] text-danger">
                Falta configurar VITE_GOOGLE_CLIENT_ID.
              </p>
            )
          }
        />
      );
    case 'signed-in': {
      const { me } = state;
      return (
        <Suspense fallback={<AppLoading />}>
          {me.consentRequired ? (
            <ConsentScreen
              onAccept={() =>
                void api('/me/consent', {
                  method: 'POST',
                  body: { version: CONSENT_VERSION },
                }).then(loadSession)
              }
            />
          ) : (
            <EmployeeHome
              me={me}
              onLogout={() => void logout()}
              onSessionExpired={onSessionExpired}
              {...(me.role === 'admin'
                ? {
                    onOpenAdmin: () => {
                      void navigate('/admin');
                    },
                  }
                : {})}
            />
          )}
        </Suspense>
      );
    }
  }
}
