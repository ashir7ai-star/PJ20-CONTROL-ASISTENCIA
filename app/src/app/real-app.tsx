/**
 * The real application entry: session → consent → Marcar (real shift status
 * and marking with selfie + GPS since Fase 3).
 */
import type { Me } from '@pj20/shared';
import { CONSENT_VERSION } from '@pj20/shared/constants';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { api, ApiRequestError } from '../api/client.js';
import { GoogleButton } from '../auth/google-button.js';
import { AccessRequest } from '../features/employee/access-request.js';
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

/** Outcome of Google's redirect, as reported by the server. */
function stateForAccessIssue(issue: string): State {
  return issue === 'no-autorizada'
    ? { kind: 'not-authorized' }
    : { kind: 'signed-out', error: 'No pudimos verificar tu cuenta de Google. Intenta de nuevo.' };
}

export function RealApp() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [saving, setSaving] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
  const navigate = useNavigate();

  // Back from Google (redirect mode, D5): the server says how it went in ?acceso=.
  // Read once, applied to the first session check, then removed from the address.
  const [params, setParams] = useSearchParams();
  const accessIssue = useRef(params.get('acceso'));
  useEffect(() => {
    if (params.has('acceso')) setParams({}, { replace: true });
  }, [params, setParams]);

  // Incrementing this re-reads the session (on start, after consent, on retry).
  const [sessionCheck, setSessionCheck] = useState(0);
  const loadSession = useCallback(() => {
    setSessionCheck((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    readSession().then(
      (next) => {
        if (cancelled) return;
        const issue = accessIssue.current;
        accessIssue.current = null;
        setState(next.kind === 'signed-out' && issue ? stateForAccessIssue(issue) : next);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [sessionCheck]);

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
        <AccessRequest
          onExit={() => {
            setState({ kind: 'signed-out', error: null });
          }}
        />
      );
    case 'signed-out':
      return (
        <LoginScreen
          error={state.error}
          googleButton={
            clientId ? (
              <GoogleButton clientId={clientId} />
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
              busy={saving}
              onAccept={(selfie) => {
                setSaving(true);
                // Either way the session is read again: the server says what is in force.
                void api('/me/consent', {
                  method: 'POST',
                  body: { version: CONSENT_VERSION, selfie },
                })
                  .catch(() => undefined)
                  .finally(() => {
                    setSaving(false);
                    loadSession();
                  });
              }}
            />
          ) : me.selfieAuthorized === null ? (
            // Consent given before the selfie became a separate decision (D7): ask it now.
            <ConsentScreen
              mode="selfie-only"
              busy={saving}
              onAccept={(selfie) => {
                setSaving(true);
                void api<Me>('/me/selfie-authorization', {
                  method: 'PUT',
                  body: { authorized: selfie },
                })
                  .then((next) => {
                    setState({ kind: 'signed-in', me: next });
                  }, loadSession)
                  .finally(() => {
                    setSaving(false);
                  });
              }}
            />
          ) : (
            <EmployeeHome
              me={me}
              onMeChange={(next) => {
                setState({ kind: 'signed-in', me: next });
              }}
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
