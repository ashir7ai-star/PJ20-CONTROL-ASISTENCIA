import { LogIn } from 'lucide-react';
import type { ReactNode } from 'react';

import { BrandHeader } from '../components/brand/brand-header.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { StatusBadge } from '../components/ui/status-badge.js';
import { PulseButton } from '../features/employee/components/pulse-button.js';
import { cn } from '../lib/cn.js';

/** Swatch classes must be literal strings so Tailwind can generate them. */
const colorGroups: { title: string; swatches: { token: string; className: string }[] }[] = [
  {
    title: 'Marca BLAZAR',
    swatches: [
      { token: 'brand-navy', className: 'bg-brand-navy' },
      { token: 'brand-green', className: 'bg-brand-green' },
      { token: 'brand-blue', className: 'bg-brand-blue' },
    ],
  },
  {
    title: 'Superficies y texto',
    swatches: [
      { token: 'canvas', className: 'bg-canvas' },
      { token: 'surface', className: 'bg-surface' },
      { token: 'surface-raised', className: 'bg-surface-raised' },
      { token: 'line', className: 'bg-line' },
      { token: 'ink', className: 'bg-ink' },
      { token: 'ink-muted', className: 'bg-ink-muted' },
    ],
  },
  {
    title: 'Acciones',
    swatches: [
      { token: 'primary', className: 'bg-primary' },
      { token: 'check-in', className: 'bg-check-in' },
      { token: 'check-out', className: 'bg-check-out' },
      { token: 'ring', className: 'bg-ring' },
    ],
  },
  {
    title: 'Estados',
    swatches: [
      { token: 'success', className: 'bg-success' },
      { token: 'warning', className: 'bg-warning' },
      { token: 'danger', className: 'bg-danger' },
      { token: 'info', className: 'bg-info' },
    ],
  },
];

const typeScale = [
  { label: 'Reloj · 76 / Light', className: 'text-[76px] font-light leading-none tracking-tight' },
  { label: 'Título · 28 / Semibold', className: 'text-[28px] font-semibold tracking-tight' },
  { label: 'Subtítulo · 20 / Semibold', className: 'text-[20px] font-semibold' },
  { label: 'Cuerpo · 16 / Regular', className: 'text-[16px]' },
  { label: 'Secundario · 14 / Regular', className: 'text-[14px] text-ink-muted' },
  { label: 'Nota · 12 / Medium', className: 'text-[12px] font-medium text-ink-muted' },
];

/** Living catalogue of tokens and components (development tool, Spanish UI). */
export function DesignCatalog() {
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <BrandHeader />
        <h1 className="mt-10 text-[32px] font-semibold tracking-tight">Sistema de diseño</h1>
        <p className="mt-2 text-[15px] text-ink-muted">
          Dirección visual «Pulso». Cambia el tema de tu equipo (claro/oscuro) para ver ambos.
        </p>

        <Block title="Colores">
          {colorGroups.map((group) => (
            <div key={group.title} className="mt-4">
              <h3 className="text-[14px] font-semibold">{group.title}</h3>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {group.swatches.map((s) => (
                  <div key={s.token}>
                    <div className={cn('h-14 rounded-xl ring-1 ring-line', s.className)} />
                    <p className="mt-1.5 font-mono text-[12px] text-ink-muted">{s.token}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Block>

        <Block title="Tipografía · Inter">
          <div className="mt-4 flex flex-col gap-4">
            {typeScale.map((t) => (
              <div key={t.label} className="flex flex-col gap-1">
                <span className="text-[12px] text-ink-muted">{t.label}</span>
                <span className={t.className}>
                  {t.label.startsWith('Reloj') ? '7:58' : 'Control de Asistencia'}
                </span>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Botones">
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button>Principal</Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="ghost">Discreto</Button>
            <Button variant="danger">Peligro</Button>
            <Button loading>Guardando</Button>
            <Button disabled>Deshabilitado</Button>
            <Button size="lg" icon={<LogIn className="size-5" aria-hidden="true" />}>
              Grande con ícono
            </Button>
          </div>
        </Block>

        <Block title="Botón Pulso">
          <div className="mt-4 flex flex-wrap items-center justify-center gap-10 rounded-3xl bg-pulse py-10">
            <PulseButton kind="check_in" />
            <PulseButton kind="check_out" />
            <PulseButton kind="check_in" disabled />
          </div>
        </Block>

        <Block title="Insignias de estado">
          <div className="mt-4 flex flex-wrap gap-3">
            <StatusBadge>Fuera de turno</StatusBadge>
            <StatusBadge tone="success">En turno</StatusBadge>
            <StatusBadge tone="warning">Señal débil</StatusBadge>
            <StatusBadge tone="danger">Ubicación falsa</StatusBadge>
            <StatusBadge tone="info">Pendiente de revisión</StatusBadge>
          </div>
        </Block>

        <Block title="Tarjeta y carga">
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Card>
              <p className="text-[16px] font-semibold">Tarjeta</p>
              <p className="mt-1 text-[14px] text-ink-muted">
                Contenedor estándar con borde suave.
              </p>
            </Card>
            <Card aria-label="Cargando">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-2/3" />
            </Card>
          </div>
        </Block>
      </main>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-[20px] font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
