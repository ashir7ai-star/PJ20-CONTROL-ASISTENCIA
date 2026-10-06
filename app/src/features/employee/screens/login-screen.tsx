import { ShieldCheck } from 'lucide-react';

import { Logo } from '../../../components/brand/brand-header.js';

interface LoginScreenProps {
  onGoogle?: () => void;
}

export function LoginScreen({ onGoogle }: LoginScreenProps) {
  return (
    <div className="bg-pulse safe-area min-h-dvh text-ink">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10">
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <Logo className="h-12" />
          <h1 className="mt-3 text-[17px] font-medium tracking-wide text-ink-muted">
            Control de Asistencia
          </h1>
          <p className="mt-10 max-w-xs text-[22px] font-semibold leading-snug tracking-tight">
            Registra tu entrada y tu salida en segundos.
          </p>
        </section>

        <div className="flex flex-col gap-4">
          <GoogleButton {...(onGoogle ? { onClick: onGoogle } : {})} />
          <p className="text-center text-[13px] leading-relaxed text-ink-muted">
            <ShieldCheck className="mr-1.5 inline size-4 -translate-y-px" aria-hidden="true" />
            Solo pueden ingresar los correos autorizados por BLAZAR ENERGY.
          </p>
        </div>
      </main>
    </div>
  );
}

/**
 * "Continuar con Google" following Google's sign-in branding guidelines
 * (official multicolour "G", neutral button, theme-aware).
 */
function GoogleButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-surface-raised text-[16px] font-semibold text-ink shadow-sm ring-1 ring-line-strong transition-[transform,background-color] duration-150 hover:bg-surface active:scale-[0.98]"
    >
      <svg className="size-5" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
      Continuar con Google
    </button>
  );
}
