import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4400),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Comma-separated list of origins allowed to call the API (the PWA). */
  APP_ORIGINS: z
    .string()
    .min(1)
    .transform((value) => value.split(',').map((origin) => origin.trim()))
    .pipe(z.array(z.url())),

  /** Restricted API user (member of pj20_app), never the owner role. */
  DATABASE_URL: z.url(),

  /** Google Sign-In client id (public). Used to validate ID tokens (D1). */
  GOOGLE_CLIENT_ID: z.string().regex(/^[\w-]+\.apps\.googleusercontent\.com$/),
  /** Reverse-proxy hops in front of the API (Easypanel/Traefik: 1). */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  REDIS_URL: z.url(),

  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(3),
});

export type Env = z.infer<typeof envSchema>;

export class InvalidEnvError extends Error {
  constructor(readonly invalidKeys: string[]) {
    super(`Invalid or missing environment variables: ${invalidKeys.join(', ')}`);
    this.name = 'InvalidEnvError';
  }
}

/**
 * Parses and validates the environment. Fails fast on startup (CLAUDE.md §4.5).
 * Only variable names are reported, never their values, so secrets never reach logs.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new InvalidEnvError(keys);
  }
  return result.data;
}
