// Applies the saved appearance before the first paint (no white flash in dark
// mode). Kept tiny and dependency-free; src/lib/theme.ts takes over afterwards.
(function () {
  var preference = null;
  try {
    preference = localStorage.getItem('pj20-tema');
  } catch {
    // Storage unavailable (private mode): follow the system.
  }
  var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark = preference === 'dark' || (preference !== 'light' && systemDark);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#050b16' : '#ffffff');
})();
