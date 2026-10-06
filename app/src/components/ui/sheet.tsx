import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "side" panel on desktop; "center" modal for short forms. */
  variant?: 'side' | 'center';
}

/**
 * Accessible overlay (Radix Dialog): focus trap, Escape to close, scroll lock.
 * Side panel on desktop, bottom sheet on phones.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  variant = 'side',
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-brand-navy/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_200ms_var(--ease-standard)]" />
        <Dialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          onOpenAutoFocus={(event) => {
            // Forms: start typing right away. Panels: focus the panel itself
            // (not the close button) so screen readers announce the title.
            event.preventDefault();
            const panel = event.currentTarget as HTMLElement;
            const field = panel.querySelector<HTMLElement>('input, select, textarea');
            (variant === 'center' && field ? field : panel).focus();
          }}
          className={cn(
            'fixed z-50 flex flex-col bg-surface-raised text-ink shadow-2xl ring-1 ring-line focus:outline-none',
            variant === 'side'
              ? 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-3xl data-[state=open]:animate-[slide-up_250ms_var(--ease-standard)] sm:data-[state=open]:animate-[slide-left_250ms_var(--ease-standard)]'
              : 'inset-x-4 top-1/2 mx-auto max-w-md -translate-y-1/2 rounded-3xl data-[state=open]:animate-[fade-in_200ms_var(--ease-standard)]',
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div>
              <Dialog.Title className="text-[18px] font-semibold tracking-tight">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-[14px] text-ink-muted">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface"
              aria-label="Cerrar"
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="border-t border-line px-6 py-4">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
