import { randomUUID } from 'node:crypto';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { ApiError } from '@pj20/shared';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { type HealthChecks, registerHealthRoutes } from './routes/health.js';

export interface AppOptions {
  appOrigins: string[];
  checks: HealthChecks;
  logger: NonNullable<FastifyServerOptions['logger']>;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger,
    // Never trust a client-supplied request id; always generate our own.
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    bodyLimit: 1_048_576,
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: options.appOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  app.setNotFoundHandler((request, reply) => {
    const body: ApiError = {
      error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.', requestId: request.id },
    };
    return reply.code(404).send(body);
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = getStatusCode(error);
    if (statusCode >= 500) {
      request.log.error({ err: error }, 'unhandled error');
      const body: ApiError = {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Ocurrió un error inesperado. Intenta de nuevo.',
          requestId: request.id,
        },
      };
      return reply.code(500).send(body);
    }

    // Client errors (validation, malformed JSON, payload too large...) are safe to describe.
    const body: ApiError = {
      error: {
        code: getErrorCode(error) ?? 'BAD_REQUEST',
        message: 'La solicitud no es válida.',
        requestId: request.id,
      },
    };
    return reply.code(statusCode).send(body);
  });

  registerHealthRoutes(app, options.checks);

  return app;
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
