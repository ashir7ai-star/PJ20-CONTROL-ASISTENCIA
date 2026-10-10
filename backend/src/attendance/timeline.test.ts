import { describe, expect, it } from 'vitest';

import { sortTimeline, type TimelineEvent, timelineError } from './timeline.js';

let n = 0;
const at = (iso: string, kind: TimelineEvent['kind']): TimelineEvent => ({
  id: `e${String(++n)}`,
  kind,
  at: new Date(iso),
});

describe('línea de tiempo efectiva', () => {
  it('ordena por hora, y a igual hora respeta el orden dado', () => {
    const a = at('2026-10-08T13:00:00Z', 'check_in');
    const b = at('2026-10-08T22:00:00Z', 'check_out');
    const c = at('2026-10-08T13:00:00Z', 'check_out');
    expect(sortTimeline([b, a, c]).map((e) => e.id)).toEqual([a.id, c.id, b.id]);
  });

  it('una línea vacía, con turnos completos o con un turno abierto es válida', () => {
    expect(timelineError([])).toBeNull();
    expect(
      timelineError([
        at('2026-10-08T13:00:00Z', 'check_in'),
        at('2026-10-08T22:00:00Z', 'check_out'),
        at('2026-10-09T13:00:00Z', 'check_in'),
      ]),
    ).toBeNull();
  });

  it('dos entradas seguidas: dice cuándo, en hora de Bogotá', () => {
    expect(
      timelineError([
        at('2026-10-08T13:00:00Z', 'check_in'),
        at('2026-10-09T13:05:00Z', 'check_in'),
      ]),
    ).toBe(
      'Quedarían dos entradas seguidas (9 de octubre a las 8:05 a. m.). Falta una salida antes.',
    );
  });

  it('una salida sin entrada, aunque llegue desordenada', () => {
    expect(
      timelineError([
        at('2026-10-08T22:00:00Z', 'check_out'),
        at('2026-10-08T13:00:00Z', 'check_in'),
        at('2026-10-08T23:30:00Z', 'check_out'),
      ]),
    ).toBe(
      'Quedaría una salida sin entrada (8 de octubre a las 6:30 p. m.). Falta una entrada antes.',
    );
  });
});
