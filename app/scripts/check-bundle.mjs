// Guards what every employee phone downloads on startup: the entry script and
// every chunk it imports statically (CLAUDE.md §1.5, B.12). Run after `vite build`.
//  · admin-panel code must never be there;
//  · neither may zod: the server already validates every response.
import { readFile } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
const html = await readFile(new URL('index.html', dist), 'utf8');
// Entry scripts live in assets/, whatever the base path ("/" or a GitHub Pages sub-path).
const entries = [...html.matchAll(/<script[^>]+src="[^"]*?(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
if (entries.length === 0) throw new Error('No entry script found in dist/index.html');

// Follow static imports (`from"./x.js"` / `import"./x.js"`), not dynamic `import()`.
const initial = new Set();
const pending = [...entries];
while (pending.length > 0) {
  const file = pending.pop();
  if (initial.has(file)) continue;
  initial.add(file);
  const code = await readFile(new URL(file, dist), 'utf8');
  for (const [, name] of code.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) {
    pending.push(`assets/${name}`);
  }
}

const forbidden = [
  // Strings that only exist in admin screens.
  ['panel de administración', 'Trabajando ahora'],
  ['panel de administración', 'Agregar empleado'],
  ['panel de administración', 'Solicitudes pendientes'],
  ['panel de administración', 'Exportar a Excel'],
  // Present in any zod build.
  ['zod', 'ZodError'],
];

let failed = false;
for (const file of initial) {
  const code = await readFile(new URL(file, dist), 'utf8');
  for (const [what, marker] of forbidden) {
    if (code.includes(marker)) {
      process.stderr.write(`✗ La carga inicial (${file}) contiene ${what}: "${marker}"\n`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
process.stdout.write(
  `✓ Carga inicial (${initial.size} archivos) sin panel de administración ni zod\n`,
);
