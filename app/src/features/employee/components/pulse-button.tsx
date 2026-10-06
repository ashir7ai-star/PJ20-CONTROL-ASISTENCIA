import { LogIn, LogOut } from 'lucide-react';

import { cn } from '../../../lib/cn.js';
import { type AttendanceKind, attendanceLabels } from '../model.js';
import { ElapsedTimer } from './elapsed-timer.js';
import { EnergyField } from './energy-field.js';

interface PulseButtonProps {
  kind: AttendanceKind;
  disabled?: boolean;
  onPress?: () => void;
  /** Shift start: when present (on duty) the button shows the live work timer. */
  since?: Date;
  /** Prototype/tests only: fixed "now" the timer starts from. */
  reference?: Date;
}

/** Canvas side: fits a 360 px phone with margin while giving the streaks room. */
const FIELD_SIZE = 340;
/** Inner circle is size-48 (192 px). */
const BUTTON_RADIUS = 96;

const surface = {
  check_in: 'bg-linear-to-b from-check-in-from to-check-in-to text-check-in-ink',
  check_out: 'bg-linear-to-b from-check-out-from to-check-out-to text-check-out-ink',
} as const;

/**
 * The main "Pulso" action: a glossy circular button inside an energy field.
 * Off duty it invites to check in; on duty it shows the live "tiempo
 * trabajado" counter above the check-out action.
 * Motion stops while disabled; reduced-motion shows a still frame.
 */
export function PulseButton({
  kind,
  disabled = false,
  onPress,
  since,
  reference,
}: PulseButtonProps) {
  const label = attendanceLabels[kind].action;
  const showTimer = kind === 'check_out' && since !== undefined;

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
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
            className="absolute inset-2 rounded-full bg-[radial-gradient(circle,var(--color-energy)_0%,transparent_70%)] opacity-60 animate-[energy-breathe_4.5s_ease-in-out_infinite] motion-reduce:animate-none"
            aria-hidden="true"
          />
        </>
      )}

      <span
        className={cn(
          'relative grid size-48 place-items-center overflow-hidden rounded-full shadow-2xl ring-1 ring-sheen/40 ring-inset transition-[opacity,box-shadow] duration-200',
          surface[kind],
          disabled
            ? 'opacity-40 shadow-none'
            : 'shadow-energy/40 outline-4 outline-energy/30 group-hover:outline-energy/50',
        )}
      >
        {/* Glass highlight: fades out before the text starts (keeps text contrast) */}
        <span
          className="pointer-events-none absolute inset-x-7 top-2 h-[26%] rounded-full bg-linear-to-b from-sheen/30 to-transparent"
          aria-hidden="true"
        />

        {showTimer ? (
          <span className="relative flex flex-col items-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-80">
              Tiempo trabajado
            </span>
            <ElapsedTimer
              since={since}
              {...(reference ? { reference } : {})}
              className="mt-1 text-[34px] font-semibold leading-none tracking-tight tabular-nums"
            />
            <span className="my-3 h-px w-12 bg-current opacity-25" aria-hidden="true" />
            <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold">
              <LogOut className="size-4" strokeWidth={2.25} aria-hidden="true" />
              {label}
            </span>
          </span>
        ) : (
          <span className="relative flex flex-col items-center gap-2">
            {kind === 'check_in' ? (
              <LogIn className="size-9" strokeWidth={2} aria-hidden="true" />
            ) : (
              <LogOut className="size-9" strokeWidth={2} aria-hidden="true" />
            )}
            <span className="text-[19px] font-semibold">{label}</span>
          </span>
        )}
      </span>
    </button>
  );
}
