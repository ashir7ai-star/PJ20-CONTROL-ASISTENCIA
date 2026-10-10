/**
 * Creates (or updates) the login user the backup service connects with (D8),
 * as a member of `pj20_backup`: reads everything, writes only its run results.
 * Usage: node dist/db-usuario-respaldos.js   (user + password from BACKUP_DATABASE_URL)
 */
import { runLoginRoleCli } from './login-role.js';

await runLoginRoleCli(
  'BACKUP_DATABASE_URL',
  'pj20_backup',
  'respaldos',
  (user) => `✓ Usuario de respaldos «${user}» listo (solo lectura + registro de copias)`,
);
