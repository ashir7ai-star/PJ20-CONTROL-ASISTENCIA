import { type HealthResponse, healthResponseSchema } from '@pj20/shared';

/**
 * Fetches the API readiness status. A 503 still carries a valid body
 * (degraded), so only network failures or malformed bodies throw.
 */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', {
    headers: { accept: 'application/json' },
    cache: 'no-store',
    ...(signal ? { signal } : {}),
  });
  return healthResponseSchema.parse(await response.json());
}
