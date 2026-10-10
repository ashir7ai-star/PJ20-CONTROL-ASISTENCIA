/**
 * Frame of the REAL admin pages (Marcaciones, Empleados): brand header, tabs,
 * back to Marcar and sign-out. It confirms the session is an administrator's
 * before rendering anything; the server checks every request anyway.
 */
import type { AccessRequestDto, BackupStatus, Me } from '@pj20/shared';
import { DatabaseBackup, Fingerprint, LogOut, TriangleAlert } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';

import { api } from '../../api/client.js';
import { AppLoading } from '../../components/brand/app-loading.js';
import { Logo } from '../../components/brand/brand-header.js';
import { ThemeMenu } from '../../components/ui/theme-menu.js';
import { cn } from '../../lib/cn.js';
import { formatLongDate, formatTime } from '../../lib/format.js';

const tabs = [
  { to: '/admin', label: 'Marcaciones' },
  { to: '/admin/empleados', label: 'Empleados' },
];

export interface ShellTools {
  /** Re-reads the counters shown on the tabs (e.g. after resolving a request). */
  refreshCounts: () => void;
}

export function AdminShell({ children }: { children: (me: Me, tools: ShellTools) => ReactNode }) {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [backups, setBackups] = useState<BackupStatus | null>(null);
  const [countsVersion, setCountsVersion] = useState(0);
  const refreshCounts = useCallback(() => {
    setCountsVersion((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    api<AccessRequestDto[]>('/admin/access-requests').then(
      (requests) => {
        if (!cancelled) setPendingRequests(requests.length);
      },
      () => undefined, // A badge is a hint: never block the page for it.
    );
    api<BackupStatus>('/admin/backups').then(
      (status) => {
        if (!cancelled) setBackups(status);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [me, countsVersion]);

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
              {tab.to === '/admin/empleados' && pendingRequests > 0 && (
                <span className="ml-2 grid min-w-5 place-items-center rounded-full bg-warning px-1.5 text-[12px] font-bold text-canvas">
                  {pendingRequests}
                  <span className="sr-only"> solicitudes de acceso pendientes</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
      {backups?.stale && <BackupAlert status={backups} />}
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        {children(me, { refreshCounts })}
        {backups && !backups.stale && backups.database.lastSuccessAt && (
          <p className="mt-10 flex items-center justify-center gap-2 text-[13px] text-ink-muted">
            <DatabaseBackup className="size-4" aria-hidden="true" />
            Última copia de seguridad: {when(backups.database.lastSuccessAt)} ✓
          </p>
        )}
      </main>
    </div>
  );
}

const when = (iso: string) => {
  const at = new Date(iso);
  return `${formatLongDate(at)}, ${formatTime(at)}`;
};

/** Backups stopped (D8): impossible to miss, with what to do. */
function BackupAlert({ status }: { status: BackupStatus }) {
  const { lastSuccessAt, lastFailure } = status.database;
  return (
    <div role="alert" className="border-b border-line bg-danger-soft text-danger">
      <div className="mx-auto flex max-w-3xl gap-3 px-4 py-3 text-[14px]">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>
          <strong className="font-semibold">Las copias de seguridad no están al día.</strong>{' '}
          {lastSuccessAt
            ? `La última copia buena es del ${when(lastSuccessAt)}.`
            : 'Todavía no hay ninguna copia de los registros.'}{' '}
          {lastFailure?.detail && `Último error: ${lastFailure.detail}. `}
          Revisa el servicio «pj20-asistencia-respaldos» en Easypanel (guía de respaldos).
        </p>
      </div>
    </div>
  );
}
