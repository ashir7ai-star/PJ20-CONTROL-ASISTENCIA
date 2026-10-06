import {
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { type ReactNode, useMemo, useState } from 'react';

import { Avatar } from '../../../components/ui/avatar.js';
import { Button } from '../../../components/ui/button.js';
import { Field, SearchInput, Select, TextInput } from '../../../components/ui/field.js';
import { Sheet } from '../../../components/ui/sheet.js';
import { StatusBadge } from '../../../components/ui/status-badge.js';
import { cn } from '../../../lib/cn.js';
import { PageHeader } from '../components/admin-ui.js';
import { type Employee, type Role, initials, roleLabels } from '../model.js';
import { type UserAction, availableActions, blockReason } from '../permissions.js';

interface EmployeesScreenProps {
  employees: Employee[];
  /** The administrator using the panel. */
  me: Employee;
  recordCountById: Map<string, number>;
  onAdd: (employee: { name: string; email: string; role: Role }) => void;
  onAction: (employeeId: string, action: UserAction) => void;
}

const actionCopy: Record<
  UserAction,
  {
    label: string;
    icon: ReactNode;
    title: string;
    body: (e: Employee) => string;
    confirm: string;
    destructive: boolean;
  }
> = {
  'make-admin': {
    label: 'Hacer administrador',
    icon: <ShieldCheck className="size-4" aria-hidden="true" />,
    title: 'Hacer administrador',
    body: (e) =>
      `${e.name} podrá ver todas las marcaciones, selfies y ubicaciones, y gestionar empleados y celulares.`,
    confirm: 'Hacer administrador',
    destructive: false,
  },
  'remove-admin': {
    label: 'Quitar rol de administrador',
    icon: <ShieldOff className="size-4" aria-hidden="true" />,
    title: 'Quitar rol de administrador',
    body: (e) =>
      `${e.name} seguirá marcando su asistencia, pero ya no verá el panel de administración.`,
    confirm: 'Quitar rol',
    destructive: true,
  },
  deactivate: {
    label: 'Desactivar acceso',
    icon: <UserX className="size-4" aria-hidden="true" />,
    title: 'Desactivar acceso',
    body: (e) =>
      `${e.name} no podrá iniciar sesión ni marcar. Su historial de marcaciones se conserva y puedes reactivarlo cuando quieras.`,
    confirm: 'Desactivar',
    destructive: true,
  },
  reactivate: {
    label: 'Reactivar acceso',
    icon: <UserCheck className="size-4" aria-hidden="true" />,
    title: 'Reactivar acceso',
    body: (e) => `${e.name} podrá volver a iniciar sesión y marcar su asistencia.`,
    confirm: 'Reactivar',
    destructive: false,
  },
  delete: {
    label: 'Eliminar',
    icon: <Trash2 className="size-4" aria-hidden="true" />,
    title: 'Eliminar usuario',
    body: (e) => `Se eliminará a ${e.name} (${e.email}). Esta acción no se puede deshacer.`,
    confirm: 'Eliminar',
    destructive: true,
  },
};

export function EmployeesScreen({
  employees,
  me,
  recordCountById,
  onAdd,
  onAction,
}: EmployeesScreenProps) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<{ employee: Employee; action: UserAction } | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es-CO');
    return employees.filter(
      (e) => q === '' || `${e.name} ${e.email}`.toLocaleLowerCase('es-CO').includes(q),
    );
  }, [employees, query]);

  const active = employees.filter((e) => e.active).length;

  return (
    <>
      <PageHeader
        title="Empleados"
        subtitle={`${String(active)} activos · ${String(employees.length - active)} inactivos`}
        actions={
          <Button
            icon={<UserPlus className="size-4" aria-hidden="true" />}
            onClick={() => {
              setAdding(true);
            }}
          >
            Agregar empleado
          </Button>
        }
      />

      <SearchInput
        aria-label="Buscar por nombre o correo"
        placeholder="Buscar por nombre o correo"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        className="mt-6 lg:w-80"
      />

      <div className="mt-4 overflow-hidden rounded-3xl bg-surface-raised ring-1 ring-line">
        <table className="w-full text-left text-[14px]">
          <caption className="sr-only">Empleados</caption>
          <thead className="border-b border-line text-[13px] text-ink-muted">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">
                Nombre
              </th>
              <th scope="col" className="hidden px-5 py-3 font-medium md:table-cell">
                Rol
              </th>
              <th scope="col" className="hidden px-5 py-3 font-medium lg:table-cell">
                Celular
              </th>
              <th scope="col" className="hidden px-5 py-3 font-medium sm:table-cell">
                Estado
              </th>
              <th scope="col" className="px-3 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((e) => (
              <tr key={e.id}>
                <td className="px-5 py-3">
                  <span className="flex items-center gap-3">
                    <Avatar initials={initials(e.name)} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {e.name}
                        {e.id === me.id && (
                          <span className="font-normal text-ink-muted"> (tú)</span>
                        )}
                      </span>
                      <span className="block truncate text-[13px] text-ink-muted">{e.email}</span>
                      {/* Role and status shown inline on phones, where those columns are hidden */}
                      <span className="mt-1 flex gap-1.5 sm:hidden">
                        {e.role === 'admin' && <StatusBadge tone="info">Administrador</StatusBadge>}
                        {!e.active && <StatusBadge>Inactivo</StatusBadge>}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="hidden px-5 py-3 md:table-cell">
                  {e.role === 'admin' ? (
                    <StatusBadge tone="info">{roleLabels.admin}</StatusBadge>
                  ) : (
                    roleLabels.employee
                  )}
                </td>
                <td className="hidden px-5 py-3 text-ink-muted lg:table-cell">
                  {e.device?.model ?? 'Sin celular vinculado'}
                </td>
                <td className="hidden px-5 py-3 sm:table-cell">
                  <StatusBadge tone={e.active ? 'success' : 'neutral'}>
                    {e.active ? 'Activo' : 'Inactivo'}
                  </StatusBadge>
                </td>
                <td className="px-3 py-3 text-right">
                  <RowActions
                    employee={e}
                    onSelect={(action) => {
                      setPending({ employee: e, action });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pending && (
        <ConfirmActionSheet
          employee={pending.employee}
          action={pending.action}
          blocked={blockReason(
            pending.action,
            pending.employee,
            me,
            employees,
            recordCountById.get(pending.employee.id) ?? 0,
          )}
          onCancel={() => {
            setPending(null);
          }}
          onConfirm={() => {
            onAction(pending.employee.id, pending.action);
            setPending(null);
          }}
        />
      )}

      <AddEmployeeSheet
        open={adding}
        onClose={() => {
          setAdding(false);
        }}
        onSave={(employee) => {
          onAdd(employee);
          setAdding(false);
        }}
      />
    </>
  );
}

function AddEmployeeSheet({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (employee: { name: string; email: string; role: Role }) => void;
}) {
  const formId = 'agregar-empleado';
  const submit = (event: { preventDefault: () => void; currentTarget: HTMLFormElement }) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => {
      const value = data.get(key);
      return typeof value === 'string' ? value.trim() : '';
    };
    onSave({
      name: text('name'),
      email: text('email').toLowerCase(),
      role: text('role') === 'admin' ? 'admin' : 'employee',
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      variant="center"
      title="Agregar empleado"
      description="Podrá ingresar con su cuenta de Google en cuanto lo guardes."
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId}>
            Guardar
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nombre completo">
          {(id) => <TextInput id={id} name="name" required autoComplete="off" minLength={3} />}
        </Field>
        <Field label="Correo de Google" hint="Gmail o correo corporativo de Google Workspace.">
          {(id) => <TextInput id={id} name="email" type="email" required autoComplete="off" />}
        </Field>
        <Field label="Rol">
          {(id) => (
            <Select id={id} name="role" defaultValue="employee">
              <option value="employee">Empleado</option>
              <option value="admin">Administrador</option>
            </Select>
          )}
        </Field>
      </form>
    </Sheet>
  );
}

function RowActions({
  employee,
  onSelect,
}: {
  employee: Employee;
  onSelect: (action: UserAction) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="inline-grid size-11 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface hover:text-ink data-[state=open]:bg-surface"
        aria-label={`Acciones para ${employee.name}`}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-60 rounded-2xl bg-surface-raised p-1.5 text-ink shadow-xl ring-1 ring-line data-[state=open]:animate-[fade-in_150ms_var(--ease-standard)]"
        >
          {availableActions(employee).map((action) => {
            const copy = actionCopy[action];
            return (
              <DropdownMenu.Item
                key={action}
                onSelect={() => {
                  onSelect(action);
                }}
                className={cn(
                  'flex h-11 cursor-pointer select-none items-center gap-3 rounded-xl px-3 text-[14px] font-medium outline-none data-highlighted:bg-surface',
                  action === 'delete' && 'text-danger',
                )}
              >
                {copy.icon}
                {copy.label}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Confirms an action, or explains why it is not allowed (never fails silently). */
function ConfirmActionSheet({
  employee,
  action,
  blocked,
  onCancel,
  onConfirm,
}: {
  employee: Employee;
  action: UserAction;
  blocked: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = actionCopy[action];
  return (
    <Sheet
      open
      variant="center"
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={blocked ? 'Acción no permitida' : copy.title}
      footer={
        blocked ? (
          <Button block onClick={onCancel}>
            Entendido
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button variant={copy.destructive ? 'danger' : 'primary'} onClick={onConfirm}>
              {copy.confirm}
            </Button>
          </div>
        )
      }
    >
      <p className="text-[15px] leading-relaxed">{blocked ?? copy.body(employee)}</p>
    </Sheet>
  );
}
