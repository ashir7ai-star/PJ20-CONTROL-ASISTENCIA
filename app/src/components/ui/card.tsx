import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/cn.js';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-3xl bg-surface-raised p-6 shadow-sm ring-1 ring-line', className)}
      {...props}
    />
  );
}
