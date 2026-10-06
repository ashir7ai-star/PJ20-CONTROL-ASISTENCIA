import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { readPreference, resolveTheme, setPreference } from '../../lib/theme.js';
import { a11yViolations } from '../../test/a11y.js';
import { ThemeMenu } from './theme-menu.js';

afterEach(() => {
  setPreference('system');
});

const theme = () => document.documentElement.getAttribute('data-theme');

describe('preferencia de apariencia', () => {
  it('por defecto sigue al sistema (claro cuando el sistema no dice nada)', () => {
    expect(readPreference()).toBe('system');
    expect(resolveTheme('system')).toBe('light');
  });

  it('elegir "Oscuro" aplica el tema, actualiza la barra del navegador y se recuerda', () => {
    setPreference('dark');
    expect(theme()).toBe('dark');
    expect(localStorage.getItem('pj20-tema')).toBe('dark');
    expect(readPreference()).toBe('dark');
  });

  it('volver a "Automático" borra la preferencia guardada', () => {
    setPreference('dark');
    setPreference('system');
    expect(localStorage.getItem('pj20-tema')).toBeNull();
    expect(theme()).toBe('light');
  });
});

describe('ThemeMenu', () => {
  function open() {
    render(<ThemeMenu />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Apariencia' }), { key: 'Enter' });
  }

  it('ofrece Automático, Claro y Oscuro, con la opción actual marcada', async () => {
    open();
    const options = await screen.findAllByRole('menuitemradio');
    expect(options.map((o) => o.textContent)).toEqual([
      'AutomáticoIgual que el celular',
      'Claro',
      'Oscuro',
    ]);
    expect(options[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('cambia a oscuro al elegirlo', async () => {
    open();
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Oscuro' }));
    expect(theme()).toBe('dark');
  });

  it('es accesible', async () => {
    open();
    await screen.findAllByRole('menuitemradio');
    expect(await a11yViolations(document.body)).toEqual([]);
  });
});
