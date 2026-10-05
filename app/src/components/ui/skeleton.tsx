import { cn } from '../../lib/cn.js';

/** Loading placeholder with the shape of the content it replaces. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span className={cn('block animate-pulse rounded-xl bg-line', className)} aria-hidden="true" />
  );
}
