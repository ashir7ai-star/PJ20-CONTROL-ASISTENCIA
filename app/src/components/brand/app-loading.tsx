import { BrandHeader } from './brand-header.js';

/**
 * Shown while a lazily-loaded section (admin panel, catalogue) downloads.
 * Never a blank screen (CLAUDE.md Regla suprema B.8).
 */
/** `label`: what is happening, shown and announced (default: generic loading). */
export function AppLoading({ label }: { label?: string } = {}) {
  return (
    <div className="bg-pulse grid min-h-dvh place-items-center text-ink" role="status">
      <div className="flex flex-col items-center">
        <BrandHeader />
        <span
          className="mt-10 size-10 animate-spin rounded-full border-[3px] border-line border-t-ring motion-reduce:animate-none"
          aria-hidden="true"
        />
        {label ? (
          <p className="mt-4 text-[15px] text-ink-muted">{label}</p>
        ) : (
          <span className="sr-only">Cargando…</span>
        )}
      </div>
    </div>
  );
}
