import { Fingerprint, LayoutDashboard, LayoutGrid, ListTree, UserRound } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { cn } from '../lib/cn.js';

/**
 * Prototype-only navigation (Fase 1). Lets reviewers jump between the
 * employee and admin views on a phone. Not part of the real app.
 */
export function PrototypeMenu({ placement }: { placement: 'top-left' | 'bottom-right' }) {
  const navigate = useNavigate();
  const go = (to: string) => {
    void navigate(to);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          'fixed z-40 grid size-11 place-items-center rounded-full bg-surface-raised/90 text-ink shadow-lg ring-1 ring-line backdrop-blur transition-colors hover:bg-surface',
          placement === 'top-left'
            ? 'left-2 top-[max(env(safe-area-inset-top),8px)]'
            : 'bottom-24 right-4 lg:bottom-6',
        )}
        aria-label="Menú del prototipo"
      >
        <LayoutGrid className="size-5" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={placement === 'top-left' ? 'start' : 'end'}
          sideOffset={6}
          className="z-50 min-w-64 rounded-2xl bg-surface-raised p-1.5 text-ink shadow-xl ring-1 ring-line data-[state=open]:animate-[fade-in_150ms_var(--ease-standard)]"
        >
          <DropdownMenu.Label className="px-3 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
            Prototipo
          </DropdownMenu.Label>
          <Item
            icon={<ListTree className="size-4" />}
            onSelect={() => {
              go('/prototipo');
            }}
          >
            Índice de pantallas
          </Item>
          <Item
            icon={<UserRound className="size-4" />}
            onSelect={() => {
              go('/prototipo/empleado/marcar');
            }}
          >
            Ver como empleado
          </Item>
          <Item
            icon={<Fingerprint className="size-4" />}
            onSelect={() => {
              go('/prototipo/empleado/marcar?rol=admin');
            }}
          >
            Marcar como administrador
          </Item>
          <Item
            icon={<LayoutDashboard className="size-4" />}
            onSelect={() => {
              go('/prototipo/admin');
            }}
          >
            Panel del administrador
          </Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Item({
  icon,
  children,
  onSelect,
}: {
  icon: ReactNode;
  children: ReactNode;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex h-11 cursor-pointer select-none items-center gap-3 rounded-xl px-3 text-[15px] font-medium outline-none data-highlighted:bg-surface"
    >
      <span className="text-ink-muted" aria-hidden="true">
        {icon}
      </span>
      {children}
    </DropdownMenu.Item>
  );
}
