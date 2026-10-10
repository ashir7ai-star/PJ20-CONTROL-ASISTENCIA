/**
 * "Por revisar" (Fase 6): every flagged record without a verdict, oldest
 * first, across days. Approve in one tap; reject or void with a reason.
 */
import type { AdminAttendanceEntry } from '@pj20/shared';
import { CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { api, ApiRequestError } from '../../api/client.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Skeleton } from '../../components/ui/skeleton.js';
import { AdminShell, type ShellTools } from './admin-shell.js';
import { ApproveButton, RejectDialog, VoidDialog } from './timeline-dialogs.js';
import { SelfieSheet, TimelineEntryCard } from './timeline-entry.js';

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; entries: AdminAttendanceEntry[] }
  | { kind: 'failed'; message: string };

export function ReviewPage() {
  return <AdminShell>{(_me, tools) => <ReviewContent tools={tools} />}</AdminShell>;
}

function ReviewContent({ tools }: { tools: ShellTools }) {
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [selfie, setSelfie] = useState<AdminAttendanceEntry | null>(null);
  const [rejecting, setRejecting] = useState<AdminAttendanceEntry | null>(null);
  const [voiding, setVoiding] = useState<AdminAttendanceEntry | null>(null);

  const changed = useCallback(() => {
    setRefresh((n) => n + 1);
    tools.refreshCounts();
  }, [tools]);

  useEffect(() => {
    let cancelled = false;
    api<AdminAttendanceEntry[]>('/admin/review').then(
      (entries) => {
        if (!cancelled) setLoad({ kind: 'ready', entries });
      },
      (error: unknown) => {
        if (cancelled) return;
        if (
          error instanceof ApiRequestError &&
          (error.code === 'SESSION_REQUIRED' || error.code === 'FORBIDDEN')
        ) {
          void navigate('/', { replace: true });
          return;
        }
        setLoad({
          kind: 'failed',
          message:
            error instanceof ApiRequestError && error.code === 'NETWORK_ERROR'
              ? 'Sin conexión. Revisa tu internet.'
              : 'No pudimos cargar las marcaciones por revisar.',
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refresh, navigate]);

  return (
    <>
      <h1 className="text-[26px] font-semibold tracking-tight">Por revisar</h1>
      <p className="mt-1 text-[15px] text-ink-muted">
        Marcaciones con señales dudosas. Apruébalas o recházalas con el motivo.
      </p>

      {load.kind === 'loading' && (
        <div className="mt-6 flex flex-col gap-3" role="status" aria-label="Cargando">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-3xl" />
          ))}
        </div>
      )}
      {load.kind === 'failed' && (
        <Card className="mt-6 flex flex-col items-center gap-4 text-center" role="alert">
          <p className="text-[15px]">{load.message}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setLoad({ kind: 'loading' });
              setRefresh((n) => n + 1);
            }}
          >
            Intentar de nuevo
          </Button>
        </Card>
      )}
      {load.kind === 'ready' && load.entries.length === 0 && (
        <Card className="mt-6 flex flex-col items-center text-center">
          <CheckCheck className="size-8 text-success" aria-hidden="true" />
          <p className="mt-3 text-[16px] font-semibold">Todo al día</p>
          <p className="mt-1 text-[14px] text-ink-muted">No hay marcaciones esperando revisión.</p>
        </Card>
      )}
      {load.kind === 'ready' && load.entries.length > 0 && (
        <ul className="mt-6 flex flex-col gap-3">
          {load.entries.map((entry) => (
            <li key={entry.id}>
              <TimelineEntryCard
                entry={entry}
                withDate
                onOpenSelfie={setSelfie}
                actions={
                  <>
                    <ApproveButton entry={entry} onDone={changed} />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setRejecting(entry);
                      }}
                    >
                      Rechazar
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-danger"
                      onClick={() => {
                        setVoiding(entry);
                      }}
                    >
                      Anular
                    </Button>
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}

      {rejecting && (
        <RejectDialog
          key={rejecting.id}
          entry={rejecting}
          onClose={() => {
            setRejecting(null);
          }}
          onDone={() => {
            setRejecting(null);
            changed();
          }}
        />
      )}
      {voiding && (
        <VoidDialog
          key={voiding.id}
          entry={voiding}
          partner={null}
          onClose={() => {
            setVoiding(null);
          }}
          onDone={() => {
            setVoiding(null);
            changed();
          }}
        />
      )}
      <SelfieSheet
        entry={selfie}
        onClose={() => {
          setSelfie(null);
        }}
      />
    </>
  );
}
