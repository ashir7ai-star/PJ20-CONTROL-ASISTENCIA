/**
 * Registers public/sw.js (D9): the installed app opens fast on a weak signal
 * and shows "Sin conexión" offline. Only in the real production build: never
 * in development (it would hide changes) nor in the GitHub Pages prototype.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || import.meta.env.VITE_MODO === 'prototipo') return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    // A failure only means no offline shell: the app works the same online.
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
