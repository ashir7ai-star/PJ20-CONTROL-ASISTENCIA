/**
 * One-shot GPS reading for a clock-in/out. Location is requested ONLY at the
 * moment of marking — never continuous tracking (CLAUDE.md §3.1).
 * Phones improve accuracy over a few seconds, so we watch briefly and keep the
 * best fix, stopping early once it is good enough.
 */

export interface Fix {
  latitude: number;
  longitude: number;
  accuracyM: number;
  /** When the device obtained the fix (device clock). */
  capturedAt: Date;
}

export type LocationError = 'permission-denied' | 'unavailable' | 'unsupported';

export class LocationFailure extends Error {
  constructor(readonly reason: LocationError) {
    super(reason);
    this.name = 'LocationFailure';
  }
}

interface Options {
  /** Stop as soon as a fix is at least this accurate (metres). */
  goodEnoughM?: number;
  /** Give up waiting for better accuracy after this long. */
  maxWaitMs?: number;
  signal?: AbortSignal;
}

export function getBestFix({
  goodEnoughM = 25,
  maxWaitMs = 10_000,
  signal,
}: Options = {}): Promise<Fix> {
  if (!('geolocation' in navigator)) {
    return Promise.reject(new LocationFailure('unsupported'));
  }
  return new Promise((resolve, reject) => {
    let best: Fix | null = null;
    let settled = false;

    const finish = (outcome: { fix: Fix } | { error: LocationError }) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if ('fix' in outcome) resolve(outcome.fix);
      else reject(new LocationFailure(outcome.error));
    };
    const onAbort = () => {
      finish({ error: 'unavailable' });
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const fix: Fix = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          capturedAt: new Date(position.timestamp),
        };
        if (!best || fix.accuracyM < best.accuracyM) best = fix;
        if (fix.accuracyM <= goodEnoughM) finish({ fix });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) finish({ error: 'permission-denied' });
        // Other errors may be transient: keep waiting unless we have nothing at the deadline.
      },
      // maximumAge 0: never reuse a cached (possibly old or fake) position.
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs },
    );

    const timer = setTimeout(() => {
      finish(best ? { fix: best } : { error: 'unavailable' });
    }, maxWaitMs);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
