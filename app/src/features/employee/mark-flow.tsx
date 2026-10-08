/**
 * Real clock-in/out flow (Fase 3): front camera + one-shot GPS + server time.
 * Two taps from Marcar (CLAUDE.md §8.1): the Pulso button, then the shutter.
 * Camera and GPS start together so the fix is usually ready by the time the
 * employee has framed the selfie.
 */
import type { AttendanceKind, MarkRequest, MarkResponse } from '@pj20/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api, ApiRequestError } from '../../api/client.js';
import { AppLoading } from '../../components/brand/app-loading.js';
import { CameraFailure, captureFrame, openFrontCamera, stopCamera } from '../../lib/camera.js';
import { formatAccuracy } from '../../lib/format.js';
import { type Fix, getBestFix, LocationFailure } from '../../lib/geolocation.js';
import { WEAK_ACCURACY_M } from './model.js';
import { ConfirmationScreen } from './screens/confirmation-screen.js';
import { PermissionsScreen } from './screens/permissions-screen.js';
import { type ProblemKind, ProblemScreen } from './screens/problem-screen.js';
import { SelfieScreen } from './screens/selfie-screen.js';

type Step =
  | { kind: 'explain' }
  | { kind: 'starting' }
  | { kind: 'capture'; stream: MediaStream; fix: Fix | null; busy: boolean }
  | { kind: 'weak'; photo: string; fix: Fix }
  | { kind: 'sending' }
  | { kind: 'done'; record: MarkResponse }
  | { kind: 'problem'; problem: ProblemKind; body?: string };

interface MarkFlowProps {
  kind: AttendanceKind;
  /** Back to Marcar; `marked` tells the caller to refresh the status. */
  onClose: (marked: boolean) => void;
  onSessionExpired: () => void;
}

const PERMISSIONS_EXPLAINED_ITEM = 'pj20.permisos-explicados';

function permissionsExplained(): boolean {
  try {
    return localStorage.getItem(PERMISSIONS_EXPLAINED_ITEM) === '1';
  } catch {
    return false;
  }
}

function rememberExplained(): void {
  try {
    localStorage.setItem(PERMISSIONS_EXPLAINED_ITEM, '1');
  } catch {
    // Private mode: the explanation simply shows again next time.
  }
}

const isIPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

/** Where to re-enable a blocked permission, in the employee's own browser. */
function permissionHelp(what: 'la ubicación' | 'la cámara'): string {
  return isIPhone()
    ? `Abre Ajustes → Safari → ${what === 'la cámara' ? 'Cámara' : 'Ubicación'} y elige «Preguntar» o «Permitir». Luego vuelve aquí e inténtalo de nuevo.`
    : `Toca el ícono junto a la dirección de la página (arriba) → Permisos y permite ${what}. Luego inténtalo de nuevo.`;
}

export function MarkFlow({ kind, onClose, onSessionExpired }: MarkFlowProps) {
  const [step, setStep] = useState<Step>(() =>
    permissionsExplained() ? { kind: 'starting' } : { kind: 'explain' },
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fixRef = useRef<Promise<Fix> | null>(null);
  /** The fix may arrive before the camera opens: kept here so it is never lost. */
  const readyFixRef = useRef<Fix | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const release = useCallback(() => {
    abortRef.current?.abort();
    stopCamera(streamRef.current);
    streamRef.current = null;
  }, []);

  // Never leave the camera on when the flow closes.
  useEffect(() => release, [release]);

  const showProblem = useCallback(
    (problem: ProblemKind, body?: string) => {
      release();
      setStep({ kind: 'problem', problem, ...(body ? { body } : {}) });
    },
    [release],
  );

  const begin = useCallback(async () => {
    if (!navigator.onLine) {
      showProblem('offline');
      return;
    }
    setStep({ kind: 'starting' });
    const abort = new AbortController();
    abortRef.current = abort;

    readyFixRef.current = null;
    const fix = getBestFix({ signal: abort.signal });
    fixRef.current = fix;
    // A blocked or missing GPS is reported right away, not after the selfie.
    fix.then(
      (value) => {
        readyFixRef.current = value;
        setStep((current) => (current.kind === 'capture' ? { ...current, fix: value } : current));
      },
      (error: unknown) => {
        if (abort.signal.aborted) return;
        if (error instanceof LocationFailure && error.reason === 'permission-denied') {
          showProblem('permission-denied', permissionHelp('la ubicación'));
        } else {
          showProblem('gps-off');
        }
      },
    );

    try {
      const stream = await openFrontCamera();
      if (abort.signal.aborted) {
        stopCamera(stream);
        return;
      }
      streamRef.current = stream;
      setStep({ kind: 'capture', stream, fix: readyFixRef.current, busy: false });
    } catch (error) {
      if (error instanceof CameraFailure && error.reason === 'permission-denied') {
        showProblem('permission-denied', permissionHelp('la cámara'));
      } else {
        showProblem(
          'mark-failed',
          'No pudimos abrir la cámara frontal. Cierra otras aplicaciones que la estén usando e inténtalo de nuevo.',
        );
      }
    }
  }, [showProblem]);

  // First paint of "starting" (or coming back from the explanation) opens camera + GPS.
  useEffect(() => {
    if (step.kind === 'starting' && !streamRef.current && !abortRef.current) void begin();
  }, [step.kind, begin]);

  const send = useCallback(
    async (photo: string, fix: Fix) => {
      const body: MarkRequest = {
        kind,
        location: {
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracyM: fix.accuracyM,
          capturedAt: fix.capturedAt.toISOString(),
        },
        deviceTime: new Date().toISOString(),
        photo,
      };
      try {
        const record = await api<MarkResponse>('/attendance', { method: 'POST', body });
        release();
        setStep({ kind: 'done', record });
      } catch (error) {
        if (!(error instanceof ApiRequestError)) {
          showProblem('mark-failed');
        } else if (error.code === 'NETWORK_ERROR') {
          showProblem('offline');
        } else if (error.code === 'SESSION_REQUIRED') {
          release();
          onSessionExpired();
        } else if (error.code === 'RULE_VIOLATION' || error.code === 'VALIDATION_ERROR') {
          showProblem('mark-failed', error.message);
        } else {
          showProblem('mark-failed');
        }
      }
    },
    [kind, onSessionExpired, release, showProblem],
  );

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (step.kind !== 'capture' || step.busy || !video || !fixRef.current) return;
    setStep({ ...step, busy: true });
    let photo: string;
    try {
      photo = await captureFrame(video);
    } catch {
      showProblem('mark-failed', 'No pudimos tomar la foto. Inténtalo de nuevo.');
      return;
    }
    let fix: Fix;
    try {
      fix = await fixRef.current;
    } catch {
      return; // The GPS error screen is already showing.
    }
    if (fix.accuracyM > WEAK_ACCURACY_M) {
      release();
      setStep({ kind: 'weak', photo, fix });
      return;
    }
    await send(photo, fix);
  }, [release, send, showProblem, step]);

  const retry = useCallback(() => {
    release();
    abortRef.current = null;
    setStep({ kind: 'starting' });
  }, [release]);

  switch (step.kind) {
    case 'explain':
      return (
        <PermissionsScreen
          onRequest={() => {
            rememberExplained();
            setStep({ kind: 'starting' });
          }}
        />
      );
    case 'starting':
    case 'capture':
      return (
        <SelfieScreen
          kind={kind}
          videoRef={videoRef}
          stream={step.kind === 'capture' ? step.stream : null}
          busy={step.kind === 'starting' || step.busy}
          locationNote={
            step.kind === 'capture' && step.fix
              ? `Ubicación lista · ${formatAccuracy(step.fix.accuracyM)}`
              : 'Buscando tu ubicación…'
          }
          onCapture={() => void capture()}
          onCancel={() => {
            release();
            onClose(false);
          }}
        />
      );
    case 'weak':
      return (
        <ProblemScreen
          kind="weak-signal"
          body={`Tu ubicación tiene un margen de ${formatAccuracy(step.fix.accuracyM)}. Sal a un lugar abierto o acércate a una ventana y espera unos segundos.`}
          onPrimary={retry}
          onSecondary={() => {
            const { photo, fix } = step;
            setStep({ kind: 'sending' });
            void send(photo, fix);
          }}
        />
      );
    case 'sending':
      return <AppLoading label="Registrando tu marcación…" />;
    case 'done':
      return (
        <ConfirmationScreen
          kind={step.record.kind}
          serverTime={new Date(step.record.serverTime)}
          accuracyM={step.record.accuracyM}
          reviewPending={step.record.reviewStatus === 'pending'}
          onDone={() => {
            onClose(true);
          }}
        />
      );
    case 'problem':
      return (
        <ProblemScreen
          kind={step.problem}
          {...(step.body ? { body: step.body } : {})}
          onPrimary={retry}
          onSecondary={() => {
            onClose(false);
          }}
        />
      );
  }
}
