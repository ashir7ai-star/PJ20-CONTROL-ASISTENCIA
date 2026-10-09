/**
 * Real marking flow (Fase 3) with the browser APIs simulated: camera, GPS and
 * the server. Every outcome has its own screen (CLAUDE.md B.8, §8.3).
 */
import type { Me, MarkRequest } from '@pj20/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as camera from '../../lib/camera.js';
import { CameraFailure, captureFrame, openFrontCamera } from '../../lib/camera.js';
import type * as geolocation from '../../lib/geolocation.js';
import { type Fix, getBestFix, LocationFailure } from '../../lib/geolocation.js';
import { a11yViolations } from '../../test/a11y.js';
import { EmployeeHome } from './employee-home.js';

vi.mock('../../lib/camera.js', async (importOriginal) => ({
  ...(await importOriginal<typeof camera>()),
  openFrontCamera: vi.fn(),
  captureFrame: vi.fn(),
  stopCamera: vi.fn(),
}));
vi.mock('../../lib/geolocation.js', async (importOriginal) => ({
  ...(await importOriginal<typeof geolocation>()),
  getBestFix: vi.fn(),
}));

const me: Me = {
  id: '6f1d2c3b-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  name: 'Laura Gómez',
  email: 'laura@gmail.com',
  role: 'employee',
  consentRequired: false,
  selfieAuthorized: true,
};

const goodFix: Fix = {
  latitude: 3.4516,
  longitude: -76.532,
  accuracyM: 8,
  capturedAt: new Date('2026-10-08T12:00:00Z'),
};

const SERVER_TIME = '2026-10-08T12:58:00.000Z';

interface Reply {
  status: number;
  json?: unknown;
}
let status: Reply;
let markReply: Reply;
let sent: MarkRequest | undefined;

function respond({ status: code, json }: Reply) {
  return Promise.resolve(
    new Response(json === undefined ? null : JSON.stringify(json), {
      status: code,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  sent = undefined;
  status = { status: 200, json: { onDutySince: null, lastRecord: null } };
  markReply = {
    status: 201,
    json: {
      id: '0b0b0b0b-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
      kind: 'check_in',
      serverTime: SERVER_TIME,
      accuracyM: 8,
      reviewStatus: 'ok',
      reviewReasons: [],
    },
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === '/api/v1/attendance/status') return respond(status);
    if (url === '/api/v1/attendance' && init?.method === 'POST') {
      sent = JSON.parse(typeof init.body === 'string' ? init.body : '{}') as MarkRequest;
      return respond(markReply);
    }
    return Promise.reject(new Error(`Ruta no simulada: ${url}`));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.mocked(openFrontCamera).mockResolvedValue({ getTracks: () => [] } as unknown as MediaStream);
  vi.mocked(captureFrame).mockResolvedValue('Zm90bw==');
  vi.mocked(getBestFix).mockResolvedValue(goodFix);
});

afterEach(() => {
  vi.mocked(openFrontCamera).mockReset();
  vi.mocked(captureFrame).mockReset();
  vi.mocked(getBestFix).mockReset();
});

const onSessionExpired = vi.fn();

function renderHome() {
  render(
    <EmployeeHome
      me={me}
      onMeChange={vi.fn()}
      onLogout={vi.fn()}
      onSessionExpired={onSessionExpired}
    />,
  );
}

async function startMarking() {
  renderHome();
  fireEvent.click(await screen.findByRole('button', { name: /Marcar entrada/ }));
}

describe('Marcar con datos reales', () => {
  it('muestra el estado del turno que dice el servidor, sin pedir la ubicación antes de marcar', async () => {
    status = {
      status: 200,
      json: {
        onDutySince: '2026-10-08T12:58:00.000Z',
        lastRecord: { kind: 'check_in', at: '2026-10-08T12:58:00.000Z' },
      },
    };
    renderHome();
    expect(await screen.findByText(/En turno desde 7:58/)).toBeInTheDocument();
    expect(screen.getByText('Ubicación al marcar')).toBeInTheDocument();
    expect(getBestFix).not.toHaveBeenCalled();
  });

  it('la primera vez explica los permisos; luego marca en 2 toques y confirma con la hora del servidor', async () => {
    await startMarking();
    fireEvent.click(await screen.findByRole('button', { name: 'Permitir acceso' }));

    expect(await screen.findByText(/Ubicación lista · ± 8 m/)).toBeInTheDocument();
    expect(await a11yViolations(document.body)).toEqual([]);

    status = {
      status: 200,
      json: { onDutySince: SERVER_TIME, lastRecord: { kind: 'check_in', at: SERVER_TIME } },
    };
    fireEvent.click(screen.getByRole('button', { name: 'Tomar selfie y marcar' }));

    expect(await screen.findByRole('heading', { name: 'Entrada registrada' })).toBeInTheDocument();
    expect(screen.getByText('7:58')).toBeInTheDocument();
    expect(sent).toMatchObject({
      kind: 'check_in',
      photo: 'Zm90bw==',
      location: { latitude: 3.4516, longitude: -76.532, accuracyM: 8 },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(await screen.findByText(/En turno desde 7:58/)).toBeInTheDocument();
  });

  it('la segunda vez va directo a la cámara (sin repetir la explicación)', async () => {
    localStorage.setItem('pj20.permisos-explicados', '1');
    await startMarking();
    expect(
      await screen.findByRole('button', { name: 'Tomar selfie y marcar' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Permitir acceso' })).toBeNull();
  });

  it('cámara bloqueada: explica cómo permitirla', async () => {
    localStorage.setItem('pj20.permisos-explicados', '1');
    vi.mocked(openFrontCamera).mockRejectedValue(new CameraFailure('permission-denied'));
    await startMarking();
    expect(await screen.findByRole('heading', { name: 'Permiso bloqueado' })).toBeInTheDocument();
    expect(screen.getByText(/permite la cámara/)).toBeInTheDocument();
  });

  it('ubicación bloqueada o GPS apagado: cada uno con su pantalla', async () => {
    localStorage.setItem('pj20.permisos-explicados', '1');
    vi.mocked(getBestFix).mockRejectedValue(new LocationFailure('permission-denied'));
    await startMarking();
    expect(await screen.findByText(/permite la ubicación/)).toBeInTheDocument();
  });

  it('GPS apagado: pide activar la ubicación', async () => {
    localStorage.setItem('pj20.permisos-explicados', '1');
    vi.mocked(getBestFix).mockRejectedValue(new LocationFailure('unavailable'));
    await startMarking();
    expect(await screen.findByRole('heading', { name: 'Activa la ubicación' })).toBeInTheDocument();
  });

  it('señal débil: avisa el margen real y permite marcar de todas formas (queda para revisión)', async () => {
    localStorage.setItem('pj20.permisos-explicados', '1');
    vi.mocked(getBestFix).mockResolvedValue({ ...goodFix, accuracyM: 250 });
    markReply = {
      status: 201,
      json: {
        id: '0b0b0b0b-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
        kind: 'check_in',
        serverTime: SERVER_TIME,
        accuracyM: 250,
        reviewStatus: 'pending',
        reviewReasons: ['low_accuracy'],
      },
    };
    await startMarking();
    fireEvent.click(await screen.findByRole('button', { name: 'Tomar selfie y marcar' }));
    expect(await screen.findByText(/margen de ± 250 m/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Marcar de todas formas' }));
    expect(await screen.findByRole('heading', { name: 'Entrada registrada' })).toBeInTheDocument();
    expect(screen.getByText(/tu administrador la revisará/)).toBeInTheDocument();
  });

  it('si el servidor rechaza la marcación, muestra su motivo en español', async () => {
    localStorage.setItem('pj20.permisos-explicados', '1');
    markReply = {
      status: 422,
      json: {
        error: {
          code: 'RULE_VIOLATION',
          message: 'Ya tienes una entrada registrada. Marca tu salida primero.',
        },
      },
    };
    await startMarking();
    fireEvent.click(await screen.findByRole('button', { name: 'Tomar selfie y marcar' }));
    expect(
      await screen.findByRole('heading', { name: 'No se pudo registrar' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Marca tu salida primero/)).toBeInTheDocument();
  });

  it('sin conexión no se marca: lo explica (la hora la pone el servidor)', async () => {
    localStorage.setItem('pj20.permisos-explicados', '1');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await startMarking();
    expect(
      await screen.findByRole('heading', { name: 'Sin conexión a internet' }),
    ).toBeInTheDocument();
    expect(openFrontCamera).not.toHaveBeenCalled();
  });

  it('sesión vencida al marcar: vuelve al inicio de sesión', async () => {
    localStorage.setItem('pj20.permisos-explicados', '1');
    markReply = {
      status: 401,
      json: { error: { code: 'SESSION_REQUIRED', message: 'Tu sesión terminó.' } },
    };
    await startMarking();
    fireEvent.click(await screen.findByRole('button', { name: 'Tomar selfie y marcar' }));
    await vi.waitFor(() => {
      expect(onSessionExpired).toHaveBeenCalled();
    });
  });

  it('cancelar en la cámara vuelve a Marcar sin registrar nada', async () => {
    localStorage.setItem('pj20.permisos-explicados', '1');
    await startMarking();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('button', { name: /Marcar entrada/ })).toBeInTheDocument();
    expect(sent).toBeUndefined();
  });

  it('sin autorización de selfie marca solo con ubicación: nunca abre la cámara (D7)', async () => {
    localStorage.setItem('pj20.permisos-explicados', '1');
    markReply = {
      status: 201,
      json: {
        id: '0b0b0b0b-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
        kind: 'check_in',
        serverTime: SERVER_TIME,
        accuracyM: 8,
        reviewStatus: 'ok',
        reviewReasons: [],
        withSelfie: false,
      },
    };
    render(
      <EmployeeHome
        me={{ ...me, selfieAuthorized: false }}
        onMeChange={vi.fn()}
        onLogout={vi.fn()}
        onSessionExpired={onSessionExpired}
      />,
    );
    expect(await screen.findByText('Sin selfie')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Marcar entrada/ }));
    expect(await screen.findByRole('heading', { name: 'Entrada registrada' })).toBeInTheDocument();
    expect(openFrontCamera).not.toHaveBeenCalled();
    expect(sent).not.toHaveProperty('photo');
    expect(screen.getByText('No autorizada')).toBeInTheDocument();
  });

  it('desde el menú de la cuenta puede retirar la autorización de la selfie', async () => {
    const onMeChange = vi.fn();
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === '/api/v1/attendance/status') return respond(status);
      if (url === '/api/v1/me/selfie-authorization' && init?.method === 'PUT') {
        expect(init.body).toBe(JSON.stringify({ authorized: false }));
        return respond({ status: 200, json: { ...me, selfieAuthorized: false } });
      }
      return Promise.reject(new Error(`Ruta no simulada: ${url}`));
    });
    render(
      <EmployeeHome
        me={me}
        onMeChange={onMeChange}
        onLogout={vi.fn()}
        onSessionExpired={onSessionExpired}
      />,
    );
    fireEvent.keyDown(await screen.findByRole('button', { name: 'Cuenta y apariencia' }), {
      key: 'Enter',
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Autorización de selfie' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retirar autorización' }));
    await vi.waitFor(() => {
      expect(onMeChange).toHaveBeenCalledWith(expect.objectContaining({ selfieAuthorized: false }));
    });
  });
});
