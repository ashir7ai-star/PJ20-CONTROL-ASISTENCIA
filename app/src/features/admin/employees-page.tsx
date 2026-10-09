/**
 * Real employee management (decision D4): the approved Empleados screen on
 * live data. Every change goes to the server, which applies the same shared
 * rules (last admin, self-demotion, history) with row locks and audits it.
 */
import type { AccessRequestDto, EmployeeDto, Me, UserAction } from '@pj20/shared';
import { useCallback, useEffect, useState } from 'react';

import { api, ApiRequestError } from '../../api/client.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Skeleton } from '../../components/ui/skeleton.js';
import { AccessRequestsSection } from './access-requests-section.js';
import { AdminShell, type ShellTools } from './admin-shell.js';
import type { Employee, Role } from './model.js';
import { EmployeesScreen } from './screens/employees-screen.js';

export function EmployeesPage() {
  return <AdminShell>{(me, tools) => <EmployeesContent me={me} tools={tools} />}</AdminShell>;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; rows: EmployeeDto[]; requests: AccessRequestDto[] }
  | { kind: 'failed'; message: string };

/** Devices are linked in Fase 4; until then nobody has one. */
const toEmployee = (row: EmployeeDto): Employee => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  active: row.active,
  device: null,
});

/** One API call per panel action. */
function applyOnServer(id: string, action: UserAction): Promise<unknown> {
  const path = `/admin/employees/${id}`;
  switch (action) {
    case 'make-admin':
      return api(path, { method: 'PATCH', body: { role: 'admin' } });
    case 'remove-admin':
      return api(path, { method: 'PATCH', body: { role: 'employee' } });
    case 'deactivate':
      return api(path, { method: 'PATCH', body: { active: false } });
    case 'reactivate':
      return api(path, { method: 'PATCH', body: { active: true } });
    case 'delete':
      return api(path, { method: 'DELETE' });
  }
}

/** The server's Spanish reason (duplicate e-mail, last admin…) or a clear fallback. */
function reason(error: unknown): Error {
  if (error instanceof ApiRequestError) {
    return new Error(
      error.code === 'NETWORK_ERROR' ? 'Sin conexión. Revisa tu internet.' : error.message,
    );
  }
  return new Error('No se pudo guardar. Inténtalo de nuevo.');
}

function EmployeesContent({ me, tools }: { me: Me; tools: ShellTools }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<EmployeeDto[]>('/admin/employees'),
      api<AccessRequestDto[]>('/admin/access-requests'),
    ]).then(
      ([rows, requests]) => {
        if (!cancelled) setLoad({ kind: 'ready', rows, requests });
      },
      (error: unknown) => {
        if (!cancelled) setLoad({ kind: 'failed', message: reason(error).message });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const reload = useCallback(() => {
    setRefresh((n) => n + 1);
  }, []);

  if (load.kind === 'loading') {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Cargando empleados">
        <Skeleton className="h-10 w-48" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (load.kind === 'failed') {
    return (
      <Card className="flex flex-col items-center gap-4 text-center" role="alert">
        <p className="text-[15px]">{load.message}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setLoad({ kind: 'loading' });
            reload();
          }}
        >
          Intentar de nuevo
        </Button>
      </Card>
    );
  }

  const employees = load.rows.map(toEmployee);
  const self = employees.find((e) => e.id === me.id) ?? {
    id: me.id,
    name: me.name,
    email: me.email,
    role: me.role,
    active: true,
    device: null,
  };

  return (
    <>
      <AccessRequestsSection
        requests={load.requests}
        onResolve={async (id, decision) => {
          try {
            await api(`/admin/access-requests/${id}/${decision}`, { method: 'POST' });
          } catch (error) {
            throw reason(error);
          }
          reload();
          tools.refreshCounts();
        }}
      />
      <EmployeesScreen
        employees={employees}
        me={self}
        recordCountById={new Map(load.rows.map((r) => [r.id, r.recordCount]))}
        onAdd={async (employee: { name: string; email: string; role: Role }) => {
          try {
            await api('/admin/employees', { method: 'POST', body: employee });
          } catch (error) {
            throw reason(error);
          }
          reload();
        }}
        onAction={async (id, action) => {
          try {
            await applyOnServer(id, action);
          } catch (error) {
            throw reason(error);
          }
          reload();
        }}
      />
    </>
  );
}
