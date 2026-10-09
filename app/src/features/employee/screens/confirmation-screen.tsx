import { Camera, Check, Clock, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '../../../components/ui/button.js';
import { Card } from '../../../components/ui/card.js';
import { formatAccuracy, formatClock, formatLongDate } from '../../../lib/format.js';
import { type AttendanceKind, attendanceLabels } from '../model.js';
import { EmployeeLayout } from '../components/employee-layout.js';

interface ConfirmationScreenProps {
  kind: AttendanceKind;
  /** Time assigned by the server. */
  serverTime: Date;
  accuracyM: number;
  /** Accepted but flagged (weak GPS, old fix): the employee is told openly. */
  reviewPending?: boolean;
  /** false: marked without selfie (not authorized, D7). */
  withSelfie?: boolean;
  onDone?: () => void;
}

/** Proof that the record was saved: the employee never has to wonder "¿sí quedó?". */
export function ConfirmationScreen({
  kind,
  serverTime,
  accuracyM,
  reviewPending = false,
  withSelfie = true,
  onDone,
}: ConfirmationScreenProps) {
  const clock = formatClock(serverTime);
  return (
    <EmployeeLayout>
      <section className="mt-12 flex flex-col items-center text-center" role="status">
        <span className="grid size-20 place-items-center rounded-full bg-success-soft">
          <Check className="size-10 text-success" strokeWidth={2.5} aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-[28px] font-semibold tracking-tight">
          {attendanceLabels[kind].done}
        </h1>
        <p className="mt-2 text-[56px] font-light leading-none tracking-tight tabular-nums">
          {clock.time}
          <span className="ml-2 text-xl font-normal text-ink-muted">{clock.period}</span>
        </p>
        <p className="mt-2 text-[15px] text-ink-muted">{formatLongDate(serverTime)}</p>
      </section>

      <Card className="mt-10 p-0">
        <ul className="divide-y divide-line">
          <Detail
            icon={<Clock className="size-5" />}
            label="Hora"
            value="Registrada por el servidor"
          />
          <Detail
            icon={<MapPin className="size-5" />}
            label="Ubicación"
            value={formatAccuracy(accuracyM)}
          />
          <Detail
            icon={<Camera className="size-5" />}
            label="Selfie"
            value={withSelfie ? 'Guardada' : 'No autorizada'}
          />
        </ul>
      </Card>
      {reviewPending && (
        <p className="mt-4 rounded-2xl bg-warning-soft px-4 py-3 text-center text-[14px] font-medium text-warning">
          Quedó registrada. Como la señal de GPS era débil, tu administrador la revisará.
        </p>
      )}

      <div className="mt-auto pt-10">
        <Button size="lg" block onClick={onDone}>
          Listo
        </Button>
      </div>
    </EmployeeLayout>
  );
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <li className="flex items-center gap-3 px-5 py-4 text-[15px]">
      <span className="text-info" aria-hidden="true">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <span className="text-[14px] text-ink-muted">{value}</span>
    </li>
  );
}
