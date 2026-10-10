// @vitest-environment node
/**
 * The service worker (public/sw.js) must never serve or store /api: marking,
 * the session and personal data always go to the server (CLAUDE.md §2.7, D9).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type Strategy = 'network' | 'page' | 'asset' | 'static';
type StrategyFor = (
  url: URL,
  request: { method: string; mode: string; origin: string },
) => Strategy;

const source = readFileSync(fileURLToPath(new URL('../public/sw.js', import.meta.url)), 'utf8');
// Outside a worker (`self` undefined) the file only defines its functions.
// eslint-disable-next-line @typescript-eslint/no-implied-eval -- our own file, read from disk
const load = new Function('self', `${source}\nreturn strategyFor;`) as (
  self: undefined,
) => StrategyFor;
const strategyFor = load(undefined);

const ORIGIN = 'https://asistencia.example.com';
const get = (path: string, mode = 'cors', method = 'GET') =>
  strategyFor(new URL(path, ORIGIN), { method, mode, origin: ORIGIN });

describe('service worker: qué guarda y qué no', () => {
  it('nunca intercepta la API, ni siquiera al navegar (inicio de sesión con Google)', () => {
    for (const path of [
      '/api/v1/me',
      '/api/v1/attendance/status',
      '/api/v1/admin/attendance/1/selfie',
      '/api/health',
    ]) {
      expect(get(path)).toBe('network');
    }
    expect(get('/api/v1/auth/google/start', 'navigate')).toBe('network');
    expect(get('/api/v1/attendance', 'cors', 'POST')).toBe('network');
  });

  it('nada que no sea GET ni de otro dominio', () => {
    expect(get('/', 'navigate', 'POST')).toBe('network');
    expect(
      strategyFor(new URL('https://accounts.google.com/gsi/client'), {
        method: 'GET',
        mode: 'no-cors',
        origin: ORIGIN,
      }),
    ).toBe('network');
  });

  it('las páginas de la app primero desde la red; los archivos con huella, guardados', () => {
    expect(get('/', 'navigate')).toBe('page');
    expect(get('/admin', 'navigate')).toBe('page');
    expect(get('/assets/index-3f9a1c.js')).toBe('asset');
    expect(get('/icons/icon-192.png')).toBe('static');
    expect(get('/manifest.webmanifest')).toBe('static');
  });

  it('el propio service worker siempre se pide a la red (así llegan las actualizaciones)', () => {
    expect(get('/sw.js')).toBe('network');
  });
});
