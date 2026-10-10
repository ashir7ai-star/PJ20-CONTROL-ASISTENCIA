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

/**
 * iPhone launch screens (public/icons/arranque-*.png), portrait: CSS width,
 * CSS height and pixel ratio of each screen size. iOS shows the one matching
 * the phone while the installed app opens; without it the screen flashes white.
 */
const LAUNCH_SCREENS: readonly (readonly [number, number, number])[] = [
  [440, 956, 3], // 16 Pro Max, 17 Pro Max
  [430, 932, 3], // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  [402, 874, 3], // 16 Pro, 17, 17 Pro
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [390, 844, 3], // 12, 13, 14, 12/13 Pro
  [414, 896, 3], // XS Max, 11 Pro Max
  [375, 812, 3], // X, XS, 11 Pro, 12/13 mini
  [414, 896, 2], // XR, 11
  [375, 667, 2], // SE (2.ª y 3.ª gen.), 8
];

/**
 * Installable app (D9): manifest, home-screen icons and iPhone tags. Only the
 * real app: the GitHub Pages prototype lives under another path and must not
 * be installed.
 */
function installableApp(enabled: boolean): Plugin {
  return {
    name: 'pj20-installable-app',
    transformIndexHtml() {
      if (!enabled) return [];
      const tag = (name: 'link' | 'meta', attrs: Record<string, string>) => ({
        tag: name,
        attrs,
        injectTo: 'head' as const,
      });
      return [
        tag('link', { rel: 'manifest', href: '/manifest.webmanifest' }),
        tag('link', { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' }),
        tag('meta', { name: 'mobile-web-app-capable', content: 'yes' }),
        tag('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }),
        tag('meta', { name: 'apple-mobile-web-app-title', content: 'Asistencia' }),
        tag('meta', {
          name: 'apple-mobile-web-app-status-bar-style',
          content: 'black-translucent',
        }),
        ...LAUNCH_SCREENS.map(([width, height, ratio]) =>
          tag('link', {
            rel: 'apple-touch-startup-image',
            href: `/icons/arranque-${String(width * ratio)}x${String(height * ratio)}.png`,
            media: `(device-width: ${String(width)}px) and (device-height: ${String(height)}px) and (-webkit-device-pixel-ratio: ${String(ratio)}) and (orientation: portrait)`,
          }),
        ),
      ];
    },
  };
}

export default defineConfig(({ mode }) => ({
  // "/" for Easypanel (own domain); "/PJ20-CONTROL-ASISTENCIA/" for the GitHub Pages prototype.
  base: process.env.VITE_BASE ?? '/',
  // One .env at the repository root for API and app (only VITE_* reach the browser).
  envDir: '..',
  plugins: [
    react(),
    tailwindcss(),
    sharePreview(loadEnv(mode, '..', 'VITE_').VITE_PUBLIC_URL),
    installableApp(process.env.VITE_MODO !== 'prototipo'),
  ],
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
