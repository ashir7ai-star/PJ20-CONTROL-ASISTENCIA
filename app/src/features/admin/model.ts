/**
 * View models for the admin panel. Prototype data in Fase 1; real API from Fase 6.
 */
import type { AttendanceKind } from '../employee/model.js';

export type Role = 'employee' | 'admin';

export const roleLabels: Record<Role, string> = {
  employee: 'Empleado',
  admin: 'Administrador',
};

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  device: { model: string; platform: 'android' | 'ios' } | null;
}

/** Fraud / quality signals evaluated by the server (CLAUDE.md §2B). */
export type Signal =
  'weak-accuracy' | 'suspicious-coordinates' | 'impossible-speed' | 'ip-mismatch';

export const signalLabels: Record<Signal, string> = {
  'weak-accuracy': 'Precisión baja',
  'suspicious-coordinates': 'Coordenadas sospechosas',
  'impossible-speed': 'Desplazamiento imposible',
  'ip-mismatch': 'Red de otra ciudad',
};

export type ReviewStatus = 'ok' | 'pending' | 'approved' | 'rejected';

export const reviewLabels: Record<ReviewStatus, string> = {
  ok: 'Normal',
  pending: 'Por revisar',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  kind: AttendanceKind;
  serverTime: Date;
  deviceTime: Date;
  location: { lat: number; lng: number; accuracyM: number; place: string };
  device: { model: string; os: string; app: string; verified: boolean };
  ip: string;
  signals: Signal[];
  review: ReviewStatus;
}

/** Attempts blocked before creating a record (e.g. mock location on Android). */
export interface BlockedAttempt {
  id: string;
  employeeId: string;
  at: Date;
  reason: string;
  device: string;
}

export interface DeviceRequest {
  id: string;
  employeeId: string;
  newModel: string;
  previousModel: string | null;
  requestedAt: Date;
}

/** "Laura Gómez" → "LG" */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
