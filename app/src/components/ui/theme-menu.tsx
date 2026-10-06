import { Check, Moon, SunMedium, SunMoon } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { cn } from '../../lib/cn.js';
import { type ThemePreference, setPreference, useThemePreference } from '../../lib/theme.js';

const options: { value: ThemePreference; label: string; hint?: string }[] = [
  { value: 'system', label: 'Automático', hint: 'Igual que el celular' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

const icons = { system: SunMoon, light: SunMedium, dark: Moon } as const;

/** "Apariencia": automático / claro / oscuro, remembered on this device. */
export function ThemeMenu({ className }: { className?: string }) {
  const preference = useThemePreference();
  const Icon = icons[preference];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          'grid size-11 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface hover:text-ink data-[state=open]:bg-surface',
          className,
        )}
        aria-label="Apariencia"
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
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
