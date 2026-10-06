import { describe, expect, it } from 'vitest';

import type { AttendanceRecord, Employee } from './model.js';
import { clockSkewSeconds, summarizeDay } from './stats.js';

const employee = (id: string, active = true): Employee => ({
  id,
  name: `Empleado ${id}`,
  email: `${id}@gmail.com`,
  role: 'employee',
  active,
  device: null,
});

const t = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 5, h + 5, m));

const rec = (
  employeeId: string,
  kind: AttendanceRecord['kind'],
  time: Date,
  review: AttendanceRecord['review'] = 'ok',
): AttendanceRecord => ({
  id: `${employeeId}-${kind}-${String(time.getTime())}`,
  employeeId,
  kind,
  serverTime: time,
  deviceTime: time,
  location: { lat: 0, lng: 0, accuracyM: 5, place: 'Sede' },
  device: { model: 'X', os: 'Android 14', app: 'App', verified: true },
  ip: '1.1.1.1',
  signals: [],
  review,
});

describe('summarizeDay', () => {
  const people = [employee('a'), employee('b'), employee('c'), employee('d', false)];

  it('separa quién trabaja, quién ya salió y quién no ha marcado', () => {
    const summary = summarizeDay(people, [
      rec('a', 'check_in', t(7)),
      rec('b', 'check_in', t(7, 5)),
      rec('b', 'check_out', t(12)),
    ]);

    expect(summary.activeEmployees).toBe(3);
    expect(summary.working.map((e) => e.id)).toEqual(['a']);
    expect(summary.arrived.map((e) => e.id)).toEqual(['a', 'b']);
    expect(summary.missing.map((e) => e.id)).toEqual(['c']);
  });

  it('ignora a los empleados inactivos', () => {
    const summary = summarizeDay(people, [rec('d', 'check_in', t(7))]);
    expect(summary.working).toEqual([]);
    expect(summary.missing.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('usa la última marcación aunque lleguen desordenadas', () => {
    const summary = summarizeDay(people, [
      rec('a', 'check_out', t(12)),
      rec('a', 'check_in', t(7)),
    ]);
    expect(summary.working).toEqual([]);
  });

  it('lista las marcaciones pendientes de revisión', () => {
    const pending = rec('c', 'check_in', t(7, 20), 'pending');
    expect(summarizeDay(people, [pending]).pendingReview).toEqual([pending]);
  });
});

describe('clockSkewSeconds', () => {
  it('calcula la diferencia entre el reloj del celular y el del servidor', () => {
    const r = { ...rec('a', 'check_in', t(7)), deviceTime: new Date(t(7).getTime() - 3000) };
    expect(clockSkewSeconds(r)).toBe(3);
  });
});
