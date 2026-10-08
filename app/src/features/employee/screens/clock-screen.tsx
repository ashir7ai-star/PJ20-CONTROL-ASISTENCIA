import { Camera, Clock, LayoutDashboard, LocateFixed, MapPin } from 'lucide-react';

import { Button } from '../../../components/ui/button.js';
import { ThemeMenu } from '../../../components/ui/theme-menu.js';
import {
  formatAccuracy,
  formatClock,
  formatDuration,
  formatLongDate,
  formatTime,
} from '../../../lib/format.js';
import { useNow } from '../../../lib/use-now.js';
import { EmployeeLayout } from '../components/employee-layout.js';
import { PulseButton } from '../components/pulse-button.js';
import { type EmployeeView, attendanceLabels, nextAction } from '../model.js';

interface ClockScreenProps {
  view: EmployeeView;
  /** Fixed time for prototypes/tests; live clock otherwise. */
  now?: Date;
  onMark?: () => void;
  /** Only for administrators: return to the admin panel. */
  onOpenAdmin?: () => void;
  /** Real app: shows "Cerrar sesión" in the account menu. */
  onLogout?: () => void;
}

/** Main employee screen ("Marcar"): live clock, shift status and the Pulso button. */
export function ClockScreen({
  view,
  now: fixedNow,
  onMark,
  onOpenAdmin,
  onLogout,
}: ClockScreenProps) {
  const now = useNow('minute', fixedNow);
  const clock = formatClock(now);
  const action = nextAction(view.shift);
  const searching = view.location.state === 'searching';

  return (
    <EmployeeLayout topRight={<ThemeMenu {...(onLogout ? { onLogout } : {})} />}>
      <section className="mt-10 flex flex-col items-center text-center" aria-label="Hora actual">
        <p className="text-[15px] text-ink-muted">
          Hola, {view.firstName} · {formatLongDate(now)}
        </p>
        <p className="mt-1 text-[76px] font-light leading-none tracking-tight tabular-nums">
          <time dateTime={now.toISOString()}>
            {clock.time}
            <span className="ml-2 text-2xl font-normal text-ink-muted">{clock.period}</span>
          </time>
        </p>
        <ShiftLine view={view} now={now} />
      </section>

      <div className="mt-12 flex justify-center">
        <PulseButton
          kind={action}
          disabled={searching}
          {...(onMark ? { onPress: onMark } : {})}
          {...(view.shift.kind === 'on' ? { since: view.shift.since } : {})}
          {...(fixedNow ? { reference: fixedNow } : {})}
        />
      </div>
      {searching && (
        <p className="mt-4 text-center text-[14px] text-ink-muted" role="status">
          Buscando tu ubicación…
        </p>
      )}

      <footer className="mt-auto pt-10">
        {view.lastRecord && (
          <p className="mb-4 flex items-center justify-center gap-1.5 text-[13px] text-ink-muted">
            <Clock className="size-4" aria-hidden="true" />
            Última marcación: {attendanceLabels[view.lastRecord.kind].noun} ·{' '}
            {formatTime(view.lastRecord.at)}
          </p>
        )}
        <ul className="flex justify-center gap-6 text-[13px] text-ink-muted">
          <li className="inline-flex items-center gap-1.5">
            <LocationIcon state={view.location.state} />
            <LocationLabel view={view} />
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Camera className="size-4" aria-hidden="true" />
            Selfie al marcar
          </li>
        </ul>
        {onOpenAdmin && (
          <Button
            variant="secondary"
            block
            className="mt-6"
            icon={<LayoutDashboard className="size-5" aria-hidden="true" />}
            onClick={onOpenAdmin}
          >
            Ir al panel de administración
          </Button>
        )}
      </footer>
    </EmployeeLayout>
  );
}

function ShiftLine({ view, now }: { view: EmployeeView; now: Date }) {
  if (view.shift.kind === 'on') {
    const minutes = (now.getTime() - view.shift.since.getTime()) / 60_000;
    return (
      <p className="mt-4 inline-flex items-center gap-2 text-[14px] font-medium text-success">
        <span className="size-2 rounded-full bg-success" aria-hidden="true" />
        En turno desde {formatTime(view.shift.since)}
        {/* The live counter in the button is visual only; screen readers get minutes here. */}
        <span className="sr-only"> · llevas {formatDuration(minutes)} trabajando</span>
      </p>
    );
  }
  return (
    <p className="mt-4 inline-flex items-center gap-2 text-[14px] font-medium text-ink-muted">
      <span className="size-2 rounded-full bg-ink-muted" aria-hidden="true" />
      Fuera de turno
    </p>
  );
}

function LocationIcon({ state }: { state: EmployeeView['location']['state'] }) {
  if (state === 'searching') {
    return <LocateFixed className="size-4 animate-pulse" aria-hidden="true" />;
  }
  return (
    <MapPin className={state === 'weak' ? 'size-4 text-warning' : 'size-4'} aria-hidden="true" />
  );
}

function LocationLabel({ view }: { view: EmployeeView }) {
  const { location } = view;
  if (location.state === 'searching') return <>Buscando GPS…</>;
  if (location.state === 'weak') {
    return <span className="text-warning">Señal débil {formatAccuracy(location.accuracyM)}</span>;
  }
  return <>Ubicación {formatAccuracy(location.accuracyM)}</>;
}
