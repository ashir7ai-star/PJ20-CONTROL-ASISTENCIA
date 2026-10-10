/**
 * One line of the admin's timeline (Fase 6): a real mark (selfie, map, server
 * time, review state) or a mark added by an administrator, which always shows
 * who added it and why — never mistaken for a server time.
 */
import type { AdminAttendanceEntry, AdminTimelineEntry, ReviewReason } from '@pj20/shared';
import { CameraOff, MapPin, PencilLine } from 'lucide-react';
import type { ReactNode } from 'react';

import { Avatar } from '../../components/ui/avatar.js';
import { Card } from '../../components/ui/card.js';
import { Sheet } from '../../components/ui/sheet.js';
import { StatusBadge } from '../../components/ui/status-badge.js';
import { cn } from '../../lib/cn.js';
import { formatAccuracy, formatShortDate, formatTime } from '../../lib/format.js';
import { KindLabel } from './components/admin-ui.js';
import { initials } from './model.js';

const reasonLabels: Record<ReviewReason, string> = {
  low_accuracy: 'GPS impreciso',
  stale_location: 'Ubicación vieja',
};

/** Waiting for the administrator: flagged, no verdict yet, not voided. */
export function awaitsReview(entry: AdminTimelineEntry): entry is AdminAttendanceEntry {
  return (
    entry.source === 'record' &&
    entry.reviewStatus === 'pending' &&
    entry.verdict === null &&
    entry.voided === null
  );
}

export const entryInstant = (entry: AdminTimelineEntry) =>
  new Date(entry.source === 'record' ? entry.serverTime : entry.at);

interface TimelineEntryCardProps {
  entry: AdminTimelineEntry;
  onOpenSelfie: (entry: AdminAttendanceEntry) => void;
  /** Buttons for this entry (review, void), shown under its details. */
  actions?: ReactNode;
  /** Show the date too (the review queue spans several days). */
  withDate?: boolean;
}

export function TimelineEntryCard({
  entry,
  onOpenSelfie,
  actions,
  withDate,
}: TimelineEntryCardProps) {
  const at = entryInstant(entry);
  const voided = entry.voided !== null;
  return (
    <Card className={cn('p-4', voided && 'opacity-70')}>
      <div className="flex gap-4">
        {entry.source === 'record' ? (
          <SelfieThumb entry={entry} onOpen={onOpenSelfie} />
        ) : (
          <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-info-soft px-1 text-center text-[11px] font-semibold leading-tight text-info">
            <span>
              <PencilLine className="mx-auto mb-1 size-5" aria-hidden="true" />
              Corrección
            </span>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar initials={initials(entry.employee.name)} size="sm" />
              <p className="truncate text-[15px] font-semibold">{entry.employee.name}</p>
            </div>
            <time
              dateTime={at.toISOString()}
              className={cn(
                'shrink-0 text-right text-[15px] font-semibold tabular-nums',
                voided && 'line-through',
              )}
            >
              {withDate && (
                <span className="block text-[12px] font-medium text-ink-muted">
                  {formatShortDate(at)}
                </span>
              )}
              {formatTime(at)}
            </time>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
            <KindLabel kind={entry.kind} />
            {entry.source === 'record' && <MapLink entry={entry} />}
          </div>
          <EntryNotes entry={entry} />
        </div>
      </div>
      {actions && !voided && (
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          {actions}
        </div>
      )}
    </Card>
  );
}

function SelfieThumb({
  entry,
  onOpen,
}: {
  entry: AdminAttendanceEntry;
  onOpen: (entry: AdminAttendanceEntry) => void;
}) {
  if (entry.selfie === 'stored') {
    return (
      <button
        type="button"
        onClick={() => {
          onOpen(entry);
        }}
        className="size-20 shrink-0 overflow-hidden rounded-2xl bg-surface"
        aria-label={`Ver selfie de ${entry.employee.name}`}
      >
        <img
          src={`/api/v1/admin/attendance/${entry.id}/selfie`}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      </button>
    );
  }
  // No photo: not authorized by the employee (D7) or deleted by retention.
  return (
    <span
      className={cn(
        'grid size-20 shrink-0 place-items-center rounded-2xl px-1 text-center text-[11px] font-semibold leading-tight',
        entry.selfie === 'not-authorized'
          ? 'bg-warning-soft text-warning'
          : 'bg-surface text-ink-muted',
      )}
    >
      <span>
        <CameraOff className="mx-auto mb-1 size-5" aria-hidden="true" />
        {entry.selfie === 'not-authorized' ? 'Sin selfie' : 'Foto eliminada'}
      </span>
    </span>
  );
}

function MapLink({ entry }: { entry: AdminAttendanceEntry }) {
  const url = `https://www.google.com/maps/search/?api=1&query=${String(entry.latitude)},${String(entry.longitude)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-info hover:underline"
    >
      <MapPin className="size-4" aria-hidden="true" />
      Mapa · {formatAccuracy(entry.accuracyM)}
    </a>
  );
}

function EntryNotes({ entry }: { entry: AdminTimelineEntry }) {
  const notes: ReactNode[] = [];
  if (entry.voided) {
    notes.push(
      <Decision
        key="void"
        tone="neutral"
        label="Anulada"
        by={entry.voided.by}
        note={entry.voided.reason}
      />,
    );
  }
  if (entry.source === 'correction') {
    notes.push(
      <p key="added" className="text-[13px] text-ink-muted">
        Agregada por {entry.by}: {entry.reason}
      </p>,
    );
  } else {
    if (entry.selfie === 'not-authorized') {
      notes.push(
        <p key="selfie" className="text-[13px] text-ink-muted">
          No autorizó la selfie (es opcional por ley): verifícala por otro medio si hace falta.
        </p>,
      );
    }
    if (entry.selfie === 'expired') {
      notes.push(
        <p key="selfie" className="text-[13px] text-ink-muted">
          La selfie se borró por la política de conservación (90 días).
        </p>,
      );
    }
    if (entry.verdict) {
      notes.push(
        <Decision
          key="verdict"
          tone={entry.verdict.decision === 'approved' ? 'success' : 'danger'}
          label={entry.verdict.decision === 'approved' ? 'Aprobada' : 'Rechazada'}
          by={entry.verdict.by}
          note={entry.verdict.note}
        />,
      );
    } else if (entry.reviewStatus === 'pending' && !entry.voided) {
      notes.push(
        <StatusBadge key="pending" tone="warning">
          Por revisar: {entry.reviewReasons.map((r) => reasonLabels[r]).join(' · ')}
        </StatusBadge>,
      );
    }
  }
  if (notes.length === 0) return null;
  return <div className="mt-2 flex flex-col items-start gap-2">{notes}</div>;
}

/** A short status badge, with who decided and why underneath (reasons can be long). */
function Decision({
  tone,
  label,
  by,
  note,
}: {
  tone: 'neutral' | 'success' | 'danger';
  label: string;
  by: string;
  note: string | null;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <StatusBadge tone={tone}>{label}</StatusBadge>
      <p className="text-[13px] text-ink-muted">
        Por {by}
        {note ? `: ${note}` : ''}
      </p>
    </div>
  );
}

/** The selfie in large size, served by the API to admin sessions only (decision 0004). */
export function SelfieSheet({
  entry,
  onClose,
}: {
  entry: AdminAttendanceEntry | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      variant="center"
      title={entry ? `${entry.employee.name} · ${formatTime(new Date(entry.serverTime))}` : ''}
    >
      {entry && (
        <img
          src={`/api/v1/admin/attendance/${entry.id}/selfie`}
          alt={`Selfie de ${entry.employee.name} al marcar`}
          className="w-full rounded-2xl bg-surface object-contain"
        />
      )}
    </Sheet>
  );
}
