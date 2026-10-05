// Fails the build if admin-panel code leaks into the bundle every employee
// downloads (CLAUDE.md §1.5). Run after `vite build`.
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const entries = [...html.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g)].map((m) => m[1]);
if (entries.length === 0) throw new Error('No entry script found in dist/index.html');

// Strings that only exist in admin screens.
const adminMarkers = [
  'Trabajando ahora',
  'Agregar empleado',
  'Solicitudes pendientes',
  'Exportar a Excel',
];

let failed = false;
for (const entry of entries) {
  const code = await readFile(new URL(`../dist/${entry}`, import.meta.url), 'utf8');
  for (const marker of adminMarkers) {
    if (code.includes(marker)) {
      process.stderr.write(`✗ El paquete del empleado (${entry}) contiene: "${marker}"\n`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
process.stdout.write(`✓ El panel de administración no está en el paquete del empleado\n`);
