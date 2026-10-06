import type { ReactNode } from 'react';

import { BrandHeader } from '../../../components/brand/brand-header.js';
import { cn } from '../../../lib/cn.js';

interface EmployeeLayoutProps {
  children: ReactNode;
  /** Hide the brand header on immersive screens (camera). */
  bare?: boolean;
  /** Small action in the top-right corner (44 px; clears the logo even at 360 px). */
  topRight?: ReactNode;
  className?: string;
}

/** Shared frame for every employee screen: Pulso background, safe areas, brand header. */
export function EmployeeLayout({
  children,
  bare = false,
  topRight,
  className,
}: EmployeeLayoutProps) {
  return (
    <div className="bg-pulse safe-area min-h-dvh text-ink">
      <main
        className={cn(
          'relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-8',
          className,
        )}
      >
        {topRight && <div className="absolute right-2 top-2 z-10">{topRight}</div>}
        {!bare && <BrandHeader className="pt-10" />}
        {children}
      </main>
    </div>
  );
}
