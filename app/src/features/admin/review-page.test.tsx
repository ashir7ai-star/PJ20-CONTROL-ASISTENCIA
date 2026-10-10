import type { AdminAttendanceEntry, Me } from '@pj20/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { a11yViolations } from '../../test/a11y.js';
import { ReviewPage } from './review-page.js';

const admin: Me = {
  id: '1a1a1a1a-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  name: 'Nathan',
  email: 'nathan@ylevigroup.com',
  role: 'admin',
  consentRequired: false,
  selfieAuthorized: true,
};

const flagged: AdminAttendanceEntry = {
  source: 'record',
  id: '0c0c0c0c-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  employee: { id: '3c3c3c3c-1a2b-4c3d-8e9f-0a1b2c3d4e5f', name: 'Tomás Guerrero', email: 't@g.co' },
  kind: 'check_in',
  serverTime: '2026-10-07T12:19:00.000Z',
  deviceTime: '2026-10-07T12:19:01.000Z',
  latitude: 3.4516,
  longitude: -76.532,
  accuracyM: 240,
  reviewStatus: 'pending',
  reviewReasons: ['low_accuracy', 'stale_location'],
  ip: '190.1.2.3',
  userAgent: 'Android',
  selfie: 'not-authorized',
  verdict: null,
  voided: null,
};

let queue: AdminAttendanceEntry[];
let posted: { url: string; body: unknown }[];

beforeEach(() => {
  queue = [flagged];
  posted = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (init?.method === 'POST') {
      posted.push({ url, body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
      queue = [];
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    const body = url === '/api/v1/me' ? admin : url === '/api/v1/admin/review' ? queue : null;
    if (body === null) return Promise.reject(new Error(`Ruta no simulada: ${url}`));
    return Promise.resolve(
      new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
    );
  });
});

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/admin/revisar', element: <ReviewPage /> },
      { path: '/', element: <p>Marcar</p> },
    ],
    { initialEntries: ['/admin/revisar'] },
  );
  render(<RouterProvider router={router} />);
}

describe('Por revisar (Fase 6)', () => {
  it('muestra cada marcación dudosa con su fecha, sus señales y las acciones', async () => {
    renderPage();
    const [card] = await screen.findAllByRole('listitem');
    const item = within(card ?? document.body);
    expect(item.getByText('Tomás Guerrero')).toBeInTheDocument();
    expect(item.getByText(/^7\sde\soct$/)).toBeInTheDocument();
    expect(item.getByText(/Por revisar: GPS impreciso · Ubicación vieja/)).toBeInTheDocument();
    expect(item.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument();
    expect(item.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
    expect(await a11yViolations(document.body)).toEqual([]);
  });

  it('al aprobar la última, queda «Todo al día»', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    expect(await screen.findByText('Todo al día')).toBeInTheDocument();
    expect(posted).toEqual([
      {
        url: `/api/v1/admin/attendance/${flagged.id}/review`,
        body: { decision: 'approved' },
      },
    ]);
  });

  it('sin pendientes muestra el estado vacío', async () => {
    queue = [];
    renderPage();
    expect(await screen.findByText('Todo al día')).toBeInTheDocument();
  });
});
