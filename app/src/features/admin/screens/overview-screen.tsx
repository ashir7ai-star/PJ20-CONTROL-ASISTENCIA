import { ChevronRight, ShieldAlert, ShieldX, Smartphone } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Avatar } from '../../../components/ui/avatar.js';
import { StatusBadge } from '../../../components/ui/status-badge.js';
import { cn } from '../../../lib/cn.js';
import { formatLongDate, formatTime } from '../../../lib/format.js';
import { KindLabel, PageHeader, SectionCard } from '../components/admin-ui.js';
import {
  type AttendanceRecord,
  type BlockedAttempt,
  type DeviceRequest,
  type Employee,
  initials,
} from '../model.js';
import { summarizeDay } from '../stats.js';

interface OverviewScreenProps {
  employees: Employee[];
  employeeById: Map<string, Employee>;
  records: AttendanceRecord[];
  blocked: BlockedAttempt[];
  deviceRequests: DeviceRequest[];
  now: Date;
  links: { records: string; review: string; devices: string };
}

/** Live overview: who is working, who has not marked, and what needs attention. */
export function OverviewScreen({
  employees,
  employeeById,
  records,
  blocked,
  deviceRequests,
  now,
  links,
}: OverviewScreenProps) {
  const summary = summarizeDay(employees, records);
  const name = (id: string) => employeeById.get(id)?.name ?? 'Empleado';

  return (
    <>
      <PageHeader
        title="Resumen"
        subtitle={`${formatLongDate(now)} · actualizado a las ${formatTime(now)}`}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat
          label="Trabajando ahora"
          value={summary.working.length}
          total={summary.activeEmployees}
          tone="success"
        />
        <Stat label="Llegaron hoy" value={summary.arrived.length} total={summary.activeEmployees} />
        <Stat label="Sin marcar" value={summary.missing.length} tone="warning" />
        <Stat
          label="Por revisar"
          value={summary.pendingReview.length}
          tone={summary.pendingReview.length > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px] lg:gap-6">
        <SectionCard
          title="Actividad de hoy"
          action={
            <Link to={links.records} className="text-[14px] font-medium text-link hover:underline">
              Ver todas
            </Link>
          }
        >
          <ul className="-mx-2 divide-y divide-line">
            {records.slice(0, 8).map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-2 py-3">
                <Avatar initials={initials(name(r.employeeId))} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{name(r.employeeId)}</p>
                  <p className="truncate text-[13px] text-ink-muted">{r.location.place}</p>
                </div>
                {r.review === 'pending' && (
                  <StatusBadge tone="warning" className="hidden sm:inline-flex">
                    Por revisar
                  </StatusBadge>
                )}
                <div className="text-right text-[14px]">
                  <KindLabel kind={r.kind} />
                  <p className="text-[13px] text-ink-muted tabular-nums">
                    {formatTime(r.serverTime)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="flex flex-col gap-4 lg:gap-6">
          <SectionCard title="Requiere tu atención">
            <ul className="flex flex-col gap-2">
              {blocked.map((b) => (
                <Alert
                  key={b.id}
                  tone="danger"
                  icon={<ShieldX className="size-5" />}
                  title={`Ubicación falsa bloqueada · ${name(b.employeeId)}`}
                  detail={`${formatTime(b.at)} · ${b.device}`}
                />
              ))}
              {summary.pendingReview.length > 0 && (
                <Alert
                  tone="warning"
                  icon={<ShieldAlert className="size-5" />}
                  title={`${String(summary.pendingReview.length)} marcaciones por revisar`}
                  detail="Señales de posible fraude o baja precisión"
                  to={links.review}
                />
              )}
              {deviceRequests.length > 0 && (
                <Alert
                  tone="info"
                  icon={<Smartphone className="size-5" />}
                  title={`${String(deviceRequests.length)} solicitudes de celular nuevo`}
                  detail="Esperan tu aprobación"
                  to={links.devices}
                />
              )}
            </ul>
          </SectionCard>

          <SectionCard title={`Sin marcar hoy (${String(summary.missing.length)})`}>
            <ul className="flex flex-wrap gap-2">
              {summary.missing.map((e) => (
                <li
                  key={e.id}
                  className="inline-flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-[13px] font-medium ring-1 ring-line"
                >
                  <Avatar initials={initials(e.name)} size="sm" className="size-6 text-[10px]" />
                  {e.name}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  );
}

const statTone = {
  neutral: 'text-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
} as const;

function Stat({
  label,
  value,
  total,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  total?: number;
  tone?: keyof typeof statTone;
}) {
  return (
    <div className="rounded-3xl bg-surface-raised p-5 ring-1 ring-line">
      <p className="text-[14px] font-medium text-ink-muted">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span
          className={cn(
            'text-[36px] font-semibold leading-none tracking-tight tabular-nums',
            statTone[tone],
          )}
        >
          {value}
        </span>
        {total !== undefined && (
          <span className="text-[16px] text-ink-muted tabular-nums">/ {total}</span>
        )}
      </p>
    </div>
  );
}

const alertTone = {
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
} as const;

function Alert({
  tone,
  icon,
  title,
  detail,
  to,
}: {
  tone: keyof typeof alertTone;
  icon: ReactNode;
  title: string;
  detail: string;
  to?: string;
}) {
  const body = (
    <>
      <span
        className={cn('grid size-10 shrink-0 place-items-center rounded-xl', alertTone[tone])}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{title}</span>
        <span className="block text-[13px] text-ink-muted">{detail}</span>
      </span>
      {to && <ChevronRight className="size-4 text-ink-muted" aria-hidden="true" />}
    </>
  );
  return (
    <li>
      {to ? (
        <Link
          to={to}
          className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-surface"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl p-2">{body}</div>
      )}
    </li>
  );
}
