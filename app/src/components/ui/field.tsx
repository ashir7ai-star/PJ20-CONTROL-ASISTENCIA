import { ChevronDown, Search } from 'lucide-react';
import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useId } from 'react';

import { cn } from '../../lib/cn.js';

const control =
  'h-11 w-full rounded-xl bg-surface-raised px-3.5 text-[15px] text-ink ring-1 ring-line-strong transition-shadow placeholder:text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';

interface FieldProps {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
  className?: string;
}

/** Label + control + hint, correctly associated for screen readers. */
export function Field({ label, hint, children, className }: FieldProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[14px] font-medium">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-[13px] text-ink-muted">{hint}</p>}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <input type="search" className={cn(control, 'pl-10')} {...props} />
    </div>
  );
}

/** Native select: best accessibility and the platform picker on phones. */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(control, 'appearance-none pr-10')} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
    </div>
  );
}
