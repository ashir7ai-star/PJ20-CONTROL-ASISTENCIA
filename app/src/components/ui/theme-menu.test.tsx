import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { readPreference, resolveTheme, setPreference } from '../../lib/theme.js';
import { a11yViolations } from '../../test/a11y.js';
import { ThemeMenu } from './theme-menu.js';

afterEach(() => {
  setPreference('dark');
});

const theme = () => document.documentElement.getAttribute('data-theme');

describe('preferencia de apariencia', () => {
  it('por defecto es oscuro, aunque el celular esté en claro', () => {
    localStorage.clear();
    expect(readPreference()).toBe('dark');
    expect(resolveTheme(readPreference())).toBe('dark');
  });

  it('elegir "Claro" aplica el tema, actualiza la barra del navegador y se recuerda', () => {
    // index.html ships this tag; the test document does not.
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
    setPreference('light');
    expect(theme()).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#ffffff',
    );
    expect(localStorage.getItem('pj20-tema')).toBe('light');
    expect(readPreference()).toBe('light');
    meta.remove();
  });

  it('"Automático" se recuerda y sigue al celular (claro cuando el sistema no dice nada)', () => {
    setPreference('system');
    expect(localStorage.getItem('pj20-tema')).toBe('system');
    expect(readPreference()).toBe('system');
    expect(theme()).toBe('light');
  });

  it('volver a "Oscuro" (el predeterminado) borra la preferencia guardada', () => {
    setPreference('light');
    setPreference('dark');
    expect(localStorage.getItem('pj20-tema')).toBeNull();
    expect(theme()).toBe('dark');
  });
});

describe('ThemeMenu', () => {
  function open() {
    render(<ThemeMenu />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Apariencia' }), { key: 'Enter' });
  }

  it('ofrece Oscuro (predeterminado), Claro y Automático, con la opción actual marcada', async () => {
    open();
    const options = await screen.findAllByRole('menuitemradio');
    expect(options.map((o) => o.textContent)).toEqual([
      'Oscuro',
      'Claro',
      'AutomáticoIgual que el celular',
    ]);
    expect(options[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('cambia a claro al elegirlo', async () => {
    open();
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Claro' }));
    expect(theme()).toBe('light');
  });

  it('es accesible', async () => {
    open();
    await screen.findAllByRole('menuitemradio');
    expect(await a11yViolations(document.body)).toEqual([]);
  });
});
