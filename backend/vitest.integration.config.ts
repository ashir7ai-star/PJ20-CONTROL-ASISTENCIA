import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['src/test/integration-setup.ts'],
    testTimeout: 15_000,
    // Tests share real services: run sequentially.
    fileParallelism: false,
  },
});
