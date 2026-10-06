/**
 * View model for the employee screens. In Fase 1 it is filled with prototype
 * data; from Fase 3 on it is built from the real API.
 */
export type AttendanceKind = 'check_in' | 'check_out';

export type ShiftStatus = { kind: 'off' } | { kind: 'on'; since: Date };

export type LocationReadiness =
  | { state: 'searching' }
  | { state: 'ready'; accuracyM: number }
  | { state: 'weak'; accuracyM: number };

export interface EmployeeView {
  firstName: string;
  shift: ShiftStatus;
  lastRecord: { kind: AttendanceKind; at: Date } | null;
  location: LocationReadiness;
}

export const attendanceLabels: Record<
  AttendanceKind,
  { action: string; done: string; noun: string }
> = {
  check_in: { action: 'Marcar entrada', done: 'Entrada registrada', noun: 'Entrada' },
  check_out: { action: 'Marcar salida', done: 'Salida registrada', noun: 'Salida' },
};

/** Next action is always the opposite of the current shift state. */
export function nextAction(shift: ShiftStatus): AttendanceKind {
  return shift.kind === 'on' ? 'check_out' : 'check_in';
}

/** Accuracy above this is accepted but flagged for review (CLAUDE.md §2.6). */
export const WEAK_ACCURACY_M = 100;
