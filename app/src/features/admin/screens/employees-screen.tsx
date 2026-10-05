import { UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Avatar } from '../../../components/ui/avatar.js';
import { Button } from '../../../components/ui/button.js';
import { Field, SearchInput, Select, TextInput } from '../../../components/ui/field.js';
import { Sheet } from '../../../components/ui/sheet.js';
import { StatusBadge } from '../../../components/ui/status-badge.js';
import { PageHeader } from '../components/admin-ui.js';
import { type Employee, type Role, initials, roleLabels } from '../model.js';

interface EmployeesScreenProps {
  employees: Employee[];
  onAdd: (employee: { name: string; email: string; role: Role }) => void;
}

export function EmployeesScreen({ employees, onAdd }: EmployeesScreenProps) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

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
              <th scope="col" className="px-5 py-3 font-medium">
                Estado
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
                      <span className="block truncate font-medium">{e.name}</span>
                      <span className="block truncate text-[13px] text-ink-muted">{e.email}</span>
                    </span>
                  </span>
                </td>
                <td className="hidden px-5 py-3 md:table-cell">{roleLabels[e.role]}</td>
                <td className="hidden px-5 py-3 text-ink-muted lg:table-cell">
                  {e.device?.model ?? 'Sin celular vinculado'}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge tone={e.active ? 'success' : 'neutral'}>
                    {e.active ? 'Activo' : 'Inactivo'}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
