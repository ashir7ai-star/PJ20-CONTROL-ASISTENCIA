import { Camera, Check, MapPin, Smartphone } from 'lucide-react';
import { Checkbox } from 'radix-ui';
import { type ReactNode, useId, useState } from 'react';

import { Button } from '../../../components/ui/button.js';
import { Card } from '../../../components/ui/card.js';
import { EmployeeLayout } from '../components/employee-layout.js';

/** Version of the consent text. Stored with each acceptance (CLAUDE.md §3.2). */
export const CONSENT_VERSION = 'Versión 1 · octubre de 2026';

interface ConsentScreenProps {
  onAccept?: () => void;
}

/** Informed consent required by Colombian law (Ley 1581 de 2012) before first use. */
export function ConsentScreen({ onAccept }: ConsentScreenProps) {
  const [accepted, setAccepted] = useState(false);
  const checkboxId = useId();

  return (
    <EmployeeLayout>
      <h1 className="mt-10 text-[26px] font-semibold tracking-tight">
        Tus datos, con transparencia
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
        Para registrar tu asistencia, BLAZAR ENERGY usa estos datos únicamente al momento de marcar:
      </p>

      <Card className="mt-6 p-0">
        <ul className="divide-y divide-line">
          <DataItem icon={<MapPin className="size-5" />} title="Ubicación">
            Solo en el instante en que marcas. Nunca te rastreamos durante el día.
          </DataItem>
          <DataItem icon={<Camera className="size-5" />} title="Fotografía (selfie)">
            Muestra tu rostro y el lugar donde estás al marcar, para confirmar que eres tú y que
            estás en tu sitio de trabajo. Es un dato sensible: solo la ven los administradores.
          </DataItem>
          <DataItem icon={<Smartphone className="size-5" />} title="Tu celular">
            Identificamos el dispositivo para evitar que otra persona marque por ti.
          </DataItem>
        </ul>
      </Card>

      <p className="mt-5 text-[14px] leading-relaxed text-ink-muted">
        Puedes consultar, actualizar o pedir la eliminación de tus datos cuando quieras (Ley 1581 de
        2012).{' '}
        <a href="#politica" className="font-medium text-link underline underline-offset-2">
          Leer la política completa
        </a>
      </p>

      <div className="sticky bottom-0 -mx-6 mt-auto border-t border-line bg-canvas px-6 pb-2 pt-5">
        <div className="flex items-start gap-3">
          <Checkbox.Root
            id={checkboxId}
            checked={accepted}
            onCheckedChange={(value) => {
              setAccepted(value === true);
            }}
            className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md ring-2 ring-line-strong transition-colors data-[state=checked]:bg-primary data-[state=checked]:ring-primary"
          >
            <Checkbox.Indicator>
              <Check className="size-4 text-primary-ink" strokeWidth={3} aria-hidden="true" />
            </Checkbox.Indicator>
          </Checkbox.Root>
          <label htmlFor={checkboxId} className="text-[15px] leading-snug">
            He leído y acepto el tratamiento de mis datos personales.
          </label>
        </div>
        <Button size="lg" block className="mt-5" disabled={!accepted} onClick={onAccept}>
          Aceptar y continuar
        </Button>
        <p className="mt-3 text-center text-[12px] text-ink-muted">{CONSENT_VERSION}</p>
      </div>
    </EmployeeLayout>
  );
}

function DataItem({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-4 px-5 py-4">
      <span className="mt-0.5 text-info" aria-hidden="true">
        {icon}
      </span>
      <div>
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[14px] leading-relaxed text-ink-muted">{children}</p>
      </div>
    </li>
  );
}
