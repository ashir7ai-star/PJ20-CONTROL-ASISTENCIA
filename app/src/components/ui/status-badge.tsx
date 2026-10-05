import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

const badgeVariants = cva(
  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold',
  {
    variants: {
      tone: {
        neutral: 'bg-surface text-ink-muted',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

const dotColor = {
  neutral: 'bg-ink-muted',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
} as const;

export interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
}

export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      <span className={cn('size-2 rounded-full', dotColor[tone ?? 'neutral'])} aria-hidden="true" />
      {children}
    </span>
  );
}
