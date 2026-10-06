import logoDark from '../../assets/brand/logo-dark.png';
import logoLight from '../../assets/brand/logo-light.png';
import { cn } from '../../lib/cn.js';

/** Official BLAZAR logo, switching to the white-wordmark version in dark mode. */
export function Logo({ className }: { className?: string }) {
  return (
    <picture>
      <source srcSet={logoDark} media="(prefers-color-scheme: dark)" />
      <img
        src={logoLight}
        alt="BLAZAR ENERGY"
        width={749}
        height={110}
        decoding="async"
        className={cn('h-9 w-auto', className)}
      />
    </picture>
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
