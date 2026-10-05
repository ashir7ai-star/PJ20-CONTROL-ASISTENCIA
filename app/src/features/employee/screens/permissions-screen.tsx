import { Camera, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '../../../components/ui/button.js';
import { Card } from '../../../components/ui/card.js';
import { EmployeeLayout } from '../components/employee-layout.js';

interface PermissionsScreenProps {
  onRequest?: () => void;
}

/** Explains WHY before the system dialog appears — far fewer "Denegar" taps. */
export function PermissionsScreen({ onRequest }: PermissionsScreenProps) {
  return (
    <EmployeeLayout>
      <h1 className="mt-10 text-[26px] font-semibold tracking-tight">Antes de empezar</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
        Para marcar, la aplicación necesita dos permisos de tu celular.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <PermissionCard icon={<MapPin className="size-6" />} title="Ubicación">
          Registra desde dónde marcas. Solo se usa en ese momento.
        </PermissionCard>
        <PermissionCard icon={<Camera className="size-6" />} title="Cámara">
          Toma una selfie al marcar para confirmar que eres tú.
        </PermissionCard>
      </div>

      <div className="mt-auto pt-8">
        <p className="mb-4 text-center text-[14px] leading-relaxed text-ink-muted">
          Tu celular te preguntará. Elige <strong className="text-ink">«Permitir»</strong> o{' '}
          <strong className="text-ink">«Mientras se usa la app»</strong>.
        </p>
        <Button size="lg" block onClick={onRequest}>
          Permitir acceso
        </Button>
      </div>
    </EmployeeLayout>
  );
}

function PermissionCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex gap-4 p-5">
      <span
        className="grid size-12 shrink-0 place-items-center rounded-2xl bg-info-soft text-info"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div>
        <p className="text-[16px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[14px] leading-relaxed text-ink-muted">{children}</p>
      </div>
    </Card>
  );
}
