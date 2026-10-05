import { CheckCheck, ShieldX } from 'lucide-react';

import { Avatar } from '../../../components/ui/avatar.js';
import { Button } from '../../../components/ui/button.js';
import { StatusBadge } from '../../../components/ui/status-badge.js';
import { formatTime } from '../../../lib/format.js';
import { MapPreview, SelfiePreview } from '../components/evidence.js';
import { EmptyState, KindLabel, PageHeader, SectionCard } from '../components/admin-ui.js';
import {
  type AttendanceRecord,
  type BlockedAttempt,
  type Employee,
  type Signal,
  initials,
  signalLabels,
} from '../model.js';

/** Plain-Spanish explanation of each signal, so the admin can decide quickly. */
const signalExplanations: Record<Signal, string> = {
  'weak-accuracy': 'El GPS tenía un margen de error muy alto. Puede ser un edificio o mala señal.',
  'suspicious-coordinates':
    'Las coordenadas son idénticas en varias marcaciones y con precisión perfecta: típico de ubicaciones falsas.',
  'impossible-speed':
    'Esta marcación queda muy lejos de la anterior en muy poco tiempo. Nadie puede desplazarse tan rápido.',
  'ip-mismatch': 'La conexión a internet proviene de una ciudad distinta a la del GPS.',
};

interface ReviewScreenProps {
  pending: AttendanceRecord[];
  blocked: BlockedAttempt[];
  employeeById: Map<string, Employee>;
  onDecision: (id: string, decision: 'approved' | 'rejected') => void;
}

export function ReviewScreen({ pending, blocked, employeeById, onDecision }: ReviewScreenProps) {
  const name = (id: string) => employeeById.get(id)?.name ?? 'Empleado';

  return (
    <>
      <PageHeader
        title="Por revisar"
        subtitle="Marcaciones aceptadas con señales de alerta. Tú decides si son válidas."
      />

      {pending.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-surface-raised ring-1 ring-line">
          <EmptyState
            icon={<CheckCheck className="size-6" />}
            title="Todo al día"
            body="No hay marcaciones pendientes de revisión."
          />
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 xl:grid-cols-2">
          {pending.map((r) => (
            <li key={r.id} className="rounded-3xl bg-surface-raised p-5 ring-1 ring-line">
              <div className="flex items-center gap-3">
                <Avatar initials={initials(name(r.employeeId))} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold">{name(r.employeeId)}</p>
                  <p className="flex items-center gap-2 text-[14px] text-ink-muted">
                    <KindLabel kind={r.kind} /> · {formatTime(r.serverTime)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <SelfiePreview
                  initials={initials(name(r.employeeId))}
                  className="aspect-auto h-52"
                />
                <MapPreview {...r.location} className="aspect-auto h-52" />
              </div>

              <ul className="mt-4 flex flex-col gap-3">
                {r.signals.map((s) => (
                  <li key={s}>
                    <StatusBadge tone="warning">{signalLabels[s]}</StatusBadge>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">
                      {signalExplanations[s]}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Button
                  variant="danger"
                  onClick={() => {
                    onDecision(r.id, 'rejected');
                  }}
                >
                  Rechazar
                </Button>
                <Button
                  onClick={() => {
                    onDecision(r.id, 'approved');
                  }}
                >
                  Aprobar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {blocked.length > 0 && (
        <SectionCard title="Intentos bloqueados hoy" className="mt-6">
          <p className="text-[14px] text-ink-muted">
            La aplicación impidió estas marcaciones. No crean registro de asistencia.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-3">
                <span
                  className="grid size-10 place-items-center rounded-xl bg-danger-soft text-danger"
                  aria-hidden="true"
                >
                  <ShieldX className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">{name(b.employeeId)}</p>
                  <p className="text-[13px] text-ink-muted">
                    {b.reason} · {b.device}
                  </p>
                </div>
                <span className="text-[14px] text-ink-muted tabular-nums">{formatTime(b.at)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  );
}
