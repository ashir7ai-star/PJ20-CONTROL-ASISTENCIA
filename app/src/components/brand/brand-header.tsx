import logoDark from '../../assets/brand/logo-dark.png';
import logoLight from '../../assets/brand/logo-light.png';
import { cn } from '../../lib/cn.js';

/**
 * Official BLAZAR logo. Follows the app theme (not only the OS): the
 * white-wordmark version is shown in dark mode. The hidden image is
 * display:none, so screen readers announce the logo once.
 */
export function Logo({ className }: { className?: string }) {
  const common = { alt: 'BLAZAR ENERGY', width: 749, height: 110, decoding: 'async' } as const;
  return (
    <>
      <img src={logoLight} {...common} className={cn('h-9 w-auto dark:hidden', className)} />
      <img src={logoDark} {...common} className={cn('hidden h-9 w-auto dark:block', className)} />
    </>
  );
}

/** App header required by the brand rules: logo on top, "Control de Asistencia" below. */
export function BrandHeader({ className }: { className?: string }) {
  return (
    <header className={cn('flex flex-col items-center', className)}>
      <Logo />
      <p className="mt-2 text-[13px] font-medium tracking-wide text-ink-muted">
        Control de Asistencia
      </p>
    </header>
  );
}
