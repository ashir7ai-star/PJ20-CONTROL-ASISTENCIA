import type { DependencyName, DependencyStatus, HealthResponse } from '@pj20/shared';
import { dependencyNames } from '@pj20/shared';
import type { FastifyInstance } from 'fastify';

export type DependencyCheck = () => Promise<void>;
export type HealthChecks = Record<DependencyName, DependencyCheck>;

const CHECK_TIMEOUT_MS = 2_000;

/**
 * Readiness probe: reports each dependency without leaking internal error details.
 * Returns 503 when any dependency is down so Easypanel/monitoring can react.
 */
export function registerHealthRoutes(app: FastifyInstance, checks: HealthChecks): void {
  app.get('/api/health', async (request, reply) => {
    const results = await Promise.all(
      dependencyNames.map(async (name) => {
        try {
          await withTimeout(checks[name](), CHECK_TIMEOUT_MS);
          return [name, 'up'] as const;
        } catch (error) {
          request.log.error({ err: error, dependency: name }, 'health check failed');
          return [name, 'down'] as const;
        }
      }),
    );

    const statuses = Object.fromEntries(results) as Record<DependencyName, DependencyStatus>;
    const healthy = results.every(([, status]) => status === 'up');
    const body: HealthResponse = {
      status: healthy ? 'ok' : 'degraded',
      checks: statuses,
      timestamp: new Date().toISOString(),
    };

    return reply
      .code(healthy ? 200 : 503)
      .header('cache-control', 'no-store')
      .send(body);
  });
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timed out after ${ms} ms`));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
