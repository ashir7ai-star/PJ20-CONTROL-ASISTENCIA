import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('accepts a valid healthy response', () => {
    const result = healthResponseSchema.safeParse({
      status: 'ok',
      checks: { database: 'up', cache: 'up', storage: 'up' },
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects a response missing a dependency', () => {
    const result = healthResponseSchema.safeParse({
      status: 'ok',
      checks: { database: 'up', cache: 'up' },
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown status value', () => {
    const result = healthResponseSchema.safeParse({
      status: 'fine',
      checks: { database: 'up', cache: 'up', storage: 'up' },
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});
