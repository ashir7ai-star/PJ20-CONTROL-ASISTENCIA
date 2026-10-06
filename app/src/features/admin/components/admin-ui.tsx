import { LogIn, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';

import { StatusBadge } from '../../../components/ui/status-badge.js';
import { cn } from '../../../lib/cn.js';
import type { AttendanceKind } from '../../employee/model.js';
import { type AttendanceRecord, reviewLabels } from '../model.js';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight lg:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** "Entrada" / "Salida" with direction icon. */
export function KindLabel({ kind, className }: { kind: AttendanceKind; className?: string }) {
  const Icon = kind === 'check_in' ? LogIn : LogOut;
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', className)}>
      <Icon
        className={cn('size-4', kind === 'check_in' ? 'text-success' : 'text-ink-muted')}
        aria-hidden="true"
      />
      {kind === 'check_in' ? 'Entrada' : 'Salida'}
    </span>
  );
}

const reviewTone = {
  ok: 'neutral',
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
} as const;

export function ReviewBadge({ review }: { review: AttendanceRecord['review'] }) {
  return <StatusBadge tone={reviewTone[review]}>{reviewLabels[review]}</StatusBadge>;
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('rounded-3xl bg-surface-raised p-5 ring-1 ring-line sm:p-6', className)}
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <span
        className="grid size-14 place-items-center rounded-full bg-surface text-ink-muted"
        aria-hidden="true"
      >
        {icon}
      </span>
      <p className="mt-4 text-[16px] font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-[14px] text-ink-muted">{body}</p>
    </div>
  );
}
