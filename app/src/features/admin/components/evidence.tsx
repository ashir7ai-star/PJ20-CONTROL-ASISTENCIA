import { Camera, MapPin } from 'lucide-react';

import { Avatar } from '../../../components/ui/avatar.js';
import { cn } from '../../../lib/cn.js';
import { formatAccuracy } from '../../../lib/format.js';

/**
 * Selfie preview. Fase 1 shows a placeholder; from Fase 6 it loads the real
 * photo through a short-lived signed URL (CLAUDE.md §2B.6).
 */
export function SelfiePreview({ initials, className }: { initials: string; className?: string }) {
  return (
    <figure
      className={cn(
        'relative grid aspect-[3/4] place-items-center overflow-hidden rounded-2xl bg-viewfinder-glow',
        className,
      )}
    >
      <Avatar initials={initials} size="lg" />
      <figcaption className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-viewfinder/70 px-2 py-0.5 text-[11px] font-medium text-viewfinder-ink">
        <Camera className="size-3" aria-hidden="true" />
        Selfie
      </figcaption>
    </figure>
  );
}

/**
 * Location preview. Fase 1: stylised placeholder with the real coordinates;
 * the interactive OpenStreetMap map arrives in Fase 6.
 */
export function MapPreview({
  lat,
  lng,
  accuracyM,
  place,
  className,
}: {
  lat: number;
  lng: number;
  accuracyM: number;
  place: string;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        'relative grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl bg-surface ring-1 ring-line',
        className,
      )}
    >
      <div
        className="absolute inset-0 bg-[linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] bg-size-[28px_28px] opacity-70"
        aria-hidden="true"
      />
      <span className="relative grid size-16 place-items-center rounded-full bg-info-soft ring-8 ring-info-soft/60">
        <MapPin className="size-7 text-info" aria-hidden="true" />
      </span>
      <figcaption className="absolute inset-x-2 bottom-2 rounded-xl bg-surface-raised/95 px-3 py-2 text-[12px] ring-1 ring-line">
        <span className="font-semibold">{place}</span>
        <span className="block text-ink-muted tabular-nums">
          {lat.toFixed(5)}, {lng.toFixed(5)} · {formatAccuracy(accuracyM)}
        </span>
      </figcaption>
    </figure>
  );
}
