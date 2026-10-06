// @vitest-environment node
/**
 * Enforces CLAUDE.md Regla suprema B.2: components use design tokens only.
 * Fails on raw hex colours, arbitrary colour classes or Tailwind palette
 * colours (slate-500, white…) anywhere in .tsx files.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('..', import.meta.url));

/** Official third-party brand marks whose colours are mandated by their owners. */
const allowlist: Record<string, string> = {
  'features/employee/screens/login-screen.tsx': 'Logo oficial de Google (colores obligatorios)',
};

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : [];
  });
}

const palette =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const forbidden = [
  { name: 'color hexadecimal', pattern: /#[0-9a-f]{3,8}\b/gi },
  {
    name: 'clase de color arbitraria',
    pattern: /(?:bg|text|border|ring|fill|stroke|from|to|via)-\[#/g,
  },
  {
    name: 'color de la paleta de Tailwind',
    pattern: new RegExp(
      `\\b(?:bg|text|border|ring|fill|stroke|shadow|outline|divide)-(?:white|black|(?:${palette})-\\d{2,3})\\b`,
      'g',
    ),
  },
];

describe('sin valores sueltos en componentes', () => {
  const files = tsxFiles(srcDir);

  it('encuentra los componentes a revisar', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((f) => [relative(srcDir, f).replaceAll('\\', '/'), f]))(
    '%s usa solo tokens',
    (rel, file) => {
      if (rel in allowlist) return;
      const code = readFileSync(file, 'utf8');
      const hits = forbidden.flatMap(({ name, pattern }) =>
        [...code.matchAll(pattern)].map((m) => `${name}: "${m[0]}"`),
      );
      expect(hits).toEqual([]);
    },
  );
});
