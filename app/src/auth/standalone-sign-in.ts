/**
 * Google sign-in from the app installed on an iPhone home screen (D9).
 *
 * There the app keeps its cookies apart from Safari, and a plain navigation to
 * Google would finish in a Safari sheet that never hands the session back. A
 * window opened by the app itself, in the same tap, stays inside the app and
 * shares its cookies (Apple, WWDC23). That window goes through our server to
 * Google, comes back with the session already set, and reports the outcome on a
 * BroadcastChannel before closing (public/acceso-listo.js).
 */
import { SIGN_IN_CHANNEL, type SignInOutcome, signInOutcomes } from '@pj20/shared/constants';
import { useEffect, useEffectEvent } from 'react';

const START_URL = '/api/v1/auth/google/start';

/** True only in the app launched from an iPhone/iPad home screen. */
export function isIosStandalone(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Must run inside the tap handler, without awaiting first, or iOS leaves the app. */
export function openSignInWindow(): void {
  const opened = window.open(START_URL, '_blank');
  // Blocked: go in this same window; the server sends it back to the app at the end.
  if (!opened) window.location.assign(START_URL);
}

function isOutcome(value: unknown): value is SignInOutcome {
  return signInOutcomes.some((outcome) => outcome === value);
}

/**
 * Calls `onOutcome` when the sign-in window reports, and `onReturn` each time
 * the app comes back into view (the fallback where BroadcastChannel is missing).
 */
export function useSignInWindow(
  enabled: boolean,
  onOutcome: (outcome: SignInOutcome) => void,
  onReturn: () => void,
): void {
  const outcomeEvent = useEffectEvent(onOutcome);
  const returnEvent = useEffectEvent(onReturn);

  useEffect(() => {
    if (!enabled) return;
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(SIGN_IN_CHANNEL) : null;
    if (channel) {
      channel.onmessage = (event: MessageEvent) => {
        if (isOutcome(event.data)) outcomeEvent(event.data);
      };
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') returnEvent();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      channel?.close();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
}
