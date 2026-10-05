import { LogIn, LogOut } from 'lucide-react';

import { cn } from '../../../lib/cn.js';
import { type AttendanceKind, attendanceLabels } from '../model.js';

interface PulseButtonProps {
  kind: AttendanceKind;
  disabled?: boolean;
  onPress?: () => void;
}

/**
 * The main "Pulso" action: a large circular button framed by the open
 * blue ring of the BLAZAR logo. The ring slowly turns while the button is
 * ready (disabled when the user prefers reduced motion).
 */
export function PulseButton({ kind, disabled = false, onPress }: PulseButtonProps) {
  const Icon = kind === 'check_in' ? LogIn : LogOut;
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className="group relative grid size-60 place-items-center rounded-full transition-transform duration-200 ease-(--ease-standard) active:scale-95 disabled:cursor-not-allowed"
    >
      <svg
        className={cn(
          'absolute inset-0 size-full -rotate-45',
          !disabled && 'animate-[spin_24s_linear_infinite] motion-reduce:animate-none',
        )}
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r="47"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="150 28"
          className={cn('stroke-ring transition-opacity', disabled && 'opacity-30')}
        />
      </svg>
      <span
        className={cn(
          'grid size-48 place-items-center rounded-full shadow-2xl shadow-brand-blue/20 transition-[opacity,box-shadow] duration-200',
          kind === 'check_in' ? 'bg-check-in text-check-in-ink' : 'bg-check-out text-check-out-ink',
          disabled && 'opacity-40 shadow-none',
          !disabled && 'group-hover:shadow-brand-blue/35',
        )}
      >
        <span className="flex flex-col items-center gap-2">
          <Icon className="size-9" strokeWidth={2} aria-hidden="true" />
          <span className="text-[19px] font-semibold">{attendanceLabels[kind].action}</span>
        </span>
      </span>
    </button>
  );
}
