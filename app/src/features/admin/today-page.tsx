/**
 * "Marcaciones" — one Bogotá day of the timeline (Fase 3, D3; Fase 6): who,
 * entry/exit, server time, accuracy, map link and the selfie (served by the
 * API to admin sessions only, decision 0004), plus the administrator's
 * corrections and verdicts, and the actions to make them.
 */
import type { AdminAttendanceEntry, AdminTimelineEntry } from '@pj20/shared';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { api, ApiRequestError } from '../../api/client.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Skeleton } from '../../components/ui/skeleton.js';
import { formatLongDate, TIME_ZONE } from '../../lib/format.js';
import { AdminShell, type ShellTools } from './admin-shell.js';
import {
  AddCorrectionDialog,
  ApproveButton,
  RejectDialog,
  VoidDialog,
} from './timeline-dialogs.js';
import { awaitsReview, entryInstant, SelfieSheet, TimelineEntryCard } from './timeline-entry.js';

const REFRESH_MS = 60_000;

/** Calendar date (YYYY-MM-DD) in Bogotá for an instant. */
function bogotaDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date);
}

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

/** Noon of that day in Bogotá: safe instant for formatting the date label. */
const noonOf = (date: string) => new Date(`${date}T12:00:00-05:00`);

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; entries: AdminTimelineEntry[] }
  | { kind: 'failed'; message: string };

export function TodayPage() {
  return <AdminShell>{(_me, tools) => <TodayContent tools={tools} />}</AdminShell>;
}

/**
 * The other half of the same shift in this day's list: the exit after an
 * entry, or the entry before an exit, of the same person and still in force.
 */
function partnerOf(
  entry: AdminTimelineEntry,
  entries: AdminTimelineEntry[],
): AdminTimelineEntry | null {
  const mine = entries
    .filter((e) => e.employee.id === entry.employee.id && e.voided === null)
    .sort((a, b) => entryInstant(a).getTime() - entryInstant(b).getTime());
  const index = mine.findIndex((e) => e.id === entry.id);
  const candidate = entry.kind === 'check_in' ? mine[index + 1] : mine[index - 1];
  return candidate && candidate.kind !== entry.kind ? candidate : null;
}

function TodayContent({ tools }: { tools: ShellTools }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const today = bogotaDate(new Date());
  const date = params.get('fecha') ?? today;
  const isToday = date === today;

  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [selfie, setSelfie] = useState<AdminAttendanceEntry | null>(null);
  const [rejecting, setRejecting] = useState<AdminAttendanceEntry | null>(null);
  const [voiding, setVoiding] = useState<AdminTimelineEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const entries = load.kind === 'ready' ? load.entries : [];
  // Re-reads the day and the tab counters; each dialog closes only itself.
  const changed = useCallback(() => {
    setRefresh((n) => n + 1);
    tools.refreshCounts();
  }, [tools]);

  useEffect(() => {
    let cancelled = false;
    api<AdminTimelineEntry[]>(`/admin/attendance?date=${date}`).then(
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
              : 'No pudimos cargar las marcaciones.',
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [date, refresh, navigate]);

  // Today's list keeps itself current while the page is open.
  useEffect(() => {
    if (!isToday) return;
    const timer = setInterval(() => {
      setRefresh((n) => n + 1);
    }, REFRESH_MS);
    return () => {
      clearInterval(timer);
    };
  }, [isToday]);

  const goTo = useCallback(
    (next: string) => {
      setLoad({ kind: 'loading' });
      setParams(next === today ? {} : { fecha: next });
    },
    [setParams, today],
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">
            {isToday ? 'Marcaciones de hoy' : 'Marcaciones'}
          </h1>
          <p className="mt-1 text-[15px] text-ink-muted">{formatLongDate(noonOf(date))}</p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="secondary"
            aria-label="Agregar marcación olvidada"
            icon={<Plus className="size-5" aria-hidden="true" />}
            onClick={() => {
              setAdding(true);
            }}
          >
            <span className="hidden sm:inline" aria-hidden="true">
              Agregar marcación olvidada
            </span>
            <span className="sm:hidden" aria-hidden="true">
              Agregar
            </span>
          </Button>
          <Button
            variant="secondary"
            className="w-11 px-0"
            aria-label="Día anterior"
            icon={<ChevronLeft className="size-5" aria-hidden="true" />}
            onClick={() => {
              goTo(shiftDate(date, -1));
            }}
          />
          <Button
            variant="secondary"
            className="w-11 px-0"
            aria-label="Día siguiente"
            disabled={isToday}
            icon={<ChevronRight className="size-5" aria-hidden="true" />}
            onClick={() => {
              goTo(shiftDate(date, 1));
            }}
          />
        </div>
      </div>

      <DayContent
        load={load}
        isToday={isToday}
        onRetry={() => {
          setLoad({ kind: 'loading' });
          setRefresh((n) => n + 1);
        }}
        onOpenSelfie={setSelfie}
        actionsFor={(entry) => (
          <>
            {awaitsReview(entry) && (
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
              </>
            )}
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
        )}
      />

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
          partner={partnerOf(voiding, entries)}
          onClose={() => {
            setVoiding(null);
          }}
          onDone={() => {
            setVoiding(null);
            changed();
          }}
        />
      )}
      {adding && (
        <AddCorrectionDialog
          defaultDate={date}
          onClose={() => {
            setAdding(false);
          }}
          onDone={() => {
            setAdding(false);
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

function DayContent({
  load,
  isToday,
  onRetry,
  onOpenSelfie,
  actionsFor,
}: {
  load: Load;
  isToday: boolean;
  onRetry: () => void;
  onOpenSelfie: (entry: AdminAttendanceEntry) => void;
  actionsFor: (entry: AdminTimelineEntry) => ReactNode;
}) {
  if (load.kind === 'loading') {
    return (
      <div className="mt-6 flex flex-col gap-3" role="status" aria-label="Cargando marcaciones">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-3xl" />
        ))}
      </div>
    );
  }
  if (load.kind === 'failed') {
    return (
      <Card className="mt-6 flex flex-col items-center gap-4 text-center" role="alert">
        <p className="text-[15px]">{load.message}</p>
        <Button variant="secondary" onClick={onRetry}>
          Intentar de nuevo
        </Button>
      </Card>
    );
  }
  const { entries } = load;
  if (entries.length === 0) {
    return (
      <Card className="mt-6 text-center">
        <p className="text-[16px] font-semibold">
          {isToday ? 'Aún no hay marcaciones hoy' : 'No hubo marcaciones este día'}
        </p>
        <p className="mt-1 text-[14px] text-ink-muted">
          {isToday ? 'Aparecerán aquí apenas alguien marque.' : 'Prueba con otro día.'}
        </p>
      </Card>
    );
  }

  const inForce = entries.filter((e) => e.voided === null);
  const checkIns = inForce.filter((e) => e.kind === 'check_in').length;
  const pending = entries.filter(awaitsReview).length;
  return (
    <>
      <dl className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Entradas" value={checkIns} />
        <Stat label="Salidas" value={inForce.length - checkIns} />
        <Stat label="Por revisar" value={pending} warn={pending > 0} />
      </dl>
      <ul className="mt-4 flex flex-col gap-3">
        {entries.map((entry) => (
          <li key={entry.id}>
            <TimelineEntryCard
              entry={entry}
              onOpenSelfie={onOpenSelfie}
              actions={actionsFor(entry)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <Card className="p-4">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className={`mt-1 text-[24px] font-semibold tabular-nums ${warn ? 'text-warning' : ''}`}>
        {value}
      </dd>
    </Card>
  );
}
