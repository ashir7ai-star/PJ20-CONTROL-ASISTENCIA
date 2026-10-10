import { describe, expect, it } from 'vitest';

import {
  formatAccuracy,
  formatClock,
  formatDuration,
  formatElapsed,
  formatLongDate,
  formatShortDate,
  formatTime,
} from './format.js';

// Colombia is UTC-5 all year (no daylight saving).
const at = (iso: string) => new Date(iso);

describe('formatClock / formatTime (hora de Colombia)', () => {
  it('formatea la mañana con "a. m."', () => {
    expect(formatClock(at('2026-10-05T12:58:00Z'))).toEqual({ time: '7:58', period: 'a. m.' });
    expect(formatTime(at('2026-10-05T12:58:00Z'))).toBe('7:58 a. m.');
  });

  it('formatea la tarde con "p. m."', () => {
    expect(formatTime(at('2026-10-05T17:41:00Z'))).toBe('12:41 p. m.');
    expect(formatTime(at('2026-10-05T22:04:00Z'))).toBe('5:04 p. m.');
  });

  it('medianoche es 12 a. m.', () => {
    expect(formatTime(at('2026-10-06T05:00:00Z'))).toBe('12:00 a. m.');
  });

  it('usa la zona de Bogotá aunque el día UTC sea otro', () => {
    // 2026-10-06 03:30 UTC = 2026-10-05 10:30 p. m. en Colombia
    expect(formatTime(at('2026-10-06T03:30:00Z'))).toBe('10:30 p. m.');
  });
});

describe('formatLongDate', () => {
  it('escribe el día en español con mayúscula inicial', () => {
    expect(formatLongDate(at('2026-10-05T15:00:00Z'))).toBe('Lunes, 5 de octubre');
  });

  it('usa la fecha de Colombia, no la UTC', () => {
    expect(formatLongDate(at('2026-10-06T03:30:00Z'))).toBe('Lunes, 5 de octubre');
  });
});

describe('formatDuration', () => {
  it.each([
    [283, '4 h 43 min'],
    [45, '45 min'],
    [120, '2 h'],
    [0, '0 min'],
    [-5, '0 min'],
  ])('%i minutos → %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe('formatAccuracy', () => {
  it('redondea a metros enteros', () => {
    expect(formatAccuracy(6.4)).toBe('± 6 m');
  });
});

describe('formatElapsed', () => {
  it.each([
    [0, '0:00:00'],
    [59_999, '0:00:59'],
    [61_000, '0:01:01'],
    [(4 * 3600 + 43 * 60 + 20) * 1000, '4:43:20'],
    [(12 * 3600 + 5) * 1000, '12:00:05'],
    [-5000, '0:00:00'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatElapsed(ms)).toBe(expected);
  });
});

describe('formatShortDate', () => {
  it('día y mes en Bogotá, sin punto final', () => {
    expect(formatShortDate(new Date('2026-10-08T03:00:00Z'))).toMatch(/^7\sde\soct$/);
  });
});
