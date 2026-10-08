/**
 * Frame of the REAL admin pages (Marcaciones, Empleados): brand header, tabs,
 * back to Marcar and sign-out. It confirms the session is an administrator's
 * before rendering anything; the server checks every request anyway.
 */
import type { Me } from '@pj20/shared';
import { Fingerprint, LogOut } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';

import { api } from '../../api/client.js';
import { AppLoading } from '../../components/brand/app-loading.js';
import { Logo } from '../../components/brand/brand-header.js';
import { ThemeMenu } from '../../components/ui/theme-menu.js';
import { cn } from '../../lib/cn.js';

const tabs = [
  { to: '/admin', label: 'Marcaciones' },
  { to: '/admin/empleados', label: 'Empleados' },
];

export function AdminShell({ children }: { children: (me: Me) => ReactNode }) {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Me>('/me').then(
      (user) => {
        if (cancelled) return;
        if (user.role === 'admin') setMe(user);
        else void navigate('/', { replace: true });
      },
      () => {
        if (!cancelled) void navigate('/', { replace: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    await navigate('/', { replace: true });
  };

  if (!me) return <AppLoading />;

  return (
    <div className="safe-area min-h-dvh bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface-raised/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-3">
          <div>
            <Logo className="h-6" />
            <p className="mt-1 text-[11px] font-medium tracking-wide text-ink-muted">
              Control de Asistencia
            </p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeMenu />
            <button
              type="button"
              onClick={() => void logout()}
              className="grid size-11 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              aria-label="Cerrar sesión"
            >
              <LogOut className="size-5" aria-hidden="true" />
            </button>
            <Link
              to="/"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-ink"
            >
              <Fingerprint className="size-4" aria-hidden="true" />
              Marcar
            </Link>
          </div>
        </div>
        <nav aria-label="Secciones del panel" className="mx-auto flex max-w-3xl gap-1 px-4">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end
              className={({ isActive }) =>
                cn(
                  'inline-flex h-11 items-center border-b-2 px-3 text-[14px] font-semibold transition-colors',
                  isActive
                    ? 'border-primary text-ink'
                    : 'border-transparent text-ink-muted hover:text-ink',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">{children(me)}</main>
    </div>
  );
}
