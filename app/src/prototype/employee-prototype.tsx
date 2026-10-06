import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';

import { type AttendanceKind } from '../features/employee/model.js';
import { ClockScreen } from '../features/employee/screens/clock-screen.js';
import { ConfirmationScreen } from '../features/employee/screens/confirmation-screen.js';
import { ConsentScreen } from '../features/employee/screens/consent-screen.js';
import { LoginScreen } from '../features/employee/screens/login-screen.js';
import { PermissionsScreen } from '../features/employee/screens/permissions-screen.js';
import {
  type ProblemKind,
  ProblemScreen,
  problemKinds,
} from '../features/employee/screens/problem-screen.js';
import { SelfieScreen } from '../features/employee/screens/selfie-screen.js';
import { AFTERNOON, MORNING, offDuty, onDuty, searchingGps, weakGps } from './scenarios.js';

const base = '/prototipo/empleado';

/** Spanish URL value ↔ attendance kind. */
const kindFromParam = (value: string | null): AttendanceKind =>
  value === 'salida' ? 'check_out' : 'check_in';
const paramFromKind = (kind: AttendanceKind) => (kind === 'check_out' ? 'salida' : 'entrada');

/**
 * Renders any employee screen with prototype data and wires the buttons so the
 * whole flow can be walked through: login → consentimiento → permisos → marcar
 * → selfie → confirmación → marcar.
 */
export function EmployeePrototype() {
  const { pantalla = '', problema = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Administrators also mark; the "rol" param keeps that context through the flow.
  const isAdmin = params.get('rol') === 'admin';
  const go = (path: string) => {
    const role = isAdmin ? `${path.includes('?') ? '&' : '?'}rol=admin` : '';
    void navigate(`${base}/${path}${role}`);
  };
  const adminProps = isAdmin
    ? {
        onOpenAdmin: () => {
          void navigate('/prototipo/admin');
        },
      }
    : {};

  switch (pantalla) {
    case 'login':
      return (
        <LoginScreen
          onGoogle={() => {
            go('consentimiento');
          }}
        />
      );
    case 'consentimiento':
      return (
        <ConsentScreen
          onAccept={() => {
            go('permisos');
          }}
        />
      );
    case 'permisos':
      return (
        <PermissionsScreen
          onRequest={() => {
            go('marcar');
          }}
        />
      );
    case 'marcar': {
      const working = params.get('turno') === 'en';
      const gps = params.get('gps');
      const view =
        gps === 'buscando' ? searchingGps : gps === 'debil' ? weakGps : working ? onDuty : offDuty;
      const kind: AttendanceKind = working ? 'check_out' : 'check_in';
      return (
        <ClockScreen
          view={view}
          now={working ? AFTERNOON : MORNING}
          {...adminProps}
          onMark={() => {
            go(gps === 'debil' ? 'problema/weak-signal' : `selfie?tipo=${paramFromKind(kind)}`);
          }}
        />
      );
    }
    case 'selfie': {
      const kind = kindFromParam(params.get('tipo'));
      return (
        <SelfieScreen
          kind={kind}
          onCapture={() => {
            go(`confirmacion?tipo=${paramFromKind(kind)}`);
          }}
          onCancel={() => {
            go(kind === 'check_out' ? 'marcar?turno=en' : 'marcar');
          }}
        />
      );
    }
    case 'confirmacion': {
      const kind = kindFromParam(params.get('tipo'));
      return (
        <ConfirmationScreen
          kind={kind}
          serverTime={kind === 'check_out' ? AFTERNOON : MORNING}
          accuracyM={6}
          onDone={() => {
            go(kind === 'check_in' ? 'marcar?turno=en' : 'marcar');
          }}
        />
      );
    }
    case 'problema':
      if ((problemKinds as readonly string[]).includes(problema)) {
        return (
          <ProblemScreen
            kind={problema as ProblemKind}
            onPrimary={() => {
              go('marcar');
            }}
            onSecondary={() => {
              go('selfie?tipo=entrada');
            }}
          />
        );
      }
      return <Navigate to="/prototipo" replace />;
    default:
      return <Navigate to="/prototipo" replace />;
  }
}
