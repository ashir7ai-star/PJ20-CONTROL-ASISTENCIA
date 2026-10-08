import { randomUUID } from 'node:crypto';

import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import type { ApiError, ApiErrorCode } from '@pj20/shared';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import type { Redis } from 'ioredis';

import { authPlugin } from './auth/plugin.js';
import type { AuthDeps } from './auth/service.js';
import type { PhotoStore } from './infra/photo-store.js';
import { DomainError } from './errors.js';
import { type HealthChecks, registerHealthRoutes } from './routes/health.js';
import { v1Routes } from './routes/v1.js';

export interface AppOptions {
  appOrigins: string[];
  checks: HealthChecks;
  logger: NonNullable<FastifyServerOptions['logger']>;
  /** Number of trusted reverse proxies in front of the API (Easypanel: 1). */
  trustProxy?: number | false;
  /** Mounts the authenticated API v1 when provided. */
  api?: AuthDeps & { redis: Redis; photos: PhotoStore; authRateLimitMax?: number };
  /** Serves the OpenAPI document (never in production). */
  exposeDocs?: boolean;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger,
    // Never trust a client-supplied request id; always generate our own.
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    bodyLimit: 1_048_576,
    // Trust exactly N proxy hops so request.ip is the real client (antifraud, audit).
    trustProxy: options.trustProxy
      ? (_address: string, hop: number) => hop < Number(options.trustProxy)
      : false,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: options.appOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  await app.register(cookie);

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send(errorBody('NOT_FOUND', 'Recurso no encontrado.', request.id)),
  );

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      return reply.code(error.statusCode).send(errorBody(error.code, error.message, request.id));
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply
        .code(400)
        .send(errorBody('VALIDATION_ERROR', 'Los datos enviados no son válidos.', request.id));
    }
    const statusCode = getStatusCode(error);
    if (statusCode === 429) {
      return reply
        .code(429)
        .send(errorBody('RATE_LIMITED', 'Demasiados intentos. Espera un momento.', request.id));
    }
    if (statusCode >= 500) {
      request.log.error({ err: error }, 'unhandled error');
      return reply
        .code(500)
        .send(
          errorBody('INTERNAL_ERROR', 'Ocurrió un error inesperado. Intenta de nuevo.', request.id),
        );
    }
    // Other client errors (malformed JSON, payload too large...) are safe to describe.
    return reply.code(statusCode).send({
      error: {
        code: getErrorCode(error) ?? 'BAD_REQUEST',
        message: 'La solicitud no es válida.',
        requestId: request.id,
      },
    } satisfies ApiError);
  });

  registerHealthRoutes(app, options.checks);

  const { api } = options;
  if (api) {
    await app.register(rateLimit, {
      global: true,
      max: 300,
      timeWindow: '1 minute',
      redis: api.redis,
      nameSpace: 'pj20:rl:',
      // Let the central error handler build the Spanish response.
      errorResponseBuilder: (_request, context) => ({
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: `Rate limit ${String(context.max)} exceeded`,
      }),
    });

    if (options.exposeDocs) {
      await app.register(swagger, {
        openapi: {
          info: { title: 'PJ20 · Control de Asistencia · API', version: '1.0.0' },
        },
        transform: jsonSchemaTransform,
      });
      app.get('/api/docs/openapi.json', { schema: { hide: true } }, () => app.swagger());
    }

    await app.register(
      async (scope) => {
        await scope.register(authPlugin, { db: api.db, allowedOrigins: options.appOrigins });
        await scope.register(v1Routes, api);
      },
      { prefix: '/api/v1' },
    );
  }

  return app;
}

function errorBody(code: ApiErrorCode, message: string, requestId: string): ApiError {
  return { error: { code, message, requestId } };
}

function getStatusCode(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const { statusCode } = error;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 600) {
      return statusCode;
    }
  }
  return 500;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;
    if (typeof code === 'string') return code;
  }
  return undefined;
}
