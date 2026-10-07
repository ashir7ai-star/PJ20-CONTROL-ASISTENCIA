import { describe, expect, it } from 'vitest';

import type { ManagedUser } from './permissions.js';
import { availableActions, blockReason } from './permissions.js';

const user = (id: string, role: ManagedUser['role'], active = true): ManagedUser => ({
  id,
  role,
  active,
});

const me = user('me', 'admin');
const otherAdmin = user('a2', 'admin');
const employee = user('e1', 'employee');
const inactive = user('e2', 'employee', false);

describe('blockReason', () => {
  it('permite hacer administrador a un empleado activo', () => {
    expect(blockReason('make-admin', employee, me, [me, employee], 0)).toBeNull();
  });

  it('no permite hacer administrador a un usuario desactivado', () => {
    expect(blockReason('make-admin', inactive, me, [me, inactive], 0)).toMatch(/Reactiva/);
  });

  it('nadie puede quitarse su propio rol', () => {
    expect(blockReason('remove-admin', me, me, [me, otherAdmin], 0)).toMatch(/propio rol/);
  });

  it('se puede quitar el rol a otro administrador si queda al menos uno', () => {
    expect(blockReason('remove-admin', otherAdmin, me, [me, otherAdmin], 0)).toBeNull();
  });

  it('nunca deja la empresa sin administradores activos', () => {
    // "me" is the only ACTIVE admin; the other admin is deactivated.
    const lonely = user('me', 'admin');
    const sleeping = user('a3', 'admin', false);
    const target = user('a4', 'admin');
    expect(blockReason('remove-admin', target, lonely, [lonely, sleeping, target], 0)).toBeNull();
    expect(blockReason('deactivate', lonely, target, [lonely, sleeping], 0)).toMatch(
      /al menos un administrador/,
    );
  });

  it('nadie puede desactivarse ni eliminarse a sí mismo', () => {
    expect(blockReason('deactivate', me, me, [me, otherAdmin], 0)).toMatch(/propia cuenta/);
    expect(blockReason('delete', me, me, [me, otherAdmin], 0)).toMatch(/propia cuenta/);
  });

  it('no permite eliminar a quien ya tiene marcaciones (se desactiva)', () => {
    expect(blockReason('delete', employee, me, [me, employee], 12)).toMatch(/desactiva su acceso/);
  });

  it('permite eliminar a quien no tiene marcaciones', () => {
    expect(blockReason('delete', employee, me, [me, employee], 0)).toBeNull();
  });
});

describe('availableActions', () => {
  it('ofrece las acciones según el estado del usuario', () => {
    expect(availableActions(employee)).toEqual(['make-admin', 'deactivate', 'delete']);
    expect(availableActions(otherAdmin)).toEqual(['remove-admin', 'deactivate', 'delete']);
    expect(availableActions(inactive)).toEqual(['make-admin', 'reactivate', 'delete']);
  });
});
