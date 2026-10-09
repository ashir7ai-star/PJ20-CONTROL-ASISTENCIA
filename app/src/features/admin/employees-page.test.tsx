import type { AccessRequestDto, EmployeeDto, Me } from '@pj20/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { a11yViolations } from '../../test/a11y.js';
import { EmployeesPage } from './employees-page.js';

const ME_ID = '1a1a1a1a-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const me: Me = {
  id: ME_ID,
  name: 'Nathan',
  email: 'nathan@ylevigroup.com',
  role: 'admin',
  consentRequired: false,
  selfieAuthorized: true,
};

const row = (over: Partial<EmployeeDto>): EmployeeDto => ({
  id: ME_ID,
  name: 'Nathan',
  email: 'nathan@ylevigroup.com',
  role: 'admin',
  active: true,
  createdAt: '2026-10-08T12:00:00.000Z',
  recordCount: 3,
  ...over,
});

interface Call {
  method: string;
  url: string;
  body: unknown;
}

let rows: EmployeeDto[];
let requests: AccessRequestDto[];
let calls: Call[];
let nextError: { status: number; code: string; message: string } | null;

beforeEach(() => {
  calls = [];
  nextError = null;
  requests = [];
  rows = [
    row({}),
    row({
      id: '2b2b2b2b-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
      name: 'Laura Gómez',
      email: 'laura@gmail.com',
      role: 'employee',
      recordCount: 0,
    }),
  ];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, body });
    const json = (status: number, payload?: unknown) =>
      Promise.resolve(
        new Response(payload === undefined ? null : JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      );
    if (url === '/api/v1/me') return json(200, me);
    if (method !== 'GET' && nextError) {
      const { status, code, message } = nextError;
      return json(status, { error: { code, message } });
    }
    if (url === '/api/v1/admin/employees' && method === 'GET') return json(200, rows);
    if (url === '/api/v1/admin/access-requests') return json(200, requests);
    const resolved = /^\/api\/v1\/admin\/access-requests\/([^/]+)\/(approve|reject)$/.exec(url);
    if (resolved && method === 'POST') {
      const request = requests.find((r) => r.id === resolved[1]);
      requests = requests.filter((r) => r.id !== resolved[1]);
      if (request && resolved[2] === 'approve') {
        rows = [
          ...rows,
          row({
            id: '4d4d4d4d-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
            name: request.name,
            email: request.email,
            role: 'employee',
            recordCount: 0,
          }),
        ];
      }
      return json(204);
    }
    if (url === '/api/v1/admin/employees' && method === 'POST') {
      const created = row({
        id: '3c3c3c3c-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
        ...(body as { name: string; email: string }),
        role: 'employee',
        recordCount: 0,
      });
      rows = [...rows, created];
      return json(201, created);
    }
    if (url.startsWith('/api/v1/admin/employees/') && method === 'PATCH') {
      const id = url.split('/').pop();
      rows = rows.map((r) => (r.id === id ? { ...r, ...(body as object) } : r));
      return json(
        200,
        rows.find((r) => r.id === id),
      );
    }
    return Promise.reject(new Error(`Ruta no simulada: ${method} ${url}`));
  });
});

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/admin/empleados', element: <EmployeesPage /> },
      { path: '/', element: <p>Inicio</p> },
    ],
    { initialEntries: ['/admin/empleados'] },
  );
  render(<RouterProvider router={router} />);
}

async function openActions(name: string) {
  fireEvent.keyDown(await screen.findByRole('button', { name: `Acciones para ${name}` }), {
    key: 'Enter',
  });
}

describe('Empleados (administrador, datos reales)', () => {
  it('lista los empleados del servidor y marca quién eres tú', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Empleados' })).toBeInTheDocument();
    expect(screen.getByText('Laura Gómez')).toBeInTheDocument();
    expect(screen.getByText('(tú)')).toBeInTheDocument();
    expect(screen.getByText('2 activos · 0 inactivos')).toBeInTheDocument();
  });

  it('agrega un empleado: lo envía al servidor y aparece en la lista', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar empleado' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre completo'), {
      target: { value: 'Pedro Sánchez' },
    });
    fireEvent.change(within(dialog).getByLabelText('Correo de Google'), {
      target: { value: 'pedro@gmail.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Pedro Sánchez')).toBeInTheDocument();
    expect(calls).toContainEqual({
      method: 'POST',
      url: '/api/v1/admin/employees',
      body: { name: 'Pedro Sánchez', email: 'pedro@gmail.com', role: 'employee' },
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('si el correo ya existe, el formulario muestra el motivo del servidor y no se cierra', async () => {
    nextError = { status: 409, code: 'CONFLICT', message: 'Ya existe un usuario con ese correo.' };
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar empleado' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre completo'), {
      target: { value: 'Laura Repetida' },
    });
    fireEvent.change(within(dialog).getByLabelText('Correo de Google'), {
      target: { value: 'laura@gmail.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Ya existe un usuario con ese correo.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('desactivar pide confirmación y lo aplica en el servidor', async () => {
    renderPage();
    await openActions('Laura Gómez');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Desactivar acceso' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));

    expect(await screen.findByText('1 activos · 1 inactivos')).toBeInTheDocument();
    expect(calls).toContainEqual({
      method: 'PATCH',
      url: '/api/v1/admin/employees/2b2b2b2b-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
      body: { active: false },
    });
  });

  it('si el servidor rechaza la acción, explica el motivo en el diálogo', async () => {
    nextError = {
      status: 422,
      code: 'RULE_VIOLATION',
      message: 'Debe quedar al menos un administrador activo.',
    };
    renderPage();
    await openActions('Laura Gómez');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Hacer administrador' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Hacer administrador' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Debe quedar al menos un administrador activo.',
    );
  });

  it('es accesible', async () => {
    renderPage();
    await screen.findByText('Laura Gómez');
    expect(await a11yViolations(document.body)).toEqual([]);
  });

  it('muestra las solicitudes de acceso con el número en la pestaña; aprobar crea al empleado', async () => {
    requests = [
      {
        id: '5e5e5e5e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
        name: 'Sofía Ortiz',
        email: 'sofia@gmail.com',
        requestedAt: '2026-10-09T13:00:00.000Z',
        deactivatedEmployee: false,
      },
    ];
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Solicitudes pendientes (1)' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('solicitudes de acceso pendientes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aprobar a Sofía Ortiz' }));
    await vi.waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Solicitudes pendientes/ })).toBeNull();
    });
    expect(screen.getByText('sofia@gmail.com')).toBeInTheDocument();
    expect(calls).toContainEqual({
      method: 'POST',
      url: '/api/v1/admin/access-requests/5e5e5e5e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/approve',
      body: undefined,
    });
    expect(await a11yViolations(document.body)).toEqual([]);
  });
});
