import { CheckCheck, Smartphone } from 'lucide-react';

import { Avatar } from '../../../components/ui/avatar.js';
import { Button } from '../../../components/ui/button.js';
import { formatTime } from '../../../lib/format.js';
import { EmptyState, PageHeader, SectionCard } from '../components/admin-ui.js';
import { type DeviceRequest, type Employee, initials } from '../model.js';

interface DevicesScreenProps {
  requests: DeviceRequest[];
  employees: Employee[];
  employeeById: Map<string, Employee>;
  onDecision: (id: string, decision: 'approved' | 'rejected') => void;
}

/** Each employee may mark only from one approved phone (CLAUDE.md §2B.4). */
export function DevicesScreen({
  requests,
  employees,
  employeeById,
  onDecision,
}: DevicesScreenProps) {
  const linked = employees.filter((e) => e.device);

  return (
    <>
      <PageHeader
        title="Celulares"
        subtitle="Cada empleado solo puede marcar desde un celular aprobado."
      />

      <SectionCard title="Solicitudes pendientes" className="mt-6">
        {requests.length === 0 ? (
          <EmptyState
            icon={<CheckCheck className="size-6" />}
            title="Sin solicitudes"
            body="Cuando un empleado intente marcar desde otro celular, aparecerá aquí."
          />
        ) : (
          <ul className="divide-y divide-line">
            {requests.map((r) => {
              const employee = employeeById.get(r.employeeId);
              const name = employee?.name ?? 'Empleado';
              return (
                <li key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <div className="flex flex-1 items-center gap-3">
                    <Avatar initials={initials(name)} />
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold">{name}</p>
                      <p className="text-[14px] text-ink-muted">
                        Quiere marcar desde{' '}
                        <span className="font-medium text-ink">{r.newModel}</span>
                      </p>
                      <p className="text-[13px] text-ink-muted">
                        {r.previousModel ? `Antes: ${r.previousModel}` : 'Primer celular'} ·
                        solicitado a las {formatTime(r.requestedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:w-64">
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
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={`Celulares vinculados (${String(linked.length)})`} className="mt-6">
        <ul className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
          {linked.map((e) => (
            <li key={e.id} className="flex items-center gap-3 border-b border-line py-3">
              <span
                className="grid size-10 place-items-center rounded-xl bg-surface text-ink-muted"
                aria-hidden="true"
              >
                <Smartphone className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium">{e.name}</span>
                <span className="block truncate text-[13px] text-ink-muted">
                  {e.device?.model} ·{' '}
                  {e.device?.platform === 'ios' ? 'iPhone (PWA)' : 'Android (app)'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}
