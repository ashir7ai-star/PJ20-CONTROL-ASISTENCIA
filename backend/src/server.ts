import { InvalidEnvError, loadEnv } from './config/env.js';
import { buildApp } from './app.js';
import { createGoogleVerifier } from './auth/google.js';
import { createNonceStore } from './auth/nonce.js';
import { createDatabase } from './db/client.js';
import { checkDatabase, createDatabasePool } from './infra/postgres.js';
import { checkCache, createRedisClient } from './infra/redis.js';
import { createAccessProofStore } from './access/proof.js';
import { purgeExpiredSelfies } from './attendance/retention.js';
import { createPhotoStore } from './infra/photo-store.js';
import { checkStorage, createStorageClient, ensureBucket } from './infra/storage.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;
const PURGE_EVERY_MS = 12 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const env = loadEnv();

  const db = createDatabasePool(env.DATABASE_URL);
  const redis = createRedisClient(env.REDIS_URL);
  const storage = createStorageClient({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
  });

  const photos = createPhotoStore(storage, env.S3_BUCKET);
  const appDb = createDatabase(db);
  const app = await buildApp({
    appOrigins: env.APP_ORIGINS,
    trustProxy: env.TRUST_PROXY,
    exposeDocs: env.NODE_ENV !== 'production',
    logger: {
      level: env.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    },
    checks: {
      database: () => checkDatabase(db),
      cache: () => checkCache(redis),
      storage: () => checkStorage(storage, env.S3_BUCKET),
    },
    api: {
      db: appDb,
      redis,
      verifier: createGoogleVerifier(env.GOOGLE_CLIENT_ID),
      nonces: createNonceStore(redis),
      photos,
      accessProofs: createAccessProofStore(redis),
    },
  });

  redis.on('error', (error: Error) => {
    app.log.warn({ err: error }, 'redis connection error');
  });
  db.on('error', (error: Error) => {
    app.log.warn({ err: error }, 'idle postgres client error');
  });

  app.addHook('onClose', async () => {
    await Promise.allSettled([db.end(), redis.quit()]);
    storage.destroy();
  });

  // Dependencies may still be starting; the API boots anyway and /health reports it.
  try {
    const result = await ensureBucket(storage, env.S3_BUCKET);
    app.log.info({ bucket: env.S3_BUCKET, result }, 'storage bucket ready');
  } catch (error) {
    app.log.error({ err: error }, 'could not verify storage bucket');
  }

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'shutting down');
    const forceExit = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        app.log.error({ err: error }, 'error during shutdown');
        process.exit(1);
      },
    );
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await app.listen({ host: env.HOST, port: env.PORT });

  // Selfie retention (D7): a minute after start, then twice a day.
  const purge = () => {
    purgeExpiredSelfies(appDb, photos, new Date()).then(
      ({ deleted }) => {
        app.log.info({ deleted }, 'selfie retention purge');
      },
      (error: unknown) => {
        app.log.error({ err: error }, 'selfie retention purge failed');
      },
    );
  };
  setTimeout(purge, 60_000).unref();
  setInterval(purge, PURGE_EVERY_MS).unref();
}

main().catch((error: unknown) => {
  const message =
    error instanceof InvalidEnvError
      ? `Configuración inválida. Revisa estas variables de entorno: ${error.invalidKeys.join(', ')}`
      : `Error fatal al iniciar: ${error instanceof Error ? error.message : String(error)}`;
  process.stderr.write(`${JSON.stringify({ level: 'fatal', msg: message })}\n`);
  process.exit(1);
});
