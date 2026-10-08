/**
 * Signed-in employee (real app): Marcar with the real shift status, and the
 * marking flow on top of it. The status always comes from the server.
 */
import type { AttendanceStatus, Me } from '@pj20/shared';
import { useCallback, useEffect, useState } from 'react';

import { api, ApiRequestError } from '../../api/client.js';
import { AppLoading } from '../../components/brand/app-loading.js';
import { MarkFlow } from './mark-flow.js';
import { type EmployeeView, nextAction } from './model.js';
import { ClockScreen } from './screens/clock-screen.js';
import { ProblemScreen } from './screens/problem-screen.js';

interface EmployeeHomeProps {
  me: Me;
  onLogout: () => void;
  onSessionExpired: () => void;
  /** Only for administrators. */
  onOpenAdmin?: () => void;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; status: AttendanceStatus }
  | { kind: 'offline' }
  | { kind: 'failed' };

function toView(me: Me, status: AttendanceStatus): EmployeeView {
  return {
    firstName: me.name.split(/\s+/)[0] ?? me.name,
    shift: status.onDutySince
      ? { kind: 'on', since: new Date(status.onDutySince) }
      : { kind: 'off' },
    lastRecord: status.lastRecord
      ? { kind: status.lastRecord.kind, at: new Date(status.lastRecord.at) }
      : null,
    location: { state: 'on-mark' },
  };
}

export function EmployeeHome({ me, onLogout, onSessionExpired, onOpenAdmin }: EmployeeHomeProps) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [marking, setMarking] = useState(false);
  // Incrementing re-reads the status (on start, after marking, on retry).
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => {
    setRefresh((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<AttendanceStatus>('/attendance/status').then(
      (status) => {
        if (!cancelled) setLoad({ kind: 'ready', status });
      },
      (error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiRequestError && error.code === 'SESSION_REQUIRED') {
          onSessionExpired();
        } else if (error instanceof ApiRequestError && error.code === 'NETWORK_ERROR') {
          setLoad({ kind: 'offline' });
        } else {
          setLoad({ kind: 'failed' });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refresh, onSessionExpired]);

  if (load.kind === 'loading') return <AppLoading />;
  if (load.kind === 'offline') return <ProblemScreen kind="offline" onPrimary={reload} />;
  if (load.kind === 'failed') {
    return (
      <ProblemScreen
        kind="mark-failed"
        body="No pudimos consultar tu estado. Inténtalo de nuevo en un momento."
        onPrimary={reload}
      />
    );
  }

  const view = toView(me, load.status);
  if (marking) {
    return (
      <MarkFlow
        kind={nextAction(view.shift)}
        onSessionExpired={onSessionExpired}
        onClose={(marked) => {
          setMarking(false);
          if (marked) reload();
        }}
      />
    );
  }
  return (
    <ClockScreen
      view={view}
      onMark={() => {
        setMarking(true);
      }}
      onLogout={onLogout}
      {...(onOpenAdmin ? { onOpenAdmin } : {})}
    />
  );
}
