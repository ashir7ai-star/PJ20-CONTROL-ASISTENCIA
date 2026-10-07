import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './migrations',
  // Only used by `drizzle-kit` commands (owner role); the API never uses it.
  dbCredentials: { url: process.env.DATABASE_MIGRATION_URL ?? '' },
  strict: true,
  verbose: true,
});
