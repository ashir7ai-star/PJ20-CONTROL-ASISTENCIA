// Bundles the API into a single ESM file. Workspace packages (@pj20/*) are
// inlined because they ship TypeScript source; every other dependency stays
// external and is installed in the production image.
import { readFile } from 'node:fs/promises';

import { build } from 'esbuild';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith('@pj20/'));

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  external,
  logLevel: 'info',
});
