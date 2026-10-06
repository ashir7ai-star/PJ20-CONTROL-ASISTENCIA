import type { AttendanceRecord, Employee } from './model.js';

export interface DaySummary {
  activeEmployees: number;
  /** Employees whose latest record today is a check-in. */
  working: Employee[];
  /** Employees with at least one check-in today. */
  arrived: Employee[];
  /** Active employees without any record today. */
  missing: Employee[];
  pendingReview: AttendanceRecord[];
}

/** Pure daily aggregation used by the overview (records must belong to one day). */
export function summarizeDay(employees: Employee[], records: AttendanceRecord[]): DaySummary {
  const active = employees.filter((e) => e.active);
  const latestByEmployee = new Map<string, AttendanceRecord>();
  for (const record of records) {
    const current = latestByEmployee.get(record.employeeId);
    if (!current || record.serverTime > current.serverTime) {
      latestByEmployee.set(record.employeeId, record);
    }
  }
  const arrivedIds = new Set(records.filter((r) => r.kind === 'check_in').map((r) => r.employeeId));

  return {
    activeEmployees: active.length,
    working: active.filter((e) => latestByEmployee.get(e.id)?.kind === 'check_in'),
    arrived: active.filter((e) => arrivedIds.has(e.id)),
    missing: active.filter((e) => !latestByEmployee.has(e.id)),
    pendingReview: records.filter((r) => r.review === 'pending'),
  };
}

/** Seconds between the phone clock and the server clock (positive = phone behind). */
export function clockSkewSeconds(record: AttendanceRecord): number {
  return Math.round((record.serverTime.getTime() - record.deviceTime.getTime()) / 1000);
}
