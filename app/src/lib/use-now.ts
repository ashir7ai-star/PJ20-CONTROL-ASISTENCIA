import { useEffect, useState } from 'react';

/**
 * Current time, re-rendering at the start of every minute (or second).
 * Display only: the attendance time is ALWAYS set by the server (CLAUDE.md §2.1).
 */
export function useNow(granularity: 'minute' | 'second' = 'minute', fixed?: Date): Date {
  const [now, setNow] = useState(() => fixed ?? new Date());

  useEffect(() => {
    if (fixed) return;
    const step = granularity === 'second' ? 1_000 : 60_000;
    let interval: ReturnType<typeof setInterval> | undefined;
    // Align ticks to the boundary so the clock never lags behind.
    const timeout = setTimeout(
      () => {
        setNow(new Date());
        interval = setInterval(() => {
          setNow(new Date());
        }, step);
      },
      step - (Date.now() % step),
    );
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [granularity, fixed]);

  return fixed ?? now;
}
