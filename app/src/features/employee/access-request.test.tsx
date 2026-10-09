import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { a11yViolations } from '../../test/a11y.js';
import { AccessRequest } from './access-request.js';

interface Reply {
  status: number;
  json?: unknown;
}

let current: Reply;
let create: Reply;
let posted = 0;

beforeEach(() => {
  posted = 0;
  current = {
    status: 200,
    json: { name: 'Sofía Ortiz', email: 'sofia@gmail.com', pending: false },
  };
  create = { status: 200, json: { status: 'created' } };
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const reply =
      url === '/api/v1/access-requests/current'
        ? current
        : url === '/api/v1/access-requests' && init?.method === 'POST'
          ? ((posted += 1), create)
          : null;
    if (!reply) return Promise.reject(new Error(`Ruta no simulada: ${url}`));
    return Promise.resolve(
      new Response(reply.json === undefined ? null : JSON.stringify(reply.json), {
        status: reply.status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
});

const onExit = vi.fn();

describe('cuenta no autorizada: solicitar acceso (D6)', () => {
  it('muestra la cuenta verificada, el aviso de privacidad y envía la solicitud', async () => {
    render(<AccessRequest onExit={onExit} />);
    expect(await screen.findByText(/Entraste como Sofía Ortiz \(sofia@gmail.com\)/)).toBeVisible();
    expect(screen.getByText(/Enviaremos tu nombre y tu correo de Google/)).toBeVisible();
    expect(await a11yViolations(document.body)).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Solicitar acceso' }));
    expect(await screen.findByRole('heading', { name: 'Solicitud enviada' })).toBeVisible();
    expect(posted).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(onExit).toHaveBeenCalled();
  });

  it('si ya pidió acceso, avisa que está pendiente en vez de pedir otra vez', async () => {
    current = { status: 200, json: { name: 'Sofía', email: 'sofia@gmail.com', pending: true } };
    render(<AccessRequest onExit={onExit} />);
    expect(
      await screen.findByRole('heading', { name: 'Tu solicitud está pendiente' }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Solicitar acceso' })).toBeNull();
  });

  it('sin comprobante (pasó el tiempo) muestra solo el aviso de cuenta no autorizada', async () => {
    current = { status: 404, json: { error: { code: 'NOT_FOUND', message: 'No existe.' } } };
    render(<AccessRequest onExit={onExit} />);
    expect(
      await screen.findByRole('heading', { name: 'Tu cuenta no está autorizada' }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Solicitar acceso' })).toBeNull();
  });

  it('si el envío falla, explica qué hacer y permite reintentar', async () => {
    create = { status: 404, json: { error: { code: 'NOT_FOUND', message: 'No existe.' } } };
    render(<AccessRequest onExit={onExit} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar acceso' }));
    expect(await screen.findByText(/Vuelve a entrar con Google/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Solicitar acceso' })).toBeEnabled();
  });
});
