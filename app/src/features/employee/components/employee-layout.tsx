import type { ReactNode } from 'react';

import { BrandHeader } from '../../../components/brand/brand-header.js';
import { cn } from '../../../lib/cn.js';

interface EmployeeLayoutProps {
  children: ReactNode;
  /** Hide the brand header on immersive screens (camera). */
  bare?: boolean;
  className?: string;
}

/** Shared frame for every employee screen: Pulso background, safe areas, brand header. */
export function EmployeeLayout({ children, bare = false, className }: EmployeeLayoutProps) {
  return (
    <div className="bg-pulse safe-area min-h-dvh text-ink">
      <main className={cn('mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-8', className)}>
        {!bare && <BrandHeader className="pt-10" />}
        {children}
      </main>
    </div>
  );
}
