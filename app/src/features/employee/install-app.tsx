/**
 * "Instala la app" (D9): a discreet invitation on the sign-in and Marcar
 * screens. Android with Chrome's dialog installs in one tap; otherwise the
 * step-by-step guide opens (loaded on demand: the sign-in screen stays light).
 */
import { Smartphone, X } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';

import { Button } from '../../components/ui/button.js';
import { cn } from '../../lib/cn.js';
import { dismissInstall, promptInstall, useInstall } from '../../lib/install.js';

export const InstallGuide = lazy(() =>
  import('./install-guide.js').then((m) => ({ default: m.InstallGuide })),
);

/** Card shown until the app is installed or the person closes it. */
export function InstallInvite({ className }: { className?: string }) {
  const install = useInstall();
  const [guide, setGuide] = useState(false);
  if (!install.available || install.dismissed) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl bg-surface p-3 pl-4 ring-1 ring-line',
        className,
      )}
    >
      <Smartphone className="size-5 shrink-0 text-info" aria-hidden="true" />
      <p className="flex-1 text-left text-[14px] leading-snug">
        <span className="block font-semibold">Instala la app</span>
        <span className="block text-ink-muted">Ábrela desde tu pantalla de inicio.</span>
      </p>
      <Button
        variant="secondary"
        onClick={() => {
          if (install.canPrompt) void promptInstall();
          else setGuide(true);
        }}
      >
        Instalar
      </Button>
      <button
        type="button"
        onClick={dismissInstall}
        className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-line/60"
        aria-label="No mostrar de nuevo"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
      {guide && (
        <Suspense fallback={null}>
          <InstallGuide
            open
            onClose={() => {
              setGuide(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
