/**
 * Prototype data for the admin panel (Fase 1): 30 employees and one realistic
 * Monday, including the suspicious cases the panel must surface.
 */
import type {
  AttendanceRecord,
  BlockedAttempt,
  DeviceRequest,
  Employee,
} from '../features/admin/model.js';

const names = [
  'Laura Gómez',
  'Andrés Rodríguez',
  'Valentina Martínez',
  'Santiago López',
  'Camila Hernández',
  'Juan Pablo García',
  'María José Díaz',
  'Sebastián Torres',
  'Daniela Ramírez',
  'Felipe Castro',
  'Natalia Vargas',
  'Carlos Moreno',
  'Isabella Rojas',
  'Mateo Jiménez',
  'Sofía Ortiz',
  'David Ruiz',
  'Gabriela Mendoza',
  'Alejandro Suárez',
  'Paula Herrera',
  'Nicolás Aguilar',
  'Mariana Ríos',
  'Diego Cárdenas',
  'Juliana Peña',
  'Esteban Salazar',
  'Carolina Medina',
  'Tomás Guerrero',
  'Ana María Castillo',
  'Julián Ospina',
  'Manuela Restrepo',
  'Ricardo Patiño',
];

const devices = [
  'Samsung Galaxy A15',
  'Xiaomi Redmi 13',
  'Motorola Moto G54',
  'iPhone 13',
  'Samsung Galaxy A35',
];

const slug = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '.');

export const employees: Employee[] = names.map((name, i) => {
  const model = devices[i % devices.length] ?? 'Samsung Galaxy A15';
  return {
    id: `e${String(i + 1).padStart(2, '0')}`,
    name,
    email: i % 3 === 0 ? `${slug(name)}@blazarenergy.com` : `${slug(name)}@gmail.com`,
    role: i < 2 ? 'admin' : 'employee',
    active: i !== 29,
    device: i === 27 ? null : { model, platform: model.startsWith('iPhone') ? 'ios' : 'android' },
  };
});

export const employeeById = new Map(employees.map((e) => [e.id, e]));

/** Colombia is UTC-5: 07:00 local = 12:00Z. */
const at = (h: number, m: number) => new Date(Date.UTC(2026, 9, 5, h + 5, m));

const office = { lat: 4.6738, lng: -74.0536, place: 'Sede principal · Bogotá' };
const field = { lat: 4.6097, lng: -74.0817, place: 'Obra · Centro, Bogotá' };

function record(
  n: number,
  employeeIndex: number,
  kind: AttendanceRecord['kind'],
  time: Date,
  extra: Partial<AttendanceRecord> = {},
): AttendanceRecord {
  const employee = employees[employeeIndex];
  const model = employee?.device?.model ?? 'Samsung Galaxy A15';
  const ios = model.startsWith('iPhone');
  const base = employeeIndex % 4 === 0 ? field : office;
  return {
    id: `m${String(n).padStart(3, '0')}`,
    employeeId: employee?.id ?? 'e01',
    kind,
    serverTime: time,
    deviceTime: new Date(time.getTime() - 3_000),
    location: {
      lat: base.lat + ((employeeIndex % 7) - 3) * 0.0002,
      lng: base.lng + ((employeeIndex % 5) - 2) * 0.0002,
      accuracyM: 4 + (employeeIndex % 9),
      place: base.place,
    },
    device: {
      model,
      os: ios ? 'iOS 18' : 'Android 14',
      app: ios ? 'PWA' : 'App Android 1.0.0',
      verified: true,
    },
    ip: `190.85.${String(10 + employeeIndex)}.${String(20 + n)}`,
    signals: [],
    review: 'ok',
    ...extra,
  };
}

const checkIns: [number, number, number][] = [
  [0, 6, 58],
  [1, 7, 2],
  [2, 6, 49],
  [3, 7, 11],
  [4, 6, 55],
  [5, 7, 0],
  [6, 7, 4],
  [7, 6, 52],
  [8, 7, 15],
  [9, 6, 59],
  [10, 7, 1],
  [11, 7, 8],
  [12, 6, 57],
  [13, 7, 3],
  [14, 7, 22],
  [15, 6, 54],
  [16, 7, 6],
  [17, 7, 0],
  [18, 6, 51],
  [19, 7, 9],
  [20, 7, 31],
  [21, 6, 58],
  [22, 7, 5],
  [23, 7, 12],
];

export const records: AttendanceRecord[] = [
  ...checkIns.map(([i, h, m], n) => record(n + 1, i, 'check_in', at(h, m))),
  // Suspicious cases
  // iPhone (PWA): identical, perfectly precise coordinates on every mark.
  record(30, 28, 'check_in', at(7, 14), {
    signals: ['suspicious-coordinates'],
    review: 'pending',
    location: { lat: 4.6738, lng: -74.0536, accuracyM: 1, place: 'Sede principal · Bogotá' },
  }),
  record(31, 25, 'check_in', at(7, 19), {
    signals: ['weak-accuracy'],
    review: 'pending',
    location: { lat: 4.6801, lng: -74.0602, accuracyM: 180, place: 'Cerca de la sede · Bogotá' },
  }),
  record(32, 26, 'check_in', at(7, 26), {
    signals: ['impossible-speed', 'ip-mismatch'],
    review: 'pending',
    ip: '181.49.200.17',
    location: { lat: 6.2442, lng: -75.5812, accuracyM: 9, place: 'Medellín' },
  }),
  // Early check-outs
  record(40, 2, 'check_out', at(12, 2)),
  record(41, 15, 'check_out', at(12, 30)),
  record(42, 7, 'check_out', at(12, 38)),
].sort((a, b) => b.serverTime.getTime() - a.serverTime.getTime());

/** Android + mock location → blocked by the app, never recorded (CLAUDE.md §2B.1). */
export const blockedAttempts: BlockedAttempt[] = [
  {
    id: 'b1',
    employeeId: 'e25',
    at: at(7, 13),
    reason: 'Aplicación de ubicación falsa activa',
    device: 'Samsung Galaxy A35 · Android 14',
  },
];

export const deviceRequests: DeviceRequest[] = [
  {
    id: 'd1',
    employeeId: 'e28',
    newModel: 'Samsung Galaxy A25',
    previousModel: null,
    requestedAt: at(6, 48),
  },
  {
    id: 'd2',
    employeeId: 'e11',
    newModel: 'Samsung Galaxy A55',
    previousModel: 'Samsung Galaxy A15',
    requestedAt: at(7, 40),
  },
];

/** "Now" for the admin prototype: 12:41 p. m. */
export const ADMIN_NOW = at(12, 41);
