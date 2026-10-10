import { Camera, Check, Clock, MapPin, Smartphone } from 'lucide-react';
import { CONSENT_LABEL } from '@pj20/shared/constants';
import { Checkbox, RadioGroup } from 'radix-ui';
import { type ReactNode, useId, useState } from 'react';

import { Button } from '../../../components/ui/button.js';
import { Card } from '../../../components/ui/card.js';
import { cn } from '../../../lib/cn.js';
import { EmployeeLayout } from '../components/employee-layout.js';

interface ConsentScreenProps {
  /** `selfie`: the employee's own, separate decision about the sensitive photo. */
  onAccept?: (selfie: boolean) => void;
  /**
   * full: first use (general consent + selfie decision).
   * selfie-only: the general consent is already given; only the selfie is asked.
   */
  mode?: 'full' | 'selfie-only';
  busy?: boolean;
}

/**
 * Informed consent (Ley 1581 de 2012). The selfie is sensitive data: it gets
 * its OWN authorization, apart from the general one, and the employee is told
 * they are not obliged to give it (Decreto 1377 de 2013, art. 6) — D7.
 */
export function ConsentScreen({ onAccept, mode = 'full', busy = false }: ConsentScreenProps) {
  const [accepted, setAccepted] = useState(mode === 'selfie-only');
  const [selfie, setSelfie] = useState<'yes' | 'no' | ''>('');
  const checkboxId = useId();
  const selfieLabelId = useId();

  return (
    <EmployeeLayout>
      <h1 className="mt-10 text-[26px] font-semibold tracking-tight">
        {mode === 'full' ? 'Tus datos, con transparencia' : 'Tu decisión sobre la selfie'}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
        {mode === 'full'
          ? 'Para registrar tu asistencia, BLAZAR ENERGY usa estos datos solo en el momento de marcar:'
          : 'La selfie es opcional. Cuéntanos si la autorizas; puedes cambiarlo cuando quieras.'}
      </p>

      {mode === 'full' && (
        <Card className="mt-6 p-0">
          <ul className="divide-y divide-line">
            <DataItem icon={<MapPin className="size-5" />} title="Ubicación">
              Solo en el instante en que marcas. Nunca te rastreamos durante el día.
            </DataItem>
            <DataItem icon={<Clock className="size-5" />} title="Hora">
              La pone el servidor, no tu celular: así nadie puede alterarla.
            </DataItem>
            <DataItem icon={<Smartphone className="size-5" />} title="Tu celular">
              Identificamos el dispositivo para evitar que otra persona marque por ti.
            </DataItem>
          </ul>
        </Card>
      )}

      <Card className="mt-6">
        <div className="flex gap-4">
          <span className="mt-0.5 text-info" aria-hidden="true">
            <Camera className="size-5" />
          </span>
          <div>
            <p id={selfieLabelId} className="text-[15px] font-semibold">
              Selfie al marcar · opcional
            </p>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">
              Una foto de tu rostro y del lugar donde estás, para confirmar que eres tú y que estás
              en tu sitio de trabajo. Es un <strong className="text-ink">dato sensible</strong>:
              solo la ven los administradores y se borra a los 90 días.
            </p>
            <p className="mt-2 text-[14px] font-medium leading-relaxed text-ink">
              No estás obligado a autorizarla. Si no la autorizas, marcarás solo con tu ubicación y
              la hora, y tus marcaciones aparecerán como «sin selfie».
            </p>
          </div>
        </div>
        <RadioGroup.Root
          aria-labelledby={selfieLabelId}
          value={selfie}
          onValueChange={(value) => {
            setSelfie(value === 'yes' || value === 'no' ? value : '');
          }}
          className="mt-4 grid gap-2"
        >
          <SelfieOption value="yes" checked={selfie === 'yes'}>
            Sí, autorizo la selfie
          </SelfieOption>
          <SelfieOption value="no" checked={selfie === 'no'}>
            No autorizo la selfie
          </SelfieOption>
        </RadioGroup.Root>
      </Card>

      <p className="mt-5 text-[14px] leading-relaxed text-ink-muted">
        Puedes consultar, actualizar o pedir la eliminación de tus datos cuando quieras (Ley 1581 de
        2012).{' '}
        <a
          href={`${import.meta.env.BASE_URL}privacidad`}
          target="_blank"
          rel="noopener"
          className="font-medium text-link underline underline-offset-2"
        >
          Leer la política completa
        </a>
      </p>

      <div className="sticky bottom-0 -mx-6 mt-auto border-t border-line bg-canvas px-6 pb-safe-2 pt-5">
        {mode === 'full' && (
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
              He leído la política y acepto el tratamiento de mis datos para el control de
              asistencia.
            </label>
          </div>
        )}
        <Button
          size="lg"
          block
          className="mt-5"
          loading={busy}
          disabled={!accepted || selfie === ''}
          onClick={() => onAccept?.(selfie === 'yes')}
        >
          {mode === 'full' ? 'Aceptar y continuar' : 'Guardar mi decisión'}
        </Button>
        <p className="mt-3 text-center text-[12px] text-ink-muted">{CONSENT_LABEL}</p>
      </div>
    </EmployeeLayout>
  );
}

function SelfieOption({
  value,
  checked,
  children,
}: {
  value: 'yes' | 'no';
  checked: boolean;
  children: ReactNode;
}) {
  return (
    <RadioGroup.Item
      value={value}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] ring-1 ring-line transition-colors',
        checked && 'ring-2 ring-primary',
      )}
    >
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full ring-2 ring-line-strong',
          checked && 'ring-primary',
        )}
        aria-hidden="true"
      >
        <RadioGroup.Indicator className="size-2.5 rounded-full bg-primary" />
      </span>
      {children}
    </RadioGroup.Item>
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
