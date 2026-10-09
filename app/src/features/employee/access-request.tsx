/**
 * "Tu cuenta no está autorizada" with the option to ask for access (D6).
 * The server remembers, for 15 minutes, which Google account this browser
 * just used; the request goes out with that verified name and e-mail.
 */
import type { AccessRequestCurrent } from '@pj20/shared';
import { useEffect, useState } from 'react';

import { api, ApiRequestError } from '../../api/client.js';
import { AppLoading } from '../../components/brand/app-loading.js';
import { ProblemScreen } from './screens/problem-screen.js';

type Step =
  | { kind: 'loading' }
  /** No proof (expired, or signed in long ago): the plain message. */
  | { kind: 'plain' }
  | { kind: 'can-request'; who: AccessRequestCurrent; sending: boolean; error: string | null }
  | { kind: 'pending' }
  | { kind: 'sent' };

interface AccessRequestProps {
  /** Back to the sign-in screen (another account, or done). */
  onExit: () => void;
}

export function AccessRequest({ onExit }: AccessRequestProps) {
  const [step, setStep] = useState<Step>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    api<AccessRequestCurrent>('/access-requests/current').then(
      (who) => {
        if (cancelled) return;
        setStep(
          who.pending
            ? { kind: 'pending' }
            : { kind: 'can-request', who, sending: false, error: null },
        );
      },
      () => {
        if (!cancelled) setStep({ kind: 'plain' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const send = async (who: AccessRequestCurrent) => {
    setStep({ kind: 'can-request', who, sending: true, error: null });
    try {
      const { status } = await api<{ status: 'created' | 'pending' }>('/access-requests', {
        method: 'POST',
      });
      setStep(status === 'created' ? { kind: 'sent' } : { kind: 'pending' });
    } catch (error) {
      const message =
        error instanceof ApiRequestError && error.code === 'NOT_FOUND'
          ? 'Pasó mucho tiempo desde que iniciaste sesión. Vuelve a entrar con Google y solicita acceso de nuevo.'
          : error instanceof ApiRequestError && error.code !== 'NETWORK_ERROR'
            ? error.message
            : 'No pudimos enviar la solicitud. Revisa tu conexión e inténtalo de nuevo.';
      setStep({ kind: 'can-request', who, sending: false, error: message });
    }
  };

  switch (step.kind) {
    case 'loading':
      return <AppLoading />;
    case 'plain':
      return <ProblemScreen kind="not-authorized" onPrimary={onExit} />;
    case 'pending':
      return <ProblemScreen kind="access-pending" onPrimary={onExit} />;
    case 'sent':
      return <ProblemScreen kind="access-sent" onPrimary={onExit} />;
    case 'can-request': {
      const { who } = step;
      return (
        <ProblemScreen
          kind="access-request"
          body={
            step.error ??
            `Entraste como ${who.name} (${who.email}). Si debes usar esta aplicación, pide acceso a tu administrador.`
          }
          busy={step.sending}
          onPrimary={() => void send(who)}
          onSecondary={onExit}
        />
      );
    }
  }
}
