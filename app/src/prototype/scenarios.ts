/**
 * Prototype data (Fase 1). Fixed, realistic times so every review shows the
 * same screens. Replaced by real API data from Fase 3 on.
 */
import type { EmployeeView } from '../features/employee/model.js';

/** Monday 2026-10-05 in Colombia (UTC-5). */
export const MORNING = new Date('2026-10-05T12:58:00Z'); // 7:58 a. m.
export const AFTERNOON = new Date('2026-10-05T17:41:00Z'); // 12:41 p. m.
const YESTERDAY_EXIT = new Date('2026-10-04T22:04:00Z'); // ayer 5:04 p. m.

export const offDuty: EmployeeView = {
  firstName: 'Laura',
  shift: { kind: 'off' },
  lastRecord: { kind: 'check_out', at: YESTERDAY_EXIT },
  location: { state: 'ready', accuracyM: 6 },
};

export const onDuty: EmployeeView = {
  firstName: 'Laura',
  shift: { kind: 'on', since: MORNING },
  lastRecord: { kind: 'check_in', at: MORNING },
  location: { state: 'ready', accuracyM: 6 },
};

export const searchingGps: EmployeeView = { ...offDuty, location: { state: 'searching' } };
export const weakGps: EmployeeView = { ...offDuty, location: { state: 'weak', accuracyM: 180 } };
