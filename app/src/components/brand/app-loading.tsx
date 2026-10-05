import { BrandHeader } from './brand-header.js';

/**
 * Shown while a lazily-loaded section (admin panel, catalogue) downloads.
 * Never a blank screen (CLAUDE.md Regla suprema B.8).
 */
export function AppLoading() {
  return (
    <div className="bg-pulse grid min-h-dvh place-items-center text-ink" role="status">
      <div className="flex flex-col items-center">
        <BrandHeader />
        <span
          className="mt-10 size-10 animate-spin rounded-full border-[3px] border-line border-t-ring motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span className="sr-only">Cargando…</span>
      </div>
    </div>
  );
}
