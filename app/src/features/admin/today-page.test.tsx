import type { AdminAttendanceEntry, Me } from '@pj20/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { a11yViolations } from '../../test/a11y.js';
import { TodayPage } from './today-page.js';

const admin: Me = {
  id: '1a1a1a1a-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  name: 'Nathan',
  email: 'nathan@ylevigroup.com',
  role: 'admin',
  consentRequired: false,
};

const entry = (over: Partial<AdminAttendanceEntry>): AdminAttendanceEntry => ({
  id: '0b0b0b0b-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  employee: { id: '2b2b2b2b-1a2b-4c3d-8e9f-0a1b2c3d4e5f', name: 'Laura Gómez', email: 'l@g.co' },
  kind: 'check_in',
  serverTime: '2026-10-08T12:58:00.000Z',
  deviceTime: '2026-10-08T12:58:01.000Z',
  latitude: 3.4516,
  longitude: -76.532,
  accuracyM: 8,
  reviewStatus: 'ok',
  reviewReasons: [],
  ip: '190.1.2.3',
  userAgent: 'Android',
  ...over,
});

let me: Me;
let entries: AdminAttendanceEntry[];
let requested: string[];

beforeEach(() => {
  me = admin;
  requested = [];
  entries = [
    entry({}),
    entry({
      id: '0c0c0c0c-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
      employee: {
        id: '3c3c3c3c-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
        name: 'Tomás Guerrero',
        email: 't@g.co',
      },
      serverTime: '2026-10-08T12:19:00.000Z',
      accuracyM: 240,
      reviewStatus: 'pending',
      reviewReasons: ['low_accuracy'],
    }),
  ];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requested.push(url);
    const body =
      url === '/api/v1/me' ? me : url.startsWith('/api/v1/admin/attendance') ? entries : null;
    if (body === null) return Promise.reject(new Error(`Ruta no simulada: ${url}`));
    return Promise.resolve(
      new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
    );
  });
});

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/admin', element: <TodayPage /> },
      { path: '/', element: <p>Marcar</p> },
      { path: '/prototipo/admin', element: <p>Prototipo</p> },
    ],
    { initialEntries: ['/admin'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('Marcaciones de hoy (administrador, datos reales)', () => {
  it('lista las marcaciones con hora, mapa, selfie y alertas de revisión', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Marcaciones de hoy' })).toBeInTheDocument();
    const cards = await screen.findAllByRole('listitem');
    expect(cards).toHaveLength(2);
    const [first, second] = cards;
    if (!first || !second) throw new Error('faltan tarjetas');

    const laura = within(first);
    expect(laura.getByText('Laura Gómez')).toBeInTheDocument();
    expect(laura.getByText('7:58 a. m.')).toBeInTheDocument();
    expect(laura.getByRole('link', { name: /Mapa · ± 8 m/ })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=3.4516,-76.532',
    );

    const tomas = within(second);
    expect(tomas.getByText(/Por revisar: GPS impreciso/)).toBeInTheDocument();
    expect(screen.getByText('Por revisar').nextSibling).toHaveTextContent('1');
  });

  it('abre la selfie en grande, servida por la API', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver selfie de Laura Gómez' }));
    const photo = await screen.findByRole('img', { name: 'Selfie de Laura Gómez al marcar' });
    expect(photo).toHaveAttribute('src', `/api/v1/admin/attendance/${entries[0]?.id ?? ''}/selfie`);
  });

  it('sin marcaciones muestra un estado vacío claro', async () => {
    entries = [];
    renderPage();
    expect(await screen.findByText('Aún no hay marcaciones hoy')).toBeInTheDocument();
  });

  it('permite ver el día anterior; no deja ir a días futuros', async () => {
    renderPage();
    await screen.findAllByRole('listitem');
    expect(screen.getByRole('button', { name: 'Día siguiente' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Día anterior' }));
    await vi.waitFor(() => {
      expect(requested.filter((u) => u.startsWith('/api/v1/admin/attendance'))).toHaveLength(2);
    });
    const [today, yesterday] = requested
      .filter((u) => u.startsWith('/api/v1/admin/attendance'))
      .map((u) => u.split('date=')[1] ?? '');
    expect(Date.parse(today ?? '') - Date.parse(yesterday ?? '')).toBe(86_400_000);
  });

  it('un empleado que llega aquí vuelve a Marcar', async () => {
    me = { ...admin, role: 'employee' };
    const router = renderPage();
    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(screen.getByText('Marcar', { selector: 'p' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('es accesible', async () => {
    renderPage();
    await screen.findAllByRole('listitem');
    expect(await a11yViolations(document.body)).toEqual([]);
  });
});
