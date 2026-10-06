/**
 * Appearance preference: automático (follows the phone), claro or oscuro.
 * Stored per device; a tiny external store keeps every ThemeMenu in sync.
 * public/theme-init.js applies the same logic before the first paint.
 */
import { useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'pj20-tema';
const THEME_COLOR = { light: '#ffffff', dark: '#050b16' } as const;

const listeners = new Set<() => void>();

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return preference;
}

export function applyTheme(preference: ThemePreference): void {
  const theme = resolveTheme(preference);
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

export function setPreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Storage unavailable: the choice still applies for this visit.
  }
  current = preference;
  applyTheme(preference);
  listeners.forEach((notify) => {
    notify();
  });
}

let current: ThemePreference = readPreference();

// "Automático" must react when the phone switches between light and dark.
if (typeof window.matchMedia === 'function') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (current === 'system') applyTheme('system');
  });
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => current);
}
