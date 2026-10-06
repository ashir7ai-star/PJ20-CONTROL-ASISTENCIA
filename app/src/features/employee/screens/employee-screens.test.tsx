import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  AFTERNOON,
  MORNING,
  offDuty,
  onDuty,
  searchingGps,
  weakGps,
} from '../../../prototype/scenarios.js';
import { a11yViolations } from '../../../test/a11y.js';
import { ClockScreen } from './clock-screen.js';
import { ConfirmationScreen } from './confirmation-screen.js';
import { ConsentScreen } from './consent-screen.js';
import { LoginScreen } from './login-screen.js';
import { PermissionsScreen } from './permissions-screen.js';
import { ProblemScreen, problemKinds, problems } from './problem-screen.js';
import { SelfieScreen } from './selfie-screen.js';

const screens: [string, ReactElement][] = [
  ['Iniciar sesión', <LoginScreen key="login" />],
  ['Consentimiento', <ConsentScreen key="consent" />],
  ['Permisos', <PermissionsScreen key="perm" />],
  ['Marcar · fuera de turno', <ClockScreen key="off" view={offDuty} now={MORNING} />],
  ['Marcar · en turno', <ClockScreen key="on" view={onDuty} now={AFTERNOON} />],
  ['Marcar · buscando GPS', <ClockScreen key="gps" view={searchingGps} now={MORNING} />],
  ['Selfie', <SelfieScreen key="selfie" kind="check_in" />],
  [
    'Confirmación',
    <ConfirmationScreen key="ok" kind="check_in" serverTime={MORNING} accuracyM={6} />,
  ],
  ...problemKinds.map((kind): [string, ReactElement] => [
    `Error · ${problems[kind].title}`,
    <ProblemScreen key={kind} kind={kind} />,
  ]),
];

describe('accesibilidad (axe · WCAG 2.1 AA)', () => {
  it.each(screens)('%s: 0 violaciones', async (_name, element) => {
    const { container } = render(element);
    expect(await a11yViolations(container)).toEqual([]);
  });
});

describe('Marcar', () => {
  it('fuera de turno: ofrece marcar entrada y muestra la hora en español', () => {
    render(<ClockScreen view={offDuty} now={MORNING} />);
    expect(screen.getByRole('button', { name: 'Marcar entrada' })).toBeEnabled();
    expect(screen.getByText('Fuera de turno')).toBeInTheDocument();
    expect(screen.getByText(/Lunes, 5 de octubre/)).toBeInTheDocument();
    expect(screen.getByText('a. m.')).toBeInTheDocument();
    expect(screen.getByText(/Última marcación: Salida · 5:04 p\. m\./)).toBeInTheDocument();
  });

  it('en turno: ofrece marcar salida y muestra el tiempo trabajado', () => {
    render(<ClockScreen view={onDuty} now={AFTERNOON} />);
    expect(screen.getByRole('button', { name: 'Marcar salida' })).toBeEnabled();
    expect(screen.getByText(/En turno · 4 h 43 min/)).toBeInTheDocument();
  });

  it('sin ubicación todavía: el botón se deshabilita y se informa', () => {
    render(<ClockScreen view={searchingGps} now={MORNING} />);
    expect(screen.getByRole('button', { name: 'Marcar entrada' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Buscando tu ubicación…');
  });

  it('señal débil: avisa con el margen de error', () => {
    render(<ClockScreen view={weakGps} now={MORNING} />);
    expect(screen.getByText('Señal débil ± 180 m')).toBeInTheDocument();
  });

  it('llama a onMark al tocar el botón', () => {
    const onMark = vi.fn();
    render(<ClockScreen view={offDuty} now={MORNING} onMark={onMark} />);
    fireEvent.click(screen.getByRole('button', { name: 'Marcar entrada' }));
    expect(onMark).toHaveBeenCalledOnce();
  });
});

describe('Consentimiento', () => {
  it('no permite continuar sin aceptar', () => {
    const onAccept = vi.fn();
    render(<ConsentScreen onAccept={onAccept} />);
    const button = screen.getByRole('button', { name: 'Aceptar y continuar' });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it('menciona la Ley 1581 y la versión del texto', () => {
    render(<ConsentScreen />);
    expect(screen.getByText(/Ley 1581 de\s+2012/)).toBeInTheDocument();
    expect(screen.getByText(/Versión 1/)).toBeInTheDocument();
  });
});

describe('Errores', () => {
  it.each(problemKinds)('%s: se anuncia como alerta con una acción clara', (kind) => {
    render(<ProblemScreen kind={kind} />);
    expect(screen.getByRole('alert')).toHaveTextContent(problems[kind].title);
    expect(screen.getByRole('button', { name: problems[kind].primary })).toBeInTheDocument();
  });

  it('ubicación falsa: informa que el intento quedó registrado', () => {
    render(<ProblemScreen kind="mock-location" />);
    expect(screen.getByText(/quedó registrado/)).toBeInTheDocument();
  });
});

describe('Confirmación', () => {
  it('muestra la hora del servidor y el tipo de marcación', () => {
    render(<ConfirmationScreen kind="check_out" serverTime={AFTERNOON} accuracyM={6} />);
    expect(screen.getByRole('heading', { name: 'Salida registrada' })).toBeInTheDocument();
    expect(screen.getByText('12:41')).toBeInTheDocument();
    expect(screen.getByText('Registrada por el servidor')).toBeInTheDocument();
  });
});

describe('Selfie', () => {
  it('pide que se vean el rostro y el lugar de trabajo', () => {
    render(<SelfieScreen kind="check_in" />);
    expect(screen.getByText('Que se vean tu rostro y el lugar')).toBeInTheDocument();
    expect(screen.getByText(/deja ver lo que hay detrás de ti/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tomar selfie' })).toBeInTheDocument();
  });

  it('el consentimiento informa que la foto incluye el lugar', () => {
    render(<ConsentScreen />);
    expect(screen.getByText(/Muestra tu rostro y el lugar donde estás/)).toBeInTheDocument();
  });
});

describe('Marcar · acceso al panel', () => {
  it('un empleado NO ve el botón del panel de administración', () => {
    render(<ClockScreen view={offDuty} now={MORNING} />);
    expect(screen.queryByRole('button', { name: /panel de administración/i })).toBeNull();
  });

  it('un administrador ve el botón y puede volver a su panel', () => {
    const onOpenAdmin = vi.fn();
    render(<ClockScreen view={offDuty} now={MORNING} onOpenAdmin={onOpenAdmin} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ir al panel de administración' }));
    expect(onOpenAdmin).toHaveBeenCalledOnce();
  });
});

describe('Botón Pulso', () => {
  it('late (anillos animados) cuando está listo para marcar', () => {
    render(<ClockScreen view={offDuty} now={MORNING} />);
    expect(screen.getByTestId('pulse-ring')).toBeInTheDocument();
  });

  it('no anima mientras busca la ubicación (botón deshabilitado)', () => {
    render(<ClockScreen view={searchingGps} now={MORNING} />);
    expect(screen.queryByTestId('pulse-ring')).toBeNull();
  });

  it('la pantalla Marcar ofrece el control de apariencia', () => {
    render(<ClockScreen view={offDuty} now={MORNING} />);
    expect(screen.getByRole('button', { name: 'Apariencia' })).toBeInTheDocument();
  });
});
