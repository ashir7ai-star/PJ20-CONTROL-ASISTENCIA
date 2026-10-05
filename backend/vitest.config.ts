import { defineConfig } from 'vitest/config';

// Unit tests only. Integration tests (real services) use vitest.integration.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
  },
});
