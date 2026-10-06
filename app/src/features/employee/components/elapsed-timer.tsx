import { useEffect, useState } from 'react';

import { formatElapsed } from '../../../lib/format.js';

interface ElapsedTimerProps {
  /** Start of the shift (server time of the check-in). */
  since: Date;
  /**
   * Prototype/tests only: pretend "now" was this moment when the timer
   * mounted; it then keeps ticking from there in real time.
   */
  reference?: Date;
  className?: string;
}

/**
 * Live "tiempo trabajado" counter. Re-renders only itself once per second.
 * Hidden from screen readers (a voice reading every second is unusable);
 * the screen exposes the same information in minutes elsewhere.
 */
export function ElapsedTimer({ since, reference, className }: ElapsedTimerProps) {
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  const base = reference ? reference.getTime() + (now - mountedAt) : now;
  return (
    <span className={className} aria-hidden="true">
      {formatElapsed(base - since.getTime())}
    </span>
  );
}
