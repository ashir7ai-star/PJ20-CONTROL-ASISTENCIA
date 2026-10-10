/**
 * The administrator's corrections (Fase 6): reject a doubtful record, void a
 * mistaken one, add a forgotten one. Records are never edited (CLAUDE.md
 * §2.4): each action is a new, audited entry with its reason. The server
 * validates everything; its Spanish message is shown as is.
 *
 * Each dialog is mounted only while open (the page renders it conditionally),
 * so every opening starts with empty fields.
 */
import type {
  AdminAttendanceEntry,
  AdminTimelineEntry,
  AttendanceKind,
  CorrectionRequest,
  EmployeeDto,
  ReviewRequest,
} from '@pj20/shared';
import { Checkbox } from 'radix-ui';
import { Check } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { api, ApiRequestError } from '../../api/client.js';
import { Button } from '../../components/ui/button.js';
import { ErrorNote } from '../../components/ui/error-note.js';
import { Field, Select, TextArea, TextInput } from '../../components/ui/field.js';
import { Segmented } from '../../components/ui/segmented.js';
import { Sheet } from '../../components/ui/sheet.js';
import { formatTime } from '../../lib/format.js';
import { entryInstant } from './timeline-entry.js';

const MIN_REASON = 10;
const kindNoun: Record<AttendanceKind, string> = { check_in: 'entrada', check_out: 'salida' };

function failureMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.code !== 'NETWORK_ERROR') return error.message;
  return 'No pudimos guardar. Revisa tu conexión e inténtalo de nuevo.';
}

/** POSTs and reports failure in Spanish; `onDone` only after the server agreed. */
function useSubmit(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (path: string, body: ReviewRequest | CorrectionRequest) => {
    setBusy(true);
    setError(null);
    try {
      await api(path, { method: 'POST', body });
      onDone();
    } catch (failure) {
      setError(failureMessage(failure));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, submit };
}

function ReasonField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Field label={label} hint="Queda en el registro de auditoría. Mínimo 10 caracteres.">
      {(id) => (
        <TextArea
          id={id}
          value={value}
          maxLength={500}
          required
          placeholder={placeholder}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      )}
    </Field>
  );
}

// ── Review ───────────────────────────────────────────────────────────────

/** Rejecting needs a reason; approving is one tap (see ApproveButton). */
export function RejectDialog({
  entry,
  onClose,
  onDone,
}: {
  entry: AdminAttendanceEntry;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const { busy, error, submit } = useSubmit(onDone);

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      variant="center"
      title="Rechazar marcación"
      description={`${entry.employee.name} · ${kindNoun[entry.kind]} de las ${formatTime(new Date(entry.serverTime))}. El turno que la contiene no sumará horas.`}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={note.trim().length < MIN_REASON}
            onClick={() => {
              void submit(`/admin/attendance/${entry.id}/review`, { decision: 'rejected', note });
            }}
          >
            Rechazar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorNote message={error} />}
        <ReasonField
          label="Motivo"
          value={note}
          onChange={setNote}
          placeholder="Ej.: marcó desde la casa, no desde la obra."
        />
      </div>
    </Sheet>
  );
}

export function ApproveButton({
  entry,
  onDone,
}: {
  entry: AdminAttendanceEntry;
  onDone: () => void;
}) {
  const { busy, error, submit } = useSubmit(onDone);
  return (
    <>
      {error && <ErrorNote message={error} className="w-full" />}
      <Button
        variant="secondary"
        loading={busy}
        onClick={() =>
          void submit(`/admin/attendance/${entry.id}/review`, { decision: 'approved' })
        }
      >
        Aprobar
      </Button>
    </>
  );
}

// ── Void ─────────────────────────────────────────────────────────────────

/** Voids a record or an added mark, and optionally its partner of the same shift. */
export function VoidDialog({
  entry,
  partner,
  onClose,
  onDone,
}: {
  entry: AdminTimelineEntry;
  /** The other half of the shift, offered to void together. */
  partner: AdminTimelineEntry | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [withPartner, setWithPartner] = useState(true);
  const checkboxId = useId();
  const { busy, error, submit } = useSubmit(onDone);

  const describe = (e: AdminTimelineEntry) =>
    `la ${kindNoun[e.kind]} de las ${formatTime(entryInstant(e))}`;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      variant="center"
      title="Anular marcación"
      description={`${entry.employee.name} · ${describe(entry)}. No se borra: queda visible como anulada y deja de contar.`}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={reason.trim().length < MIN_REASON}
            onClick={() => {
              const targetIds = partner && withPartner ? [entry.id, partner.id] : [entry.id];
              void submit('/admin/corrections', { action: 'void', targetIds, reason });
            }}
          >
            Anular
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorNote message={error} />}
        {partner && (
          <div className="flex items-start gap-3">
            <Checkbox.Root
              id={checkboxId}
              checked={withPartner}
              onCheckedChange={(value) => {
                setWithPartner(value === true);
              }}
              className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md ring-2 ring-line-strong transition-colors data-[state=checked]:bg-primary data-[state=checked]:ring-primary"
            >
              <Checkbox.Indicator>
                <Check className="size-4 text-primary-ink" strokeWidth={3} aria-hidden="true" />
              </Checkbox.Indicator>
            </Checkbox.Root>
            <label htmlFor={checkboxId} className="text-[15px] leading-snug">
              Anular también {describe(partner)} (el mismo turno)
            </label>
          </div>
        )}
        <ReasonField
          label="Motivo"
          value={reason}
          onChange={setReason}
          placeholder="Ej.: marcó dos veces por error al probar la app."
        />
      </div>
    </Sheet>
  );
}

// ── Add a forgotten mark ─────────────────────────────────────────────────

type AddMode = 'check_out' | 'check_in' | 'both';

/** Bogotá has no daylight saving time: a local date and time is always UTC−5. */
const bogotaInstant = (date: string, time: string) => `${date}T${time}:00-05:00`;

export function AddCorrectionDialog({
  defaultDate,
  onClose,
  onDone,
}: {
  defaultDate: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [people, setPeople] = useState<EmployeeDto[] | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [mode, setMode] = useState<AddMode>('check_out');
  const [date, setDate] = useState(defaultDate);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [reason, setReason] = useState('');
  const { busy, error, setError, submit } = useSubmit(onDone);

  useEffect(() => {
    let cancelled = false;
    api<EmployeeDto[]>('/admin/employees').then(
      (list) => {
        if (!cancelled) setPeople(list.toSorted((a, b) => a.name.localeCompare(b.name, 'es')));
      },
      (failure: unknown) => {
        if (!cancelled) setError(failureMessage(failure));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [setError]);

  const needsIn = mode !== 'check_out';
  const needsOut = mode !== 'check_in';
  const ready =
    employeeId !== '' &&
    date !== '' &&
    (!needsIn || checkIn !== '') &&
    (!needsOut || checkOut !== '') &&
    reason.trim().length >= MIN_REASON;

  const save = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!ready) return;
    const events: { kind: AttendanceKind; at: string }[] = [];
    if (needsIn) events.push({ kind: 'check_in', at: bogotaInstant(date, checkIn) });
    if (needsOut) events.push({ kind: 'check_out', at: bogotaInstant(date, checkOut) });
    if (needsIn && needsOut && checkOut <= checkIn) {
      setError('La salida debe ser después de la entrada del mismo día.');
      return;
    }
    void submit('/admin/corrections', { action: 'add', employeeId, events, reason });
  };

  return (
    <Sheet
      open
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      title="Agregar marcación olvidada"
      description="La hora la fijas tú y siempre se verá como corrección, con tu nombre y el motivo."
      footer={
        <Button
          block
          size="lg"
          type="submit"
          form="agregar-marcacion"
          loading={busy}
          disabled={!ready}
        >
          Agregar
        </Button>
      }
    >
      <form id="agregar-marcacion" className="flex flex-col gap-5" onSubmit={save}>
        {error && <ErrorNote message={error} />}
        <Field label="Persona">
          {(id) => (
            <Select
              id={id}
              value={employeeId}
              required
              disabled={people === null}
              onChange={(event) => {
                setEmployeeId(event.target.value);
              }}
            >
              <option value="">{people === null ? 'Cargando…' : 'Elige a la persona'}</option>
              {people?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.active ? '' : ' (inactivo)'}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[14px] font-medium" aria-hidden="true">
            Qué olvidó marcar
          </span>
          <Segmented<AddMode>
            label="Qué olvidó marcar"
            value={mode}
            onChange={setMode}
            className="w-full"
            options={[
              { value: 'check_out', label: 'Salida' },
              { value: 'check_in', label: 'Entrada' },
              { value: 'both', label: 'Las dos' },
            ]}
          />
        </div>
        <Field label="Fecha">
          {(id) => (
            <TextInput
              id={id}
              type="date"
              value={date}
              max={defaultDate}
              required
              onChange={(event) => {
                setDate(event.target.value);
              }}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {needsIn && (
            <Field label="Hora de entrada">
              {(id) => (
                <TextInput
                  id={id}
                  type="time"
                  value={checkIn}
                  required
                  onChange={(event) => {
                    setCheckIn(event.target.value);
                  }}
                />
              )}
            </Field>
          )}
          {needsOut && (
            <Field label="Hora de salida">
              {(id) => (
                <TextInput
                  id={id}
                  type="time"
                  value={checkOut}
                  required
                  onChange={(event) => {
                    setCheckOut(event.target.value);
                  }}
                />
              )}
            </Field>
          )}
        </div>
        <ReasonField
          label="Motivo"
          value={reason}
          onChange={setReason}
          placeholder="Ej.: olvidó marcar la salida; lo confirmó el supervisor."
        />
      </form>
    </Sheet>
  );
}
