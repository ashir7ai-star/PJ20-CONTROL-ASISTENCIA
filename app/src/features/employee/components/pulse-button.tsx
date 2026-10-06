import { LogIn, LogOut } from 'lucide-react';

import { cn } from '../../../lib/cn.js';
import { type AttendanceKind, attendanceLabels } from '../model.js';
import { EnergyField } from './energy-field.js';

interface PulseButtonProps {
  kind: AttendanceKind;
  disabled?: boolean;
  onPress?: () => void;
}

/** Canvas side: fits a 360 px phone with margin while giving the streaks room. */
const FIELD_SIZE = 340;
/** Inner circle is size-48 (192 px). */
const BUTTON_RADIUS = 96;

/**
 * The main "Pulso" action: a large circular button inside an energy field —
 * streaks of BLAZAR blue light shooting outwards and a breathing glow.
 * Motion stops while disabled; reduced-motion shows a still frame.
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
      {!disabled && (
        <>
          <EnergyField
            size={FIELD_SIZE}
            buttonRadius={BUTTON_RADIUS}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          />
          {/* Breathing glow behind the button */}
          <span
            className="absolute inset-2 rounded-full bg-[radial-gradient(circle,var(--color-energy)_0%,transparent_70%)] opacity-60 animate-[energy-breathe_3.2s_ease-in-out_infinite] motion-reduce:animate-none"
            aria-hidden="true"
          />
        </>
      )}
      <span
        className={cn(
          'relative grid size-48 place-items-center rounded-full shadow-2xl transition-[opacity,box-shadow] duration-200',
          kind === 'check_in' ? 'bg-check-in text-check-in-ink' : 'bg-check-out text-check-out-ink',
          disabled
            ? 'opacity-40 shadow-none'
            : 'shadow-energy/40 ring-4 ring-energy/30 group-hover:ring-energy/50',
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
