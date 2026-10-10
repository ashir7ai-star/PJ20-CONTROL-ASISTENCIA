import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { detectPlatform, isInAppBrowser, startInstallCapture } from '../../lib/install.js';
import { a11yViolations } from '../../test/a11y.js';
import { InstallInvite } from './install-app.js';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-A145M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const INSTAGRAM_IPHONE = `${IPHONE} Instagram 350.0.0.0`;

let stopCapture: () => void;

function asDevice(userAgent: string, maxTouchPoints = 5) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  // jsdom has no maxTouchPoints: define it for this test.
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: maxTouchPoints });
}

/** jsdom has no matchMedia: answer "(display-mode: standalone)" as told. */
function standalone(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches, media: query }) as MediaQueryList,
  });
}

/** As if Chrome offered installing (Android). */
function chromeOffersInstall() {
  const prompt = vi.fn(() => Promise.resolve());
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return { prompt, event };
}

// The guide is lazy: load it once so findBy* never races a cold transform.
beforeAll(async () => {
  await import('./install-guide.js');
});

beforeEach(() => {
  localStorage.clear();
  standalone(false);
  stopCapture = startInstallCapture();
});

afterEach(() => {
  stopCapture();
});

describe('detección del celular', () => {
  it('reconoce iPhone, iPad (que se presenta como Mac), Android y computador', () => {
    expect(detectPlatform(IPHONE, 5)).toBe('ios');
    expect(
      detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5),
    ).toBe('ios');
    expect(
      detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 0),
    ).toBe('other');
    expect(detectPlatform(ANDROID, 5)).toBe('android');
    expect(detectPlatform(DESKTOP, 0)).toBe('other');
  });

  it('reconoce los navegadores dentro de otras apps, que no pueden instalar', () => {
    expect(isInAppBrowser(INSTAGRAM_IPHONE)).toBe(true);
    expect(isInAppBrowser(ANDROID.replace('Android 14;', 'Android 14; wv)'))).toBe(true);
    expect(isInAppBrowser(IPHONE)).toBe(false);
    expect(isInAppBrowser(ANDROID)).toBe(false);
  });
});

describe('invitación a instalar', () => {
  it('en iPhone explica los pasos de Safari, sin barreras de accesibilidad', async () => {
    asDevice(IPHONE);
    const { container } = render(<InstallInvite />);
    expect(await a11yViolations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    const guide = await screen.findByRole('dialog', { name: 'Instala la app' });
    expect(guide).toHaveTextContent('Toca Compartir');
    expect(guide).toHaveTextContent('Agregar a pantalla de inicio');
    expect(guide).not.toHaveTextContent('Abrir en Safari');
    expect(await a11yViolations(guide)).toEqual([]);
  });

  it('dentro de Instagram pide primero abrir el enlace en Safari', async () => {
    asDevice(INSTAGRAM_IPHONE);
    render(<InstallInvite />);
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Abrir en Safari');
  });

  it('en Android con Chrome instala en un toque con el diálogo nativo', () => {
    asDevice(ANDROID);
    render(<InstallInvite />);
    const { prompt, event } = chromeOffersInstall();
    expect(event.defaultPrevented).toBe(true); // Our invitation, not Chrome's banner.
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(prompt).toHaveBeenCalledOnce();
  });

  it('en Android sin el diálogo nativo explica el menú de Chrome', async () => {
    asDevice(ANDROID);
    render(<InstallInvite />);
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Instalar app');
  });

  it('cerrarla la oculta y no vuelve a aparecer en este celular', () => {
    asDevice(IPHONE);
    const { unmount } = render(<InstallInvite />);
    fireEvent.click(screen.getByRole('button', { name: 'No mostrar de nuevo' }));
    expect(screen.queryByText('Instala la app')).toBeNull();
    unmount();
    stopCapture();
    stopCapture = startInstallCapture();
    render(<InstallInvite />);
    expect(screen.queryByText('Instala la app')).toBeNull();
  });

  it('no aparece si la app ya está instalada ni en el computador', () => {
    asDevice(IPHONE);
    stopCapture();
    standalone(true);
    stopCapture = startInstallCapture();
    const { unmount } = render(<InstallInvite />);
    expect(screen.queryByText('Instala la app')).toBeNull();
    unmount();

    asDevice(DESKTOP, 0);
    render(<InstallInvite />);
    expect(screen.queryByText('Instala la app')).toBeNull();
  });

  it('desaparece en cuanto Android confirma la instalación', () => {
    asDevice(ANDROID);
    render(<InstallInvite />);
    expect(screen.getByText('Instala la app')).toBeInTheDocument();
    fireEvent(window, new Event('appinstalled'));
    expect(screen.queryByText('Instala la app')).toBeNull();
  });
});
