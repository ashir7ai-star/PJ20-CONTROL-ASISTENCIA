/**
 * Spanish (Colombia) formatting. Every date/time shown to users goes through
 * here so the whole app is consistent and 100% Spanish (CLAUDE.md B.14).
 */
export const LOCALE = 'es-CO';
export const TIME_ZONE = 'America/Bogota';

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: TIME_ZONE,
});

const longDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TIME_ZONE,
});

export interface ClockParts {
  /** e.g. "7:58" */
  time: string;
  /** Always "a. m." or "p. m." */
  period: string;
}

/** Splits a time into "7:58" + "a. m." regardless of ICU version quirks. */
export function formatClock(date: Date): ClockParts {
  const parts = timeFormatter.formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '';
  const hour24 = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: TIME_ZONE })
      .formatToParts(date)
      .find((p) => p.type === 'hour')?.value,
  );
  return { time: `${hour}:${minute}`, period: hour24 < 12 ? 'a. m.' : 'p. m.' };
}

/** "7:58 a. m." */
export function formatTime(date: Date): string {
  const { time, period } = formatClock(date);
  return `${time} ${period}`;
}

/** "Lunes, 5 de octubre" */
export function formatLongDate(date: Date): string {
  const text = longDateFormatter.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** 283 → "4 h 43 min" · 45 → "45 min" · 120 → "2 h" */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** GPS accuracy in metres → "± 6 m" */
export function formatAccuracy(metres: number): string {
  return `± ${Math.round(metres)} m`;
}
