import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { a11yViolations } from '../test/a11y.js';
import { AdminPrototype } from './admin-prototype.js';

function renderAdmin(path = '/prototipo/admin') {
  const router = createMemoryRouter(
    [
      { path: '/prototipo/admin/*', element: <AdminPrototype /> },
      { path: '/prototipo/empleado/:pantalla', element: <p>Pantalla del empleado</p> },
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
  it('el botón "Marcar" lleva a la pantalla del empleado (el admin también marca)', async () => {
    renderAdmin();
    fireEvent.click(first(await screen.findAllByRole('link', { name: /Marcar/ })));
    expect(await screen.findByText('Pantalla del empleado')).toBeInTheDocument();
  });
});
