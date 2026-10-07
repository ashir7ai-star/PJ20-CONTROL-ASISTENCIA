/**
 * Thin client for /api/v1. Same-origin cookies carry the session; errors
 * become ApiRequestError with the server's Spanish message and code.
 *
 * Responses are not re-validated here: the server serializes every response
 * through the shared zod contracts (serializerCompiler), so the shape is
 * guaranteed at the source and zod stays out of the bundle every phone loads.
 */
import type { ApiErrorCode } from '@pj20/shared/constants';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'NETWORK_ERROR',
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/** Reads the `{ error: { code, message } }` envelope, if that is what came back. */
function errorEnvelope(value: unknown): { code: string; message: string } | null {
  if (typeof value !== 'object' || value === null || !('error' in value)) return null;
  const { error } = value;
  if (typeof error !== 'object' || error === null) return null;
  if (!('code' in error) || !('message' in error)) return null;
  const { code, message } = error;
  return typeof code === 'string' && typeof message === 'string' ? { code, message } : null;
}

export async function api<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Sin conexión con el servidor.');
  }

  if (!response.ok) {
    const envelope = errorEnvelope(await response.json().catch(() => null));
    if (envelope) {
      throw new ApiRequestError(response.status, envelope.code as ApiErrorCode, envelope.message);
    }
    throw new ApiRequestError(response.status, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.');
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
