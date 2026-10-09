/**
 * "Marcaciones de hoy" — the first real admin page (Fase 3, decision D3).
 * Real records of one Bogotá day: who, entry/exit, server time, accuracy,
 * map link and the selfie (served by the API to admin sessions only,
 * decision 0004).
 */
import type { AdminAttendanceEntry, ReviewReason } from '@pj20/shared';
import { CameraOff, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { api, ApiRequestError } from '../../api/client.js';
import { Avatar } from '../../components/ui/avatar.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Sheet } from '../../components/ui/sheet.js';
import { Skeleton } from '../../components/ui/skeleton.js';
import { StatusBadge } from '../../components/ui/status-badge.js';
import { cn } from '../../lib/cn.js';
import { formatAccuracy, formatLongDate, formatTime, TIME_ZONE } from '../../lib/format.js';
import { AdminShell } from './admin-shell.js';
import { KindLabel } from './components/admin-ui.js';
import { initials } from './model.js';

const REFRESH_MS = 60_000;

const reasonLabels: Record<ReviewReason, string> = {
  low_accuracy: 'GPS impreciso',
  stale_location: 'Ubicación vieja',
};

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
  | { kind: 'ready'; entries: AdminAttendanceEntry[] }
  | { kind: 'failed'; message: string };

export function TodayPage() {
  return <AdminShell>{() => <TodayContent />}</AdminShell>;
}

function TodayContent() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const today = bogotaDate(new Date());
  const date = params.get('fecha') ?? today;
  const isToday = date === today;

  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [selfie, setSelfie] = useState<AdminAttendanceEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<AdminAttendanceEntry[]>(`/admin/attendance?date=${date}`).then(
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">
            {isToday ? 'Marcaciones de hoy' : 'Marcaciones'}
          </h1>
          <p className="mt-1 text-[15px] capitalize text-ink-muted">
            {formatLongDate(noonOf(date))}
          </p>
        </div>
        <div className="flex gap-1">
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
      />

      <Sheet
        open={selfie !== null}
        onOpenChange={(open) => {
          if (!open) setSelfie(null);
        }}
        variant="center"
        title={selfie ? `${selfie.employee.name} · ${formatTime(new Date(selfie.serverTime))}` : ''}
      >
        {selfie && (
          <img
            src={`/api/v1/admin/attendance/${selfie.id}/selfie`}
            alt={`Selfie de ${selfie.employee.name} al marcar`}
            className="w-full rounded-2xl bg-surface object-contain"
          />
        )}
      </Sheet>
    </>
  );
}

function DayContent({
  load,
  isToday,
  onRetry,
  onOpenSelfie,
}: {
  load: Load;
  isToday: boolean;
  onRetry: () => void;
  onOpenSelfie: (entry: AdminAttendanceEntry) => void;
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

  const checkIns = entries.filter((e) => e.kind === 'check_in').length;
  const pending = entries.filter((e) => e.reviewStatus === 'pending').length;
  return (
    <>
      <dl className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Entradas" value={checkIns} />
        <Stat label="Salidas" value={entries.length - checkIns} />
        <Stat label="Por revisar" value={pending} warn={pending > 0} />
      </dl>
      <ul className="mt-4 flex flex-col gap-3">
        {entries.map((entry) => (
          <li key={entry.id}>
            <EntryCard entry={entry} onOpenSelfie={onOpenSelfie} />
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

function EntryCard({
  entry,
  onOpenSelfie,
}: {
  entry: AdminAttendanceEntry;
  onOpenSelfie: (entry: AdminAttendanceEntry) => void;
}) {
  const time = new Date(entry.serverTime);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${String(entry.latitude)},${String(entry.longitude)}`;
  return (
    <Card className="flex gap-4 p-4">
      {entry.selfie === 'stored' ? (
        <button
          type="button"
          onClick={() => {
            onOpenSelfie(entry);
          }}
          className="size-20 shrink-0 overflow-hidden rounded-2xl bg-surface"
          aria-label={`Ver selfie de ${entry.employee.name}`}
        >
          <img
            src={`/api/v1/admin/attendance/${entry.id}/selfie`}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        </button>
      ) : (
        // No photo: not authorized by the employee (D7) or deleted by retention.
        <span
          className={cn(
            'grid size-20 shrink-0 place-items-center rounded-2xl px-1 text-center text-[11px] font-semibold leading-tight',
            entry.selfie === 'not-authorized'
              ? 'bg-warning-soft text-warning'
              : 'bg-surface text-ink-muted',
          )}
        >
          <span>
            <CameraOff className="mx-auto mb-1 size-5" aria-hidden="true" />
            {entry.selfie === 'not-authorized' ? 'Sin selfie' : 'Foto eliminada'}
          </span>
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar initials={initials(entry.employee.name)} size="sm" />
            <p className="truncate text-[15px] font-semibold">{entry.employee.name}</p>
          </div>
          <time
            dateTime={entry.serverTime}
            className="shrink-0 text-[15px] font-semibold tabular-nums"
          >
            {formatTime(time)}
          </time>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
          <KindLabel kind={entry.kind} />
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-info hover:underline"
          >
            <MapPin className="size-4" aria-hidden="true" />
            Mapa · {formatAccuracy(entry.accuracyM)}
          </a>
        </div>
        {entry.selfie === 'not-authorized' && (
          <p className="mt-2 text-[13px] text-ink-muted">
            No autorizó la selfie (es opcional por ley): verifícala por otro medio si hace falta.
          </p>
        )}
        {entry.selfie === 'expired' && (
          <p className="mt-2 text-[13px] text-ink-muted">
            La selfie se borró por la política de conservación (90 días).
          </p>
        )}
        {entry.reviewStatus === 'pending' && (
          <StatusBadge tone="warning" className="mt-2">
            Por revisar: {entry.reviewReasons.map((r) => reasonLabels[r]).join(' · ')}
          </StatusBadge>
        )}
      </div>
    </Card>
  );
}
