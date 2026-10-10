/**
 * The effective timeline of an employee (Fase 6): original records plus the
 * administrator's corrections, minus whatever was voided. Pure functions: the
 * consistency rule (§2.6, entry → exit → entry…) is checked here for every
 * correction, and unit-tested in isolation.
 */
import { type AttendanceKind, TIME_ZONE } from '@pj20/shared';

export interface TimelineEvent {
  id: string;
  kind: AttendanceKind;
  at: Date;
}

/** Oldest first; on the same instant, the order they were given in. */
export function sortTimeline(events: readonly TimelineEvent[]): TimelineEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.at.getTime() - b.event.at.getTime() || a.index - b.index)
    .map(({ event }) => event);
}

const whenFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Spanish reason why the timeline is inconsistent, or null when it alternates
 * entry → exit → entry… starting with an entry. An open shift at the end
 * (last event an entry) is fine: the person is working.
 */
export function timelineError(events: readonly TimelineEvent[]): string | null {
  let expected: AttendanceKind = 'check_in';
  for (const event of sortTimeline(events)) {
    if (event.kind !== expected) {
      const when = whenFormat.format(event.at);
      return event.kind === 'check_in'
        ? `Quedarían dos entradas seguidas (${when}). Falta una salida antes.`
        : `Quedaría una salida sin entrada (${when}). Falta una entrada antes.`;
    }
    expected = expected === 'check_in' ? 'check_out' : 'check_in';
  }
  return null;
}
