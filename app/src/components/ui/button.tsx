import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 rounded-2xl font-semibold transition-[transform,opacity,background-color] duration-150 ease-(--ease-standard) active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-ink hover:opacity-90',
        secondary: 'bg-surface text-ink ring-1 ring-line ring-inset hover:bg-line/60',
        ghost: 'text-ink hover:bg-surface',
        danger: 'bg-danger-soft text-danger hover:opacity-90',
      },
      size: {
        md: 'h-11 px-5 text-[15px]',
        lg: 'h-14 px-6 text-[17px]',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  className,
  variant,
  size,
  block,
  loading = false,
  icon,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}
