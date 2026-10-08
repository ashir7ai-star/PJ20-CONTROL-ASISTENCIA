import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { a11yViolations } from '../test/a11y.js';
import { AdminPrototype } from './admin-prototype.js';

function renderAdmin(path = '/prototipo/admin') {
  const router = createMemoryRouter(
    [
      { path: '/prototipo/admin/*', element: <AdminPrototype /> },
      { path: '/prototipo/empleado/:pantalla', element: <p>Pantalla del empleado</p> },
      { path: '/', element: <p>Inicio de la app real</p> },
    ],
    { initialEntries: [path] },
  );
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

/** First match, with a clear failure instead of a non-null assertion. */
function first<T>(items: T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error('No se encontró ningún elemento');
  return item;
}

const reviewNavCount = () =>
  screen.getAllByRole('link', { name: /Por revisar|Revisar/ }).map((link) => link.textContent);

describe('accesibilidad del panel (axe · WCAG 2.1 AA)', () => {
  it.each([
    ['Resumen', '/prototipo/admin'],
    ['Marcaciones', '/prototipo/admin/marcaciones'],
    ['Por revisar', '/prototipo/admin/revision'],
    ['Empleados', '/prototipo/admin/empleados'],
    ['Celulares', '/prototipo/admin/celulares'],
  ])('%s: 0 violaciones', async (title, path) => {
    renderAdmin(path);
    await screen.findByRole('heading', { level: 1, name: title });
    expect(await a11yViolations(document.body)).toEqual([]);
  });

  it('detalle de marcación: 0 violaciones', async () => {
    renderAdmin('/prototipo/admin/marcaciones?detalle=m031');
    await screen.findByRole('dialog');
    expect(await a11yViolations(document.body)).toEqual([]);
  });
});

describe('Resumen', () => {
  it('cuenta quién trabaja, quién llegó y quién falta, sobre 29 activos', async () => {
    renderAdmin();
    const working = await screen.findByText('Trabajando ahora');
    expect(working.parentElement).toHaveTextContent('24/ 29');
    expect(screen.getByText('Sin marcar').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Por revisar', { selector: 'p' }).parentElement).toHaveTextContent('3');
  });

  it('muestra el intento de ubicación falsa bloqueado', async () => {
    renderAdmin();
    expect(
      await screen.findByText(/Ubicación falsa bloqueada · Carolina Medina/),
    ).toBeInTheDocument();
  });
});

describe('Por revisar', () => {
  it('aprobar quita la marcación de la cola y actualiza el contador', async () => {
    renderAdmin('/prototipo/admin/revision');
    await screen.findByRole('heading', { level: 1, name: 'Por revisar' });
    expect(screen.getAllByRole('button', { name: 'Aprobar' })).toHaveLength(3);
    expect(reviewNavCount()[0]).toContain('3');

    fireEvent.click(first(screen.getAllByRole('button', { name: 'Aprobar' })));
    expect(screen.getAllByRole('button', { name: 'Aprobar' })).toHaveLength(2);
    expect(reviewNavCount()[0]).toContain('2');
  });

  it('cuando no queda nada muestra "Todo al día"', async () => {
    renderAdmin('/prototipo/admin/revision');
    await screen.findByRole('heading', { level: 1, name: 'Por revisar' });
    for (let i = 0; i < 3; i++) {
      fireEvent.click(first(screen.getAllByRole('button', { name: 'Rechazar' })));
    }
    expect(screen.getByText('Todo al día')).toBeInTheDocument();
  });
});

describe('Marcaciones', () => {
  it('filtra solo las marcaciones por revisar', async () => {
    renderAdmin('/prototipo/admin/marcaciones');
    await screen.findByRole('heading', { level: 1, name: 'Marcaciones' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Solo por revisar' }));
    expect(screen.getByText('3 registros')).toBeInTheDocument();
  });

  it('busca por nombre de empleado', async () => {
    renderAdmin('/prototipo/admin/marcaciones');
    await screen.findByRole('heading', { level: 1, name: 'Marcaciones' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar empleado' }), {
      target: { value: 'laura' },
    });
    expect(screen.getByText('1 registros')).toBeInTheDocument();
  });

  it('un período sin datos muestra el estado vacío', async () => {
    renderAdmin('/prototipo/admin/marcaciones');
    await screen.findByRole('heading', { level: 1, name: 'Marcaciones' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Período' }), {
      target: { value: 'yesterday' },
    });
    expect(screen.getByText('No hay marcaciones')).toBeInTheDocument();
  });

  it('el detalle muestra la evidencia y permite decidir', async () => {
    const { router } = renderAdmin('/prototipo/admin/marcaciones?detalle=m031');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Precisión baja')).toBeInTheDocument();
    expect(within(dialog).getAllByText('± 180 m', { exact: false }).length).toBeGreaterThan(0);
    expect(within(dialog).getByText('Celular verificado')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Aprobar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });
});

describe('Empleados', () => {
  it('agrega un empleado desde el formulario', async () => {
    renderAdmin('/prototipo/admin/empleados');
    await screen.findByRole('heading', { level: 1, name: 'Empleados' });
    expect(screen.getByText('29 activos · 1 inactivos')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Agregar empleado' }));
    const dialog = await screen.findByRole('dialog', { name: 'Agregar empleado' });
    fireEvent.change(within(dialog).getByLabelText('Nombre completo'), {
      target: { value: 'Pedro Sánchez' },
    });
    fireEvent.change(within(dialog).getByLabelText('Correo de Google'), {
      target: { value: 'Pedro.Sanchez@gmail.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('pedro.sanchez@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('30 activos · 1 inactivos')).toBeInTheDocument();
  });
});

describe('Celulares', () => {
  it('aprobar una solicitud la retira de la lista', async () => {
    renderAdmin('/prototipo/admin/celulares');
    await screen.findByRole('heading', { level: 1, name: 'Celulares' });
    expect(screen.getAllByRole('button', { name: 'Aprobar' })).toHaveLength(2);
    fireEvent.click(first(screen.getAllByRole('button', { name: 'Aprobar' })));
    expect(screen.getAllByRole('button', { name: 'Aprobar' })).toHaveLength(1);
  });
});

describe('navegación', () => {
  it('en la demo pública, "Marcar" lleva a la pantalla de ejemplo del empleado', async () => {
    vi.stubEnv('VITE_MODO', 'prototipo');
    renderAdmin();
    fireEvent.click(first(await screen.findAllByRole('link', { name: /Marcar/ })));
    expect(await screen.findByText('Pantalla del empleado')).toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});

describe('Empleados · gestión de roles y accesos', () => {
  async function openActions(name: string) {
    renderAdmin('/prototipo/admin/empleados');
    const trigger = await screen.findByRole('button', { name: `Acciones para ${name}` });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    return screen.findByRole('menu');
  }

  it('hace administrador a un empleado tras confirmar', async () => {
    const menu = await openActions('Laura Gómez');
    expect(
      within(menu).getByRole('menuitem', { name: 'Quitar rol de administrador' }),
    ).toBeInTheDocument();
    // Laura (e01) is admin in the prototype data; promote someone else instead.
    fireEvent.keyDown(menu, { key: 'Escape' });

    const trigger = screen.getByRole('button', { name: 'Acciones para Camila Hernández' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Hacer administrador' }));
    const dialog = await screen.findByRole('dialog', { name: 'Hacer administrador' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hacer administrador' }));

    const row = screen.getByText('Camila Hernández').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getAllByText('Administrador').length).toBeGreaterThan(0);
  });

  it('impide quitarse el propio rol y lo explica', async () => {
    const menu = await openActions('Andrés Rodríguez');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Quitar rol de administrador' }));
    const dialog = await screen.findByRole('dialog', { name: 'Acción no permitida' });
    expect(dialog).toHaveTextContent('No puedes quitarte tu propio rol de administrador.');
    expect(within(dialog).getByRole('button', { name: 'Entendido' })).toBeInTheDocument();
  });

  it('no elimina a quien tiene marcaciones: sugiere desactivarlo', async () => {
    const menu = await openActions('Santiago López');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Eliminar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Acción no permitida' });
    expect(dialog).toHaveTextContent(/desactiva su acceso en lugar de eliminarlo/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Santiago López')).toBeInTheDocument();
  });

  it('desactiva el acceso y actualiza el contador', async () => {
    const menu = await openActions('Santiago López');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Desactivar acceso' }));
    const dialog = await screen.findByRole('dialog', { name: 'Desactivar acceso' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
    expect(screen.getByText('28 activos · 2 inactivos')).toBeInTheDocument();
  });

  it('elimina a un usuario sin marcaciones', async () => {
    const menu = await openActions('Ricardo Patiño');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Eliminar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Eliminar usuario' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    expect(screen.queryByText('Ricardo Patiño')).toBeNull();
  });

  it('el menú de acciones y el diálogo son accesibles', async () => {
    await openActions('Camila Hernández');
    expect(await a11yViolations(document.body)).toEqual([]);
  });

  it('abierto desde la app real, «Cerrar sesión» cierra la sesión del servidor y vuelve al inicio', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const { router } = renderAdmin();
    fireEvent.click(first(screen.getAllByRole('button', { name: 'Cerrar sesión' })));
    expect(await screen.findByText('Inicio de la app real')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
    fetchMock.mockRestore();
  });

  it('«Marcar mi asistencia» vuelve al Marcar real', async () => {
    const { router } = renderAdmin();
    fireEvent.click(first(screen.getAllByRole('link', { name: /Marcar/ })));
    expect(await screen.findByText('Inicio de la app real')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});
