import {
  CircleAlert,
  Clock,
  Download,
  type LucideIcon,
  MapPinOff,
  ShieldAlert,
  ShieldX,
  UserX,
  Signal,
  Smartphone,
  WifiOff,
} from 'lucide-react';

import { Button } from '../../../components/ui/button.js';
import { cn } from '../../../lib/cn.js';
import { EmployeeLayout } from '../components/employee-layout.js';

export const problemKinds = [
  'gps-off',
  'permission-denied',
  'offline',
  'weak-signal',
  'mock-location',
  'device-not-authorized',
  'session-expired',
  'android-browser',
  'not-authorized',
  'mark-failed',
] as const;

export type ProblemKind = (typeof problemKinds)[number];

type Tone = 'warning' | 'danger' | 'info';

interface ProblemContent {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  body: string;
  primary: string;
  secondary?: string;
  note?: string;
}

/** Every failure explains what happened AND what to do, in plain Spanish (CLAUDE.md §8.3). */
export const problems: Record<ProblemKind, ProblemContent> = {
  'gps-off': {
    icon: MapPinOff,
    tone: 'warning',
    title: 'Activa la ubicación',
    body: 'Para marcar necesitamos saber dónde estás. Activa la ubicación (GPS) en los ajustes de tu celular y vuelve a intentarlo.',
    primary: 'Intentar de nuevo',
  },
  'permission-denied': {
    icon: ShieldAlert,
    tone: 'warning',
    title: 'Permiso bloqueado',
    body: 'La aplicación no tiene permiso para usar la ubicación o la cámara. Ve a Ajustes → Aplicaciones → Control de Asistencia → Permisos y permite «Ubicación» y «Cámara».',
    primary: 'Ya lo activé',
  },
  offline: {
    icon: WifiOff,
    tone: 'warning',
    title: 'Sin conexión a internet',
    body: 'La hora de tu marcación la registra el servidor, por eso necesitas internet para marcar. Revisa tus datos móviles o tu wifi.',
    primary: 'Intentar de nuevo',
  },
  'weak-signal': {
    icon: Signal,
    tone: 'warning',
    title: 'Señal de GPS débil',
    body: 'Tu ubicación tiene un margen de ± 180 m. Sal a un lugar abierto o acércate a una ventana y espera unos segundos.',
    primary: 'Intentar de nuevo',
    secondary: 'Marcar de todas formas',
    note: 'Si marcas así, tu administrador revisará la marcación.',
  },
  'mock-location': {
    icon: ShieldX,
    tone: 'danger',
    title: 'Ubicación falsa detectada',
    body: 'Tu celular está usando una aplicación que cambia la ubicación. Desactívala en Opciones de desarrollador → «Aplicación de ubicación simulada» para poder marcar.',
    primary: 'Ya la desactivé',
    note: 'Este intento quedó registrado y fue informado a tu administrador.',
  },
  'device-not-authorized': {
    icon: Smartphone,
    tone: 'info',
    title: 'Este celular no está autorizado',
    body: 'Tu cuenta está vinculada a otro celular. Pide a tu administrador que apruebe este dispositivo para poder marcar desde aquí.',
    primary: 'Solicitar aprobación',
  },
  'session-expired': {
    icon: Clock,
    tone: 'info',
    title: 'Tu sesión terminó',
    body: 'Por seguridad, vuelve a iniciar sesión con tu cuenta de Google.',
    primary: 'Iniciar sesión',
  },
  'android-browser': {
    icon: Download,
    tone: 'info',
    title: 'Usa la aplicación de Android',
    body: 'En celulares Android solo se puede marcar desde la aplicación oficial de BLAZAR. Descárgala e instálala; solo toma un minuto.',
    primary: 'Descargar aplicación',
  },
  'not-authorized': {
    icon: UserX,
    tone: 'danger',
    title: 'Tu cuenta no está autorizada',
    body: 'Inicia sesión con el correo que registró BLAZAR ENERGY. Si crees que es un error, pide acceso a tu administrador.',
    primary: 'Usar otra cuenta',
  },
  'mark-failed': {
    icon: CircleAlert,
    tone: 'danger',
    title: 'No se pudo registrar',
    body: 'Tu marcación no quedó guardada. Revisa tu conexión e inténtalo de nuevo.',
    primary: 'Intentar de nuevo',
    secondary: 'Volver',
  },
};

const toneStyles: Record<Tone, string> = {
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

interface ProblemScreenProps {
  kind: ProblemKind;
  /** Replaces the default explanation (e.g. exact accuracy, iPhone vs Android steps). */
  body?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

export function ProblemScreen({ kind, body, onPrimary, onSecondary }: ProblemScreenProps) {
  const content = problems[kind];
  const Icon = content.icon;
  return (
    <EmployeeLayout>
      <section className="mt-16 flex flex-col items-center text-center" role="alert">
        <span
          className={cn('grid size-20 place-items-center rounded-full', toneStyles[content.tone])}
        >
          <Icon className="size-9" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-[26px] font-semibold tracking-tight">{content.title}</h1>
        <p className="mt-3 max-w-sm text-[16px] leading-relaxed text-ink-muted">
          {body ?? content.body}
        </p>
        {content.note && (
          <p
            className={cn(
              'mt-5 rounded-2xl px-4 py-3 text-[14px] font-medium',
              toneStyles[content.tone],
            )}
          >
            {content.note}
          </p>
        )}
      </section>

      <div className="mt-auto flex flex-col gap-3 pt-10">
        <Button size="lg" block onClick={onPrimary}>
          {content.primary}
        </Button>
        {/* Never a button without an action. */}
        {content.secondary && onSecondary && (
          <Button size="lg" variant="ghost" block onClick={onSecondary}>
            {content.secondary}
          </Button>
        )}
      </div>
    </EmployeeLayout>
  );
}
