import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const API_TARGET = process.env.VITE_DEV_API_TARGET ?? 'http://127.0.0.1:4400';

const SHARE_TITLE = 'Control de Asistencia · BLAZAR ENERGY';
const SHARE_DESCRIPTION = 'Registra tu entrada y tu salida en segundos.';

/**
 * Link preview (Open Graph) for WhatsApp, Telegram, LinkedIn…: logo, title and
 * description when the link is shared. Previews need absolute URLs, so they are
 * emitted only when VITE_PUBLIC_URL (the public https address) is known at build.
 */
function sharePreview(publicUrl: string | undefined): Plugin {
  return {
    name: 'pj20-share-preview',
    transformIndexHtml() {
      if (!publicUrl) return [];
      const url = new URL(publicUrl);
      if (url.protocol !== 'https:') throw new Error('VITE_PUBLIC_URL debe empezar por https://');
      const base = url.href.replace(/\/$/, '');
      const meta = (attrs: Record<string, string>) => ({
        tag: 'meta',
        attrs,
        injectTo: 'head' as const,
      });
      return [
        meta({ property: 'og:type', content: 'website' }),
        meta({ property: 'og:site_name', content: 'BLAZAR ENERGY' }),
        meta({ property: 'og:locale', content: 'es_CO' }),
        meta({ property: 'og:title', content: SHARE_TITLE }),
        meta({ property: 'og:description', content: SHARE_DESCRIPTION }),
        meta({ property: 'og:url', content: `${base}/` }),
        meta({ property: 'og:image', content: `${base}/og-image.jpg` }),
        meta({ property: 'og:image:type', content: 'image/jpeg' }),
        meta({ property: 'og:image:width', content: '1200' }),
        meta({ property: 'og:image:height', content: '630' }),
        meta({ property: 'og:image:alt', content: 'BLAZAR ENERGY · Control de Asistencia' }),
        meta({ name: 'twitter:card', content: 'summary_large_image' }),
      ];
    },
  };
}

export default defineConfig(({ mode }) => ({
  // "/" for Easypanel (own domain); "/PJ20-CONTROL-ASISTENCIA/" for the GitHub Pages prototype.
  base: process.env.VITE_BASE ?? '/',
  // One .env at the repository root for API and app (only VITE_* reach the browser).
  envDir: '..',
  plugins: [react(), tailwindcss(), sharePreview(loadEnv(mode, '..', 'VITE_').VITE_PUBLIC_URL)],
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
}));
