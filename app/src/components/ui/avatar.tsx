import { cn } from '../../lib/cn.js';

const sizes = { sm: 'size-8 text-[12px]', md: 'size-10 text-[14px]', lg: 'size-14 text-[18px]' };

/** Initials avatar. Selfies are never used as avatars (sensitive data, CLAUDE.md §3.2). */
export function Avatar({
  initials,
  size = 'md',
  className,
}: {
  initials: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-info-soft font-semibold text-info',
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
