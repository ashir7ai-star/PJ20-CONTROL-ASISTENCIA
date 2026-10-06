import { CalendarX2, ChevronRight, Download } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Avatar } from '../../../components/ui/avatar.js';
import { Button } from '../../../components/ui/button.js';
import { SearchInput, Select } from '../../../components/ui/field.js';
import { Segmented } from '../../../components/ui/segmented.js';
import { formatAccuracy, formatTime } from '../../../lib/format.js';
import type { AttendanceKind } from '../../employee/model.js';
import { EmptyState, KindLabel, PageHeader, ReviewBadge } from '../components/admin-ui.js';
import { type AttendanceRecord, type Employee, initials } from '../model.js';

type KindFilter = 'all' | AttendanceKind;
type Period = 'today' | 'yesterday' | 'week';

interface RecordsScreenProps {
  records: AttendanceRecord[];
  employeeById: Map<string, Employee>;
  onOpen: (id: string) => void;
}

/** All records with filters. Table on desktop, cards on phones. */
export function RecordsScreen({ records, employeeById, onOpen }: RecordsScreenProps) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [period, setPeriod] = useState<Period>('today');
  const [onlyPending, setOnlyPending] = useState(false);
  const name = (id: string) => employeeById.get(id)?.name ?? 'Empleado';

  const visible = useMemo(() => {
    // Prototype data only covers today.
    if (period !== 'today') return [];
    const q = query.trim().toLocaleLowerCase('es-CO');
    return records.filter(
      (r) =>
        (kind === 'all' || r.kind === kind) &&
        (!onlyPending || r.review === 'pending') &&
        (q === '' ||
          (employeeById.get(r.employeeId)?.name ?? '').toLocaleLowerCase('es-CO').includes(q)),
    );
  }, [records, employeeById, query, kind, period, onlyPending]);

  return (
    <>
      <PageHeader
        title="Marcaciones"
        subtitle={`${String(visible.length)} registros`}
        actions={
          <Button variant="secondary" icon={<Download className="size-4" aria-hidden="true" />}>
            Exportar a Excel
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          aria-label="Buscar empleado"
          placeholder="Buscar empleado"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          className="sm:w-64"
        />
        <Select
          aria-label="Período"
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value as Period);
          }}
          className="sm:w-44"
        >
          <option value="today">Hoy</option>
          <option value="yesterday">Ayer</option>
          <option value="week">Últimos 7 días</option>
        </Select>
        <Segmented
          label="Tipo de marcación"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'check_in', label: 'Entradas' },
            { value: 'check_out', label: 'Salidas' },
          ]}
        />
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap text-[14px] font-medium xl:ml-auto">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => {
              setOnlyPending(e.target.checked);
            }}
            className="size-5 accent-(--color-primary)"
          />
          Solo por revisar
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-3xl bg-surface-raised ring-1 ring-line">
        {visible.length === 0 ? (
          <EmptyState
            icon={<CalendarX2 className="size-6" />}
            title="No hay marcaciones"
            body="Prueba con otro período o quita los filtros."
          />
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-left text-[14px] md:table">
              <caption className="sr-only">Marcaciones</caption>
              <thead className="border-b border-line text-[13px] text-ink-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Empleado
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Tipo
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Hora
                  </th>
                  <th scope="col" className="hidden px-5 py-3 font-medium xl:table-cell">
                    Lugar
                  </th>
                  <th scope="col" className="hidden px-5 py-3 font-medium xl:table-cell">
                    Precisión
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Estado
                  </th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-surface">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-3 whitespace-nowrap font-medium">
                        <Avatar initials={initials(name(r.employeeId))} size="sm" />
                        {name(r.employeeId)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <KindLabel kind={r.kind} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums">
                      {formatTime(r.serverTime)}
                    </td>
                    <td className="hidden px-5 py-3 text-ink-muted xl:table-cell">
                      {r.location.place}
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-3 tabular-nums text-ink-muted xl:table-cell">
                      {formatAccuracy(r.location.accuracyM)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <ReviewBadge review={r.review} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant="ghost"
                        className="h-11 px-4"
                        onClick={() => {
                          onOpen(r.id);
                        }}
                      >
                        Ver<span className="sr-only"> marcación de {name(r.employeeId)}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Phone list */}
            <ul className="divide-y divide-line md:hidden">
              {visible.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpen(r.id);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface"
                  >
                    <Avatar initials={initials(name(r.employeeId))} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">
                        {name(r.employeeId)}
                      </span>
                      <span className="flex items-center gap-2 text-[13px] text-ink-muted">
                        <KindLabel kind={r.kind} /> · {formatTime(r.serverTime)}
                      </span>
                    </span>
                    {r.review === 'pending' && <ReviewBadge review={r.review} />}
                    <ChevronRight className="size-4 text-ink-muted" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
