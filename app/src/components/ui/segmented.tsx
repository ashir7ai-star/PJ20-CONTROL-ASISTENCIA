import { cn } from '../../lib/cn.js';

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

/** iOS-style segmented control, exposed as a radio group for assistive tech. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex h-11 overflow-hidden rounded-xl bg-surface ring-1 ring-line',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              onChange(option.value);
            }}
            className={cn(
              // flex-1: share the width evenly when the control is stretched (w-full).
              'h-11 flex-1 px-4 text-[14px] font-medium transition-colors',
              selected
                ? 'rounded-xl bg-surface-raised text-ink shadow-sm ring-1 ring-line-strong'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
