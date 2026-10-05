import { Redis } from 'ioredis';

export function createRedisClient(url: string): Redis {
  return new Redis(url, {
    connectTimeout: 5_000,
    // Fail fast instead of queueing commands forever while Redis is unreachable.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
}

/** Resolves when Redis answers PING; rejects when it is unreachable. */
export async function checkCache(redis: Redis): Promise<void> {
  await redis.ping();
}
