import {
  ClipboardList,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  ShieldAlert,
  Smartphone,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';

import { Logo } from '../../../components/brand/brand-header.js';
import { Avatar } from '../../../components/ui/avatar.js';
import { ThemeMenu } from '../../../components/ui/theme-menu.js';
import { cn } from '../../../lib/cn.js';

export interface AdminNavCounts {
  review: number;
  devices: number;
}

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
  count?: keyof AdminNavCounts;
}

const nav: NavItem[] = [
  { to: '', label: 'Resumen', short: 'Resumen', icon: LayoutDashboard },
  { to: 'marcaciones', label: 'Marcaciones', short: 'Marcaciones', icon: ClipboardList },
  { to: 'revision', label: 'Por revisar', short: 'Revisar', icon: ShieldAlert, count: 'review' },
  { to: 'empleados', label: 'Empleados', short: 'Empleados', icon: Users },
  { to: 'celulares', label: 'Celulares', short: 'Celulares', icon: Smartphone, count: 'devices' },
];

interface AdminLayoutProps {
  basePath: string;
  admin: { name: string; initials: string };
  counts: AdminNavCounts;
  markHref: string;
  children: ReactNode;
}

/** Admin shell: sidebar on desktop, top bar + bottom tab bar on phones. */
export function AdminLayout({ basePath, admin, counts, markHref, children }: AdminLayoutProps) {
  const href = (to: string) => (to ? `${basePath}/${to}` : basePath);

  return (
    <div className="min-h-dvh bg-surface text-ink">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-surface-raised px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo className="h-7" />
          <p className="mt-1.5 text-[12px] font-medium tracking-wide text-ink-muted">
            Control de Asistencia
          </p>
        </div>

        <nav aria-label="Panel de administración" className="mt-8 flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={href(item.to)}
              end={item.to === ''}
              className={({ isActive }) =>
                cn(
                  'flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors',
                  isActive
                    ? 'bg-info-soft text-info'
                    : 'text-ink-muted hover:bg-surface hover:text-ink',
                )
              }
            >
              <item.icon className="size-5" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {item.count && counts[item.count] > 0 && <CountBadge value={counts[item.count]} />}
            </NavLink>
          ))}
        </nav>

        <Link
          to={markHref}
          className="mt-6 flex h-11 items-center gap-3 rounded-xl bg-primary px-3 text-[15px] font-semibold text-primary-ink transition-opacity hover:opacity-90"
        >
          <Fingerprint className="size-5" aria-hidden="true" />
          Marcar mi asistencia
        </Link>

        <div className="mt-auto flex items-center gap-3 rounded-2xl p-2">
          <Avatar initials={admin.initials} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold">{admin.name}</p>
            <p className="text-[12px] text-ink-muted">Administrador</p>
          </div>
          <ThemeMenu />
          <button
            type="button"
            className="grid size-11 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface hover:text-ink"
            aria-label="Cerrar sesión"
          >
            <LogOut className="size-5" aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface-raised/95 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur lg:hidden">
        <div>
          <Logo className="h-6" />
          <p className="mt-1 text-[11px] font-medium tracking-wide text-ink-muted">
            Control de Asistencia
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ThemeMenu />
          <Link
            to={markHref}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-ink"
          >
            <Fingerprint className="size-4" aria-hidden="true" />
            Marcar
          </Link>
        </div>
      </header>

      <main className="px-4 pb-28 pt-6 sm:px-6 lg:ml-64 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Mobile tab bar */}
      <nav
        aria-label="Menú inferior del panel"
        className="safe-area fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface-raised/95 backdrop-blur lg:hidden"
      >
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={href(item.to)}
            end={item.to === ''}
            className={({ isActive }) =>
              cn(
                'relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                isActive ? 'text-info' : 'text-ink-muted',
              )
            }
          >
            <item.icon className="size-5" aria-hidden="true" />
            {item.short}
            {item.count && counts[item.count] > 0 && (
              <CountBadge value={counts[item.count]} className="absolute right-[22%] top-1.5" />
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function CountBadge({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        'grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-canvas',
        className,
      )}
    >
      {value}
      <span className="sr-only"> pendientes</span>
    </span>
  );
}
