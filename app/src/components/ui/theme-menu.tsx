import { Camera, Check, LogOut, Moon, Smartphone, SunMedium, SunMoon } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { cn } from '../../lib/cn.js';
import { type ThemePreference, setPreference, useThemePreference } from '../../lib/theme.js';

const options: { value: ThemePreference; label: string; hint?: string }[] = [
  { value: 'dark', label: 'Oscuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Automático', hint: 'Igual que el celular' },
];

const icons = { system: SunMoon, light: SunMedium, dark: Moon } as const;

/** "Apariencia": automático / claro / oscuro, remembered on this device. */
export function ThemeMenu({
  className,
  onLogout,
  onSelfieSettings,
  onInstall,
}: {
  className?: string;
  /** When present, the menu also offers "Cerrar sesión". */
  onLogout?: () => void;
  /** When present: "Autorización de selfie" (change of mind at any time, D7). */
  onSelfieSettings?: () => void;
  /** When present: "Instalar la app" (D9). */
  onInstall?: () => void;
}) {
  const preference = useThemePreference();
  const Icon = icons[preference];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          'grid size-11 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface hover:text-ink data-[state=open]:bg-surface',
          className,
        )}
        aria-label={onLogout ? 'Cuenta y apariencia' : 'Apariencia'}
      >
        <Icon className="size-5" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-56 rounded-2xl bg-surface-raised p-1.5 text-ink shadow-xl ring-1 ring-line data-[state=open]:animate-[fade-in_150ms_var(--ease-standard)]"
        >
          <DropdownMenu.Label className="px-3 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
            Apariencia
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={preference}
            onValueChange={(value) => {
              setPreference(value as ThemePreference);
            }}
          >
            {options.map((option) => (
              <DropdownMenu.RadioItem
                key={option.value}
                value={option.value}
                className="flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-xl px-3 text-[15px] outline-none data-highlighted:bg-surface"
              >
                <span className="flex-1">
                  <span className="block font-medium">{option.label}</span>
                  {option.hint && (
                    <span className="block text-[12px] text-ink-muted">{option.hint}</span>
                  )}
                </span>
                <DropdownMenu.ItemIndicator>
                  <Check className="size-4 text-info" aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          {onSelfieSettings && (
            <>
              <DropdownMenu.Separator className="my-1.5 h-px bg-line" />
              <DropdownMenu.Item
                onSelect={onSelfieSettings}
                className="flex h-11 cursor-pointer select-none items-center gap-3 rounded-xl px-3 text-[15px] font-medium outline-none data-highlighted:bg-surface"
              >
                <Camera className="size-4" aria-hidden="true" />
                Autorización de selfie
              </DropdownMenu.Item>
            </>
          )}
          {onInstall && (
            <>
              <DropdownMenu.Separator className="my-1.5 h-px bg-line" />
              <DropdownMenu.Item
                onSelect={onInstall}
                className="flex h-11 cursor-pointer select-none items-center gap-3 rounded-xl px-3 text-[15px] font-medium outline-none data-highlighted:bg-surface"
              >
                <Smartphone className="size-4" aria-hidden="true" />
                Instalar la app
              </DropdownMenu.Item>
            </>
          )}
          {onLogout && (
            <>
              <DropdownMenu.Separator className="my-1.5 h-px bg-line" />
              <DropdownMenu.Item
                onSelect={onLogout}
                className="flex h-11 cursor-pointer select-none items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-danger outline-none data-highlighted:bg-danger-soft"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Cerrar sesión
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
