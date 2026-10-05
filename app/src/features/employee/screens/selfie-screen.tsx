import { UserRound, X } from 'lucide-react';

import { type AttendanceKind, attendanceLabels } from '../model.js';

interface SelfieScreenProps {
  kind: AttendanceKind;
  onCapture?: () => void;
  onCancel?: () => void;
}

/**
 * Live selfie capture (front camera only, never the gallery — CLAUDE.md §2B.6).
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

      <div className="relative mx-4 mt-4 flex flex-1 items-center justify-center overflow-hidden rounded-[32px] bg-viewfinder-glow">
        <UserRound className="size-40 text-viewfinder-ink/15" strokeWidth={1} aria-hidden="true" />
        {/* Face guide */}
        <div
          className="absolute h-[58%] w-[62%] rounded-[50%] border-2 border-dashed border-viewfinder-ink/70"
          aria-hidden="true"
        />
        <p className="absolute bottom-6 left-0 right-0 text-center text-[15px] font-medium">
          Ubica tu rostro dentro del óvalo
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 px-6 pb-8 pt-6">
        <button
          type="button"
          onClick={onCapture}
          className="grid size-20 place-items-center rounded-full border-4 border-viewfinder-ink/90 transition-transform active:scale-95"
          aria-label="Tomar selfie"
        >
          <span className="size-[60px] rounded-full bg-viewfinder-ink" aria-hidden="true" />
        </button>
        <p className="text-center text-[13px] text-viewfinder-ink/75">
          Se usa la cámara frontal. No se guardan fotos en tu celular.
        </p>
      </div>
    </div>
  );
}
