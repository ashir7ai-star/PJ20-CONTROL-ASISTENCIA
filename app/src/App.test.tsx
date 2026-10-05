import type { HealthResponse } from '@pj20/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App.js';

function mockFetchJson(body: HealthResponse, status = 200) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

const timestamp = new Date().toISOString();

describe('App', () => {
  it('shows every service as operational when the API is healthy', async () => {
    mockFetchJson({
      status: 'ok',
      checks: { database: 'up', cache: 'up', storage: 'up' },
      timestamp,
    });
    render(<App />);

    expect(await screen.findByText('Todos los servicios están operativos.')).toBeInTheDocument();
    expect(screen.getAllByText('Operativo')).toHaveLength(3);
  });

  it('shows which service is down when the API is degraded', async () => {
    mockFetchJson(
      { status: 'degraded', checks: { database: 'up', cache: 'down', storage: 'up' }, timestamp },
      503,
    );
    render(<App />);

    expect(await screen.findByText('Algunos servicios no están disponibles.')).toBeInTheDocument();
    expect(screen.getAllByText('Sin servicio')).toHaveLength(1);
  });

  it('explains the problem and allows retrying when the server is unreachable', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    render(<App />);

    expect(await screen.findByText(/No hay conexión con el servidor/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Verificar de nuevo' }));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('treats a malformed response as unreachable instead of crashing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>proxy error</html>'));
    render(<App />);

    expect(await screen.findByText(/No hay conexión con el servidor/)).toBeInTheDocument();
  });
});
