import type { Me } from '@pj20/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { RealApp } from './real-app.js';

vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test.apps.googleusercontent.com');

const laura: Me = {
  id: '6f1d2c3b-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  name: 'Laura Gómez',
  email: 'laura@gmail.com',
  role: 'employee',
  consentRequired: false,
  selfieAuthorized: true,
};

type Handler = (body: unknown) => { status: number; json?: unknown };
let routes: Record<string, Handler>;
let calls: string[];
let googleConfig: { ux_mode: string; login_uri: string; nonce: string } | undefined;

function json(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const notLoggedIn: Handler = () => ({
  status: 401,
  json: { error: { code: 'SESSION_REQUIRED', message: 'Tu sesión terminó.' } },
});

// The signed-in screens are lazy: load them once so findBy* never races a cold transform.
beforeAll(async () => {
  await Promise.all([
    import('../features/employee/employee-home.js'),
    import('../features/employee/screens/consent-screen.js'),
  ]);
});

beforeEach(() => {
  calls = [];
  routes = {
    'GET /api/v1/me': notLoggedIn,
    'POST /api/v1/auth/nonce': () => ({ status: 200, json: { nonce: 'nonce-de-prueba-123456' } }),
    'POST /api/v1/auth/logout': () => ({ status: 204 }),
    'GET /api/v1/attendance/status': () => ({
      status: 200,
      json: { onDutySince: null, lastRecord: null },
    }),
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const key = `${init?.method ?? 'GET'} ${url}`;
    calls.push(key);
    const handler = routes[key];
    if (!handler) return Promise.reject(new Error(`Ruta no simulada: ${key}`));
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const { status, json: payload } = handler(body);
    return Promise.resolve(json(status, payload));
  });

  // Google Identity Services stub. In redirect mode (D5) the button leaves the
  // page for Google; the tests check how it was configured and then simulate
  // the return (?acceso=… or an open session).
  googleConfig = undefined;
  window.google = {
    accounts: {
      id: {
        initialize: (config) => {
          googleConfig = config;
        },
        renderButton: (parent) => {
          const button = document.createElement('button');
          button.textContent = 'Continuar con Google';
          parent.appendChild(button);
        },
      },
    },
  };
});

afterEach(() => {
  delete window.google;
});

function renderApp(entry = '/') {
  const router = createMemoryRouter(
    [
      { path: '/', element: <RealApp /> },
      { path: '/admin', element: <p>Panel del administrador</p> },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('app real: sesión → consentimiento → Marcar', () => {
  it('sin sesión muestra el botón oficial de Google en modo redirección (funciona en iPhone)', async () => {
    renderApp();
    expect(await screen.findByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument();
    expect(googleConfig).toMatchObject({
      ux_mode: 'redirect',
      login_uri: 'http://localhost:3000/api/v1/auth/google/redirect',
      nonce: 'nonce-de-prueba-123456',
    });
  });

  it('al volver de Google con sesión abierta pide el consentimiento y luego muestra Marcar', async () => {
    let consented = false;
    routes['GET /api/v1/me'] = () => ({ status: 200, json: { ...laura, consentRequired: true } });
    routes['POST /api/v1/me/consent'] = (body) => {
      expect(body).toMatchObject({ selfie: true });
      consented = true;
      return { status: 204 };
    };
    renderApp();
    expect(
      await screen.findByRole('heading', { name: 'Tus datos, con transparencia' }),
    ).toBeInTheDocument();

    routes['GET /api/v1/me'] = () => ({ status: 200, json: laura });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('radio', { name: 'Sí, autorizo la selfie' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar y continuar' }));

    expect(await screen.findByText(/Hola, Laura/)).toBeInTheDocument();
    expect(consented).toBe(true);
    expect(screen.queryByRole('button', { name: /panel de administración/i })).toBeNull();
  });

  it('una cuenta no autorizada ve el mensaje claro y la dirección queda limpia', async () => {
    const router = renderApp('/?acceso=no-autorizada');
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu cuenta no está autorizada');
    expect(router.state.location.search).toBe('');
  });

  it('un error de verificación se explica sobre el botón', async () => {
    renderApp('/?acceso=error');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos verificar tu cuenta de Google.',
    );
  });

  it('con sesión de administrador, Marcar ofrece ir al panel', async () => {
    routes['GET /api/v1/me'] = () => ({ status: 200, json: { ...laura, role: 'admin' } });
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Ir al panel de administración' }));
    expect(await screen.findByText('Panel del administrador')).toBeInTheDocument();
  });

  it('cerrar sesión vuelve a la pantalla de inicio de sesión', async () => {
    routes['GET /api/v1/me'] = () => ({ status: 200, json: laura });
    renderApp();
    fireEvent.keyDown(await screen.findByRole('button', { name: 'Cuenta y apariencia' }), {
      key: 'Enter',
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument();
    expect(calls).toContain('POST /api/v1/auth/logout');
  });

  it('si el inicio de sesión no carga, lo dice una sola vez (sin bucle) y permite reintentar', async () => {
    routes['POST /api/v1/auth/nonce'] = () => ({
      status: 502,
      json: { error: { code: 'INTERNAL_ERROR', message: 'Servidor no disponible.' } },
    });
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cargar el inicio de sesión',
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(calls.filter((c) => c === 'POST /api/v1/auth/nonce')).toHaveLength(1);

    routes['POST /api/v1/auth/nonce'] = () => ({
      status: 200,
      json: { nonce: 'nonce-de-prueba-123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sin conexión con el servidor muestra el aviso correspondiente', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError('offline'));
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión a internet');
  });

  it('quien aceptó antes de que la selfie fuera opcional decide ahora sobre ella', async () => {
    routes['GET /api/v1/me'] = () => ({ status: 200, json: { ...laura, selfieAuthorized: null } });
    routes['PUT /api/v1/me/selfie-authorization'] = (body) => {
      expect(body).toEqual({ authorized: false });
      return { status: 200, json: { ...laura, selfieAuthorized: false } };
    };
    renderApp();
    expect(
      await screen.findByRole('heading', { name: 'Tu decisión sobre la selfie' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'No autorizo la selfie' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar mi decisión' }));
    expect(await screen.findByText(/Hola, Laura/)).toBeInTheDocument();
  });
});

describe('app instalada en iPhone: inicio de sesión en una ventana de la app (D9)', () => {
  let opened: string[];

  beforeEach(() => {
    opened = [];
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    vi.spyOn(window, 'open').mockImplementation((url) => {
      opened.push(String(url));
      return {} as Window;
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'standalone');
  });

  /** Sign-in screen shown and its effects (the window listener) attached. */
  async function signInScreen() {
    renderApp();
    await screen.findByRole('button', { name: 'Continuar con Google' });
    await act(() => Promise.resolve());
  }

  /** What public/acceso-listo.js does in the sign-in window. */
  function windowReports(outcome: string) {
    const channel = new BroadcastChannel('pj20-acceso');
    channel.postMessage(outcome);
    channel.close();
  }

  it('el botón abre la ventana de inicio de sesión en el mismo toque, sin el botón de Google en la página', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar con Google' }));
    expect(opened).toEqual(['/api/v1/auth/google/start']);
    expect(googleConfig).toBeUndefined();
    expect(calls).not.toContain('POST /api/v1/auth/nonce');
  });

  it('cuando la ventana avisa que entró, la app lee la sesión y muestra Marcar', async () => {
    await signInScreen();
    routes['GET /api/v1/me'] = () => ({ status: 200, json: laura });
    windowReports('ok');
    expect(await screen.findByText(/Hola, Laura/)).toBeInTheDocument();
  });

  it('una cuenta no autorizada pasa a la solicitud de acceso', async () => {
    await signInScreen();
    windowReports('no-autorizada');
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu cuenta no está autorizada');
  });

  it('un fallo se explica; un mensaje ajeno se ignora', async () => {
    await signInScreen();
    windowReports('<script>');
    windowReports('error');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos verificar tu cuenta de Google',
    );
  });

  it('si el aviso no llega, al volver a la app entra solo si hay sesión', async () => {
    await signInScreen();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument();
    routes['GET /api/v1/me'] = () => ({ status: 200, json: laura });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(await screen.findByText(/Hola, Laura/)).toBeInTheDocument();
  });
});
