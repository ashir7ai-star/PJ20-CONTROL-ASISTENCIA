/** Step-by-step install guide for this phone (D9), from the invitation or the menu. */
import { EllipsisVertical, Share, SquarePlus } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '../../components/ui/button.js';
import { Sheet } from '../../components/ui/sheet.js';
import { type Install, promptInstall, useInstall } from '../../lib/install.js';

export function InstallGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const install = useInstall();
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      title="Instala la app"
      description="Queda en tu pantalla de inicio con el ícono de BLAZAR y abre sin el navegador."
      {...(install.canPrompt
        ? {
            footer: (
              <Button
                block
                size="lg"
                onClick={() => {
                  void promptInstall().then(onClose);
                }}
              >
                Instalar ahora
              </Button>
            ),
          }
        : {})}
    >
      <Steps install={install} />
    </Sheet>
  );
}

function Steps({ install }: { install: Install }) {
  if (install.installed) {
    return <p className="text-[15px]">La app ya está instalada en este celular.</p>;
  }
  const browser = install.platform === 'ios' ? 'Safari' : 'Chrome';
  const steps: ReactNode[] = [];
  if (install.inAppBrowser) {
    steps.push(
      <>
        Abre este enlace en <strong>{browser}</strong>: toca el menú de esta pantalla y elige «Abrir
        en {browser}».
      </>,
    );
  }
  if (install.platform === 'ios') {
    steps.push(
      <>
        Toca <strong>Compartir</strong> <InlineIcon icon={Share} /> en la barra de Safari. Si no lo
        ves, toca primero <strong>···</strong>.
      </>,
      <>
        Desliza hacia abajo y toca <strong>Agregar a pantalla de inicio</strong>{' '}
        <InlineIcon icon={SquarePlus} />.
      </>,
      <>
        Toca <strong>Agregar</strong>.
      </>,
    );
  } else if (install.platform === 'android') {
    steps.push(
      <>
        Toca el menú <InlineIcon icon={EllipsisVertical} /> de Chrome, arriba a la derecha.
      </>,
      <>
        Toca <strong>Instalar app</strong> o <strong>Agregar a la pantalla principal</strong>.
      </>,
      <>
        Confirma con <strong>Instalar</strong>.
      </>,
    );
  } else if (!install.canPrompt) {
    steps.push(<>Abre este mismo enlace desde tu celular y sigue los pasos que verás allí.</>);
  }

  return (
    <div className="flex flex-col gap-6">
      {steps.length > 0 && (
        <ol className="flex flex-col gap-4">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-4 text-[15px] leading-relaxed">
              <span
                className="grid size-8 shrink-0 place-items-center rounded-full bg-info-soft text-[14px] font-semibold text-info"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="pt-1">{step}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-[14px] text-ink-muted">
        Después, abre la app desde el ícono de BLAZAR e inicia sesión allí una vez.
      </p>
    </div>
  );
}

function InlineIcon({ icon: Icon }: { icon: typeof Share }) {
  return <Icon className="inline size-5 -translate-y-0.5 text-info" aria-hidden="true" />;
}
