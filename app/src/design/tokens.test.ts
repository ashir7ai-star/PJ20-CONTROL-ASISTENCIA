// @vitest-environment node
/**
 * Guards WCAG 2.1 AA contrast for every text/background token pair,
 * in both light and dark themes, straight from index.css.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');

function extractVars(block: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const match of block.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    const [, name, value] = match;
    if (name && value) vars[name] = value.toLowerCase();
  }
  return vars;
}

const lightBlock = /@theme\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
const darkBlock = /:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
const light = extractVars(lightBlock);
const dark = { ...light, ...extractVars(darkBlock) };

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** [text token, background token] pairs that carry readable text. */
const textPairs: [string, string][] = [
  ['ink', 'canvas'],
  ['ink', 'surface'],
  ['ink', 'surface-raised'],
  ['ink-muted', 'canvas'],
  ['ink-muted', 'surface'],
  ['ink-muted', 'surface-raised'],
  ['link', 'canvas'],
  ['link', 'surface-raised'],
  ['primary-ink', 'primary'],
  ['check-in-ink', 'check-in'],
  ['check-out-ink', 'check-out'],
  ['check-in-ink', 'check-in-from'],
  ['check-in-ink', 'check-in-to'],
  ['check-out-ink', 'check-out-from'],
  ['check-out-ink', 'check-out-to'],
  ['success', 'canvas'],
  ['success', 'success-soft'],
  ['warning', 'canvas'],
  ['warning', 'warning-soft'],
  ['danger', 'canvas'],
  ['danger', 'danger-soft'],
  ['info', 'canvas'],
  ['info', 'info-soft'],
  ['canvas', 'danger'],
];

describe.each([
  ['claro', light],
  ['oscuro', dark],
])('contraste de tokens · tema %s', (_theme, vars) => {
  it.each(textPairs)('%s sobre %s cumple AA (≥ 4.5:1)', (fg, bg) => {
    const fgValue = vars[fg];
    const bgValue = vars[bg];
    expect(fgValue, `token --color-${fg} no definido`).toBeDefined();
    expect(bgValue, `token --color-${bg} no definido`).toBeDefined();
    expect(contrast(fgValue ?? '', bgValue ?? '')).toBeGreaterThanOrEqual(4.5);
  });

  it('el foco es visible sobre el fondo (≥ 3:1, WCAG 1.4.11)', () => {
    expect(contrast(vars.focus ?? '', vars.canvas ?? '')).toBeGreaterThanOrEqual(3);
  });
});

describe('extracción de tokens', () => {
  it('lee ambos temas desde index.css', () => {
    expect(Object.keys(light).length).toBeGreaterThan(20);
    expect(dark.canvas).not.toBe(light.canvas);
  });
});

describe('control negativo (la prueba detecta fallas reales)', () => {
  it('texto blanco sobre el verde de marca NO cumple AA (por eso se usa azul marino)', () => {
    expect(contrast('#ffffff', light['brand-green'] ?? '')).toBeLessThan(4.5);
  });

  it('texto blanco sobre el azul de marca NO cumple AA', () => {
    expect(contrast('#ffffff', light['brand-blue'] ?? '')).toBeLessThan(4.5);
  });
});
