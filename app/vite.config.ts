import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const API_TARGET = process.env.VITE_DEV_API_TARGET ?? 'http://127.0.0.1:4400';

export default defineConfig({
  // "/" for Easypanel (own domain); "/PJ20-CONTROL-ASISTENCIA/" for the GitHub Pages prototype.
  base: process.env.VITE_BASE ?? '/',
  // One .env at the repository root for API and app (only VITE_* reach the browser).
  envDir: '..',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin in development, exactly like production (/api is routed to the backend).
    proxy: { '/api': { target: API_TARGET, changeOrigin: false } },
  },
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // axe audits of full screens (e.g. a 30-row table) legitimately take seconds.
    testTimeout: 15_000,
  },
});
