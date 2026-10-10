// Sign-in window of the app installed on iPhone (D9). Tells the app how the
// sign-in went (the outcome only: the session itself already lives in the app,
// never in this page) and closes. Must match SIGN_IN_CHANNEL and
// signInOutcomes in packages/shared/src/constants.ts (a test checks it).
(function () {
  var CHANNEL = 'pj20-acceso';
  var OUTCOMES = ['ok', 'no-autorizada', 'error', 'cancelado'];
  var outcome = new URLSearchParams(window.location.search).get('resultado');
  if (OUTCOMES.indexOf(outcome) === -1) outcome = 'error';

  try {
    var channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(outcome);
    channel.close();
  } catch {
    // No BroadcastChannel: the app re-reads the session when it comes back to view.
  }
  window.close();

  // Still open (iOS may keep it): offer the way back by hand.
  setTimeout(function () {
    document.getElementById('mensaje').textContent =
      outcome === 'ok' ? 'Listo. Ya puedes volver a la app.' : 'Vuelve a la app para continuar.';
    document.getElementById('volver').hidden = false;
  }, 800);
})();
