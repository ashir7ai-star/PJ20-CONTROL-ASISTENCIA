import { Building2, Trees, UserRound, X } from 'lucide-react';

import { type AttendanceKind, attendanceLabels } from '../model.js';

interface SelfieScreenProps {
  kind: AttendanceKind;
  onCapture?: () => void;
  onCancel?: () => void;
}

/**
 * Live selfie capture (front camera only, never the gallery — CLAUDE.md §2B.6).
 * The photo must show the employee's face AND the place behind them, so the
 * admin can confirm where the mark was made: a small face guide at the top
 * leaves the rest of the frame for the background.
 * Fase 1: the camera feed is a placeholder; the real stream arrives in Fase 3.
 * Always dark: a camera viewfinder reads best on black in both themes.
 */
export function SelfieScreen({ kind, onCapture, onCancel }: SelfieScreenProps) {
  return (
    <div className="safe-area flex min-h-dvh flex-col bg-viewfinder text-viewfinder-ink">
      <header className="flex items-center justify-between px-4 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="grid size-11 place-items-center rounded-full bg-viewfinder-ink/10 transition-colors hover:bg-viewfinder-ink/20"
          aria-label="Cancelar"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        <p className="text-[15px] font-semibold">{attendanceLabels[kind].action}</p>
        <span className="size-11" aria-hidden="true" />
      </header>

      <div className="relative mx-4 mt-4 flex-1 overflow-hidden rounded-[32px] bg-viewfinder-glow">
        {/* Placeholder scene: the place behind the employee (real camera in Fase 3) */}
        <div
          className="absolute inset-x-0 bottom-0 flex h-[45%] items-end justify-around px-4 pb-16 text-viewfinder-ink/15"
          aria-hidden="true"
        >
          <Trees className="size-20" strokeWidth={1} />
          <Building2 className="size-32" strokeWidth={1} />
          <Building2 className="size-20" strokeWidth={1} />
        </div>
        <UserRound
          className="absolute left-1/2 top-[16%] size-28 -translate-x-1/2 text-viewfinder-ink/20"
          strokeWidth={1}
          aria-hidden="true"
        />

        {/* Small face guide at the top: the rest of the frame shows the place */}
        <div
          className="absolute left-1/2 top-[12%] h-[24%] w-[36%] -translate-x-1/2 rounded-[50%] border-2 border-dashed border-viewfinder-ink/70"
          aria-hidden="true"
        />
        <span className="absolute left-1/2 top-[37%] -translate-x-1/2 rounded-full bg-viewfinder/70 px-2.5 py-0.5 text-[12px] font-medium">
          Tu rostro
        </span>

        {/* Corner marks: the whole frame matters, not only the face */}
        <span
          className="absolute left-4 top-4 size-8 rounded-tl-xl border-l-2 border-t-2 border-viewfinder-ink/60"
          aria-hidden="true"
        />
        <span
          className="absolute right-4 top-4 size-8 rounded-tr-xl border-r-2 border-t-2 border-viewfinder-ink/60"
          aria-hidden="true"
        />
        <span
          className="absolute bottom-4 left-4 size-8 rounded-bl-xl border-b-2 border-l-2 border-viewfinder-ink/60"
          aria-hidden="true"
        />
        <span
          className="absolute bottom-4 right-4 size-8 rounded-br-xl border-b-2 border-r-2 border-viewfinder-ink/60"
          aria-hidden="true"
        />
        <span className="absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-viewfinder/70 px-2.5 py-0.5 text-[12px] font-medium">
          El lugar donde estás
        </span>
      </div>

      <div className="flex flex-col items-center px-6 pb-8 pt-5 text-center">
        <p className="text-[16px] font-semibold">Que se vean tu rostro y el lugar</p>
        <p className="mt-1 max-w-xs text-[14px] text-viewfinder-ink/75">
          Estira el brazo y deja ver lo que hay detrás de ti.
        </p>
        <button
          type="button"
          onClick={onCapture}
          className="mt-5 grid size-20 place-items-center rounded-full border-4 border-viewfinder-ink/90 transition-transform active:scale-95"
          aria-label="Tomar selfie"
        >
          <span className="size-[60px] rounded-full bg-viewfinder-ink" aria-hidden="true" />
        </button>
        <p className="mt-3 text-[12px] text-viewfinder-ink/75">
          Cámara frontal · No se guardan fotos en tu celular.
        </p>
      </div>
    </div>
  );
}
