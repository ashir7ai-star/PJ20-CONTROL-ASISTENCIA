// Service worker of the installed app (D9). It only keeps the app's own files
// so it opens fast on a weak signal and shows "Sin conexión" instead of the
// browser's error page. It NEVER touches /api: marking, the session and every
// personal datum always go to the server (CLAUDE.md §2.7, no offline marking).
'use strict';

const SHELL_CACHE = 'pj20-app-v1';
const ASSETS_CACHE = 'pj20-assets-v1';
const CACHES = [SHELL_CACHE, ASSETS_CACHE];
/** Hashed files kept at most (old releases are dropped first). */
const MAX_ASSETS = 80;
const SHELL = ['/', '/theme-init.js', '/favicon.png'];

/**
 * How each request is served. Pure, so it is unit-tested (src/sw.node.test.ts).
 * @param {URL} url
 * @param {{ method: string, mode: string, origin: string }} request
 * @returns {'network' | 'page' | 'asset' | 'static'}
 */
function strategyFor(url, request) {
  if (request.method !== 'GET' || url.origin !== request.origin) return 'network';
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return 'network';
  if (url.pathname === '/sw.js') return 'network';
  if (request.mode === 'navigate') return 'page';
  if (url.pathname.startsWith('/assets/')) return 'asset';
  if (
    url.pathname.startsWith('/icons/') ||
    SHELL.includes(url.pathname) ||
    url.pathname === '/manifest.webmanifest'
  ) {
    return 'static';
  }
  return 'network';
}

/** Network first: new releases arrive at once; the saved app only when offline. */
async function servePage(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    // Only the app entry is saved; other pages (e.g. the sign-in window) are not.
    if (response.ok && new URL(request.url).pathname === '/') {
      await cache.put('/', response.clone());
    }
    return response;
  } catch (error) {
    const saved = await cache.match('/');
    if (saved) return saved;
    throw error;
  }
}

/** Hashed file names never change content: cache first, forever. */
async function serveAsset(request) {
  const cache = await caches.open(ASSETS_CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    await Promise.all(
      keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((key) => cache.delete(key)),
    );
  }
  return response;
}

/** Small files that may change between releases: saved copy now, refreshed behind. */
async function serveStatic(request) {
  const cache = await caches.open(SHELL_CACHE);
  const saved = await cache.match(request);
  const fresh = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  });
  if (saved) {
    fresh.catch(() => undefined);
    return saved;
  }
  return fresh;
}

if (typeof self !== 'undefined' && 'clients' in self) {
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches
        .open(SHELL_CACHE)
        .then((cache) => cache.addAll(SHELL))
        .then(() => self.skipWaiting()),
    );
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((names) =>
          Promise.all(
            names.filter((name) => !CACHES.includes(name)).map((name) => caches.delete(name)),
          ),
        )
        .then(() => self.clients.claim()),
    );
  });

  self.addEventListener('fetch', (event) => {
    const { request } = event;
    const strategy = strategyFor(new URL(request.url), {
      method: request.method,
      mode: request.mode,
      origin: self.location.origin,
    });
    if (strategy === 'page') event.respondWith(servePage(request));
    else if (strategy === 'asset') event.respondWith(serveAsset(request));
    else if (strategy === 'static') event.respondWith(serveStatic(request));
    // 'network': not intercepted at all; the browser handles it as if there were no worker.
  });
}
