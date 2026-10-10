import type {
  AdminAttendanceEntry,
  AdminCorrectionEntry,
  AdminTimelineEntry,
  BackupStatus,
  EmployeeDto,
  Me,
} from '@pj20/shared';
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
  selfieAuthorized: true,
};

const entry = (over: Partial<AdminAttendanceEntry>): AdminAttendanceEntry => ({
  source: 'record',
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
  selfie: 'stored',
  verdict: null,
  voided: null,
  ...over,
});

const added = (over: Partial<AdminCorrectionEntry>): AdminCorrectionEntry => ({
  source: 'correction',
  id: '0e0e0e0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  employee: { id: '2b2b2b2b-1a2b-4c3d-8e9f-0a1b2c3d4e5f', name: 'Laura Gómez', email: 'l@g.co' },
  kind: 'check_out',
  at: '2026-10-08T22:00:00.000Z',
  reason: 'Olvidó marcar la salida; lo confirmó el supervisor.',
  by: 'Nathan',
  createdAt: '2026-10-09T13:00:00.000Z',
  voided: null,
  ...over,
});

const people: EmployeeDto[] = [
  {
    id: '2b2b2b2b-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
    name: 'Laura Gómez',
    email: 'l@g.co',
    role: 'employee',
    active: true,
  } as EmployeeDto,
];

let me: Me;
let entries: AdminTimelineEntry[];
let posted: { url: string; body: unknown }[];
let postStatus: number;
let backups: BackupStatus | null;
let requested: string[];

beforeEach(() => {
  me = admin;
  requested = [];
  posted = [];
  postStatus = 204;
  backups = null;
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
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requested.push(url);
    if (init?.method === 'POST') {
      posted.push({ url, body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
      return Promise.resolve(
        postStatus === 204
          ? new Response(null, { status: 204 })
          : new Response(
              JSON.stringify({
                error: {
                  code: 'RULE_VIOLATION',
                  message: 'Quedaría una salida sin entrada (8 de octubre a las 7:58 a. m.).',
                },
              }),
              { status: postStatus, headers: { 'content-type': 'application/json' } },
            ),
      );
    }
    const body =
      url === '/api/v1/me'
        ? me
        : url.startsWith('/api/v1/admin/attendance')
          ? entries
          : url === '/api/v1/admin/backups'
            ? backups
            : url === '/api/v1/admin/employees'
              ? people
              : null;
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
    expect(screen.getByText('Por revisar', { selector: 'dt' }).nextSibling).toHaveTextContent('1');
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

  it('muestra «Sin selfie» cuando no se autorizó y «Foto eliminada» al vencer (D7)', async () => {
    entries = [
      entry({ selfie: 'not-authorized' }),
      entry({ id: '0d0d0d0d-1a2b-4c3d-8e9f-0a1b2c3d4e5f', selfie: 'expired' }),
    ];
    renderPage();
    expect(await screen.findByText('Sin selfie')).toBeInTheDocument();
    expect(screen.getByText('Foto eliminada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ver selfie/ })).toBeNull();
    expect(screen.getByText(/es opcional por ley/)).toBeInTheDocument();
  });

  it('copias de seguridad al día: muestra la última copia buena (D8)', async () => {
    backups = {
      database: { lastSuccessAt: '2026-10-10T07:00:00.000Z', lastFailure: null },
      selfies: { lastSuccessAt: '2026-10-10T08:00:00.000Z', lastFailure: null },
      stale: false,
    };
    renderPage();
    expect(await screen.findByText(/Última copia de seguridad: .* ✓/)).toBeInTheDocument();
    expect(screen.queryByText(/no están al día/)).toBeNull();
  });

  it('copias atrasadas: alerta visible con el último error y qué hacer', async () => {
    backups = {
      database: {
        lastSuccessAt: '2026-10-07T07:00:00.000Z',
        lastFailure: { at: '2026-10-09T07:00:00.000Z', detail: 'sin conexión con Drive' },
      },
      selfies: { lastSuccessAt: null, lastFailure: null },
      stale: true,
    };
    renderPage();
    const alert = await screen.findByText(/no están al día/);
    expect(alert.closest('[role="alert"]')).toHaveTextContent('sin conexión con Drive');
    expect(alert.closest('[role="alert"]')).toHaveTextContent('pj20-asistencia-respaldos');
  });

  it('aprobar es un toque; rechazar exige el motivo', async () => {
    renderPage();
    const cards = await screen.findAllByRole('listitem');
    const tomas = within(cards[1] ?? document.body);
    fireEvent.click(tomas.getByRole('button', { name: 'Aprobar' }));
    await vi.waitFor(() => {
      expect(posted).toEqual([
        {
          url: '/api/v1/admin/attendance/0c0c0c0c-1a2b-4c3d-8e9f-0a1b2c3d4e5f/review',
          body: { decision: 'approved' },
        },
      ]);
    });

    fireEvent.click(tomas.getByRole('button', { name: 'Rechazar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rechazar marcación' });
    const confirm = within(dialog).getByRole('button', { name: 'Rechazar' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Motivo'), {
      target: { value: 'Marcó desde la casa, no desde la obra.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rechazar' }));
    await vi.waitFor(() => {
      expect(posted[1]?.body).toEqual({
        decision: 'rejected',
        note: 'Marcó desde la casa, no desde la obra.',
      });
    });
    expect(await a11yViolations(document.body)).toEqual([]);
  });

  it('anular ofrece anular también la otra mitad del turno', async () => {
    entries = [
      entry({
        id: '0a0a0a0a-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
        kind: 'check_out',
        serverTime: '2026-10-08T22:00:00.000Z',
      }),
      entry({}),
    ];
    renderPage();
    const cards = await screen.findAllByRole('listitem');
    fireEvent.click(within(cards[1] ?? document.body).getByRole('button', { name: 'Anular' }));
    const dialog = await screen.findByRole('dialog', { name: 'Anular marcación' });
    expect(within(dialog).getByRole('checkbox')).toBeChecked();
    expect(dialog).toHaveTextContent('Anular también la salida de las 5:00 p. m. (el mismo turno)');
    fireEvent.change(within(dialog).getByLabelText('Motivo'), {
      target: { value: 'Marcó por error al probar la app.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Anular' }));
    await vi.waitFor(() => {
      expect(posted[0]?.body).toEqual({
        action: 'void',
        targetIds: ['0b0b0b0b-1a2b-4c3d-8e9f-0a1b2c3d4e5f', '0a0a0a0a-1a2b-4c3d-8e9f-0a1b2c3d4e5f'],
        reason: 'Marcó por error al probar la app.',
      });
    });
  });

  it('si el servidor no acepta la corrección, explica por qué y no cierra', async () => {
    postStatus = 422;
    renderPage();
    const cards = await screen.findAllByRole('listitem');
    fireEvent.click(within(cards[0] ?? document.body).getByRole('button', { name: 'Anular' }));
    const dialog = await screen.findByRole('dialog', { name: 'Anular marcación' });
    fireEvent.change(within(dialog).getByLabelText('Motivo'), {
      target: { value: 'Marcó por error al probar la app.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Anular' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('salida sin entrada');
  });

  it('agregar una salida olvidada: hora de Bogotá y motivo', async () => {
    renderPage();
    await screen.findAllByRole('listitem');
    fireEvent.click(screen.getByRole('button', { name: /Agregar/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Agregar marcación olvidada' });
    const save = screen.getByRole('button', { name: 'Agregar' });
    expect(save).toBeDisabled();
    fireEvent.change(await within(dialog).findByRole('combobox', { name: 'Persona' }), {
      target: { value: '2b2b2b2b-1a2b-4c3d-8e9f-0a1b2c3d4e5f' },
    });
    fireEvent.change(within(dialog).getByLabelText('Fecha'), { target: { value: '2026-10-08' } });
    fireEvent.change(within(dialog).getByLabelText('Hora de salida'), {
      target: { value: '17:30' },
    });
    fireEvent.change(within(dialog).getByLabelText('Motivo'), {
      target: { value: 'Olvidó marcar la salida; lo confirmó el supervisor.' },
    });
    fireEvent.click(save);
    await vi.waitFor(() => {
      expect(posted[0]?.body).toEqual({
        action: 'add',
        employeeId: '2b2b2b2b-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
        events: [{ kind: 'check_out', at: '2026-10-08T17:30:00-05:00' }],
        reason: 'Olvidó marcar la salida; lo confirmó el supervisor.',
      });
    });
    expect(await a11yViolations(document.body)).toEqual([]);
  });

  it('una marcación agregada se ve como corrección; una anulada, tachada y sin acciones', async () => {
    entries = [
      added({}),
      entry({
        voided: {
          reason: 'Marcó dos veces por error.',
          by: 'Nathan',
          at: '2026-10-08T14:00:00.000Z',
        },
      }),
    ];
    renderPage();
    const [correction, voided] = await screen.findAllByRole('listitem');
    expect(within(correction ?? document.body).getByText('Corrección')).toBeInTheDocument();
    expect(correction).toHaveTextContent('Agregada por Nathan: Olvidó marcar la salida');
    expect(voided).toHaveTextContent('AnuladaPor Nathan: Marcó dos veces por error.');
    expect(within(voided ?? document.body).queryByRole('button', { name: 'Anular' })).toBeNull();
    // Voided marks do not count.
    expect(screen.getByText('Entradas').nextSibling).toHaveTextContent('0');
  });
});
