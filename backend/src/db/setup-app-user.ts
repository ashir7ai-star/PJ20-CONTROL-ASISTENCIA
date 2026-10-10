/**
 * Creates (or updates) the login user the API connects with, as a member of
 * the least-privilege group role `pj20_app`. Idempotent.
 * Usage: pnpm db:usuario-app   (user + password from DATABASE_URL)
 */
import { runLoginRoleCli } from './login-role.js';

await runLoginRoleCli(
  'DATABASE_URL',
  'pj20_app',
  'API',
  (user) =>
    `✓ Usuario de la API «${user}» listo (miembro de pj20_app, sin privilegios de administración)`,
);
