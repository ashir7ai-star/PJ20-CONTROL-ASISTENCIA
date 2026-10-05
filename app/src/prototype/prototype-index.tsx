import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import { BrandHeader } from '../components/brand/brand-header.js';
import { problems } from '../features/employee/screens/problem-screen.js';

interface Entry {
  label: string;
  to: string;
}

const employeeFlow: Entry[] = [
  { label: 'Iniciar sesión', to: '/prototipo/empleado/login' },
  { label: 'Consentimiento de datos', to: '/prototipo/empleado/consentimiento' },
  { label: 'Permisos de ubicación y cámara', to: '/prototipo/empleado/permisos' },
  { label: 'Marcar · fuera de turno', to: '/prototipo/empleado/marcar' },
  { label: 'Marcar · en turno', to: '/prototipo/empleado/marcar?turno=en' },
  { label: 'Marcar · buscando GPS', to: '/prototipo/empleado/marcar?gps=buscando' },
  { label: 'Marcar · señal débil', to: '/prototipo/empleado/marcar?gps=debil' },
  { label: 'Selfie', to: '/prototipo/empleado/selfie?tipo=entrada' },
  { label: 'Confirmación de entrada', to: '/prototipo/empleado/confirmacion?tipo=entrada' },
  { label: 'Confirmación de salida', to: '/prototipo/empleado/confirmacion?tipo=salida' },
];

const errorScreens: Entry[] = Object.entries(problems).map(([kind, content]) => ({
  label: content.title,
  to: `/prototipo/empleado/problema/${kind}`,
}));

const tools: Entry[] = [
  { label: 'Sistema de diseño', to: '/diseno' },
  { label: 'Estado del sistema', to: '/estado' },
];

/** Index of every prototype screen, for review and approval (Fase 1). */
export function PrototypeIndex() {
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <main className="mx-auto max-w-2xl px-6 py-12">
        <BrandHeader />
        <h1 className="mt-10 text-[28px] font-semibold tracking-tight">Prototipo · Fase 1</h1>
        <p className="mt-2 text-[15px] text-ink-muted">
          Datos de ejemplo. Toca una pantalla para verla; los botones recorren el flujo completo.
        </p>
        <Section title="Empleado" entries={employeeFlow} />
        <Section title="Mensajes de error" entries={errorScreens} />
        <Section title="Herramientas" entries={tools} />
      </main>
    </div>
  );
}

function Section({ title, entries }: { title: string; entries: Entry[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-muted">{title}</h2>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl bg-surface-raised ring-1 ring-line">
        {entries.map((entry) => (
          <li key={entry.to}>
            <Link
              to={entry.to}
              className="flex min-h-12 items-center justify-between px-5 py-3 text-[15px] transition-colors hover:bg-surface"
            >
              {entry.label}
              <ChevronRight className="size-4 text-ink-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
