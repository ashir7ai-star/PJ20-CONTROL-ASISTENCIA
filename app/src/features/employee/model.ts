/**
 * View model for the employee screens. In Fase 1 it is filled with prototype
 * data; from Fase 3 on it is built from the real API.
 */
import type { AttendanceKind } from '@pj20/shared';

export type { AttendanceKind };
export { WEAK_ACCURACY_M } from '@pj20/shared/constants';

export type ShiftStatus = { kind: 'off' } | { kind: 'on'; since: Date };

/** 'on-mark': the real app reads GPS only at the moment of marking (§3.1). */
export type LocationReadiness =
  | { state: 'on-mark' }
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
