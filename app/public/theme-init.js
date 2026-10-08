// Applies the saved appearance before the first paint (no white flash: the
// default is dark). Kept tiny and dependency-free; src/lib/theme.ts takes over afterwards.
(function () {
  var preference = null;
  try {
    preference = localStorage.getItem('pj20-tema');
  } catch {
    // Storage unavailable (private mode): the default (dark) applies.
  }
  var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  // Same rules as src/lib/theme.ts: nothing saved → dark (the default look);
  // 'system' follows the phone; 'light' is the user's explicit choice.
  var dark = preference === 'system' ? systemDark : preference !== 'light';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#050b16' : '#ffffff');
})();
