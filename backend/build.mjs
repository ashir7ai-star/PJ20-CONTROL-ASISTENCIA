// Bundles the API into a single ESM file. Workspace packages (@pj20/*) are
// inlined because they ship TypeScript source; every other dependency stays
// external and is installed in the production image.
import { readFile } from 'node:fs/promises';

import { build } from 'esbuild';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith('@pj20/'));

await build({
  // API + operational commands (run inside the container on deploy).
  entryPoints: {
    server: 'src/server.ts',
    migrate: 'src/db/migrate.ts',
    'db-usuario-app': 'src/db/setup-app-user.ts',
    'db-usuario-respaldos': 'src/db/setup-backup-user.ts',
    'admin-crear': 'src/cli/create-admin.ts',
    'reiniciar-datos': 'src/cli/reset-data.ts',
    'contar-registros': 'src/cli/count-records.ts',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  external,
  logLevel: 'info',
});
