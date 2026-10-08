/**
 * Safety rules for managing users. Shared by the API (which ENFORCES them,
 * CLAUDE.md §1.5) and the app (which uses them to explain WHY an action is
 * not allowed instead of failing silently).
 */
import type { Role } from './auth.js';

/** Minimal shape the rules need; any user record with these fields works. */
export interface ManagedUser {
  id: string;
  role: Role;
  active: boolean;
}

export type UserAction = 'make-admin' | 'remove-admin' | 'deactivate' | 'reactivate' | 'delete';

const LAST_ADMIN =
  'Debe quedar al menos un administrador activo. Nombra otro administrador antes de hacer este cambio.';

function activeAdmins(employees: ManagedUser[]): number {
  return employees.filter((e) => e.active && e.role === 'admin').length;
}

/** Returns why the action is blocked, or null when it is allowed. */
export function blockReason(
  action: UserAction,
  target: ManagedUser,
  me: ManagedUser,
  employees: ManagedUser[],
  /** Consents + attendance records: anything that must be kept by law. */
  recordCount: number,
): string | null {
  const isSelf = target.id === me.id;
  const isLastAdmin = target.role === 'admin' && target.active && activeAdmins(employees) <= 1;

  switch (action) {
    case 'make-admin':
      return target.active
        ? null
        : 'Reactiva el acceso de este usuario antes de hacerlo administrador.';
    case 'remove-admin':
      if (isSelf) return 'No puedes quitarte tu propio rol de administrador.';
      return isLastAdmin ? LAST_ADMIN : null;
    case 'deactivate':
      if (isSelf) return 'No puedes desactivar tu propia cuenta.';
      return isLastAdmin ? LAST_ADMIN : null;
    case 'reactivate':
      return null;
    case 'delete':
      if (isSelf) return 'No puedes eliminar tu propia cuenta.';
      if (isLastAdmin) return LAST_ADMIN;
      if (recordCount > 0) {
        return 'Este usuario ya usó la aplicación (aceptó el consentimiento o tiene marcaciones). Por ley y para la auditoría su historial se conserva: desactiva su acceso en lugar de eliminarlo.';
      }
      return null;
  }
}

/** Actions offered for a user, depending on its current state. */
export function availableActions(target: ManagedUser): UserAction[] {
  const actions: UserAction[] = [target.role === 'admin' ? 'remove-admin' : 'make-admin'];
  actions.push(target.active ? 'deactivate' : 'reactivate');
  actions.push('delete');
  return actions;
}
