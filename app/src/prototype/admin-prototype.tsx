/**
 * Admin panel prototype. Lazy-loaded as its own bundle (see app/router.tsx):
 * employee devices never download admin code (CLAUDE.md §1.5).
 * Decisions (approve/reject/add) live in memory so the flow can be tried.
 */
import { useState } from 'react';
import { Route, Routes, useSearchParams } from 'react-router';

import { AdminLayout } from '../features/admin/components/admin-layout.js';
import type { AttendanceRecord, Employee, Role } from '../features/admin/model.js';
import { initials } from '../features/admin/model.js';
import type { UserAction } from '../features/admin/permissions.js';
import { DevicesScreen } from '../features/admin/screens/devices-screen.js';
import { EmployeesScreen } from '../features/admin/screens/employees-screen.js';
import { OverviewScreen } from '../features/admin/screens/overview-screen.js';
import { RecordDetail } from '../features/admin/screens/record-detail.js';
import { RecordsScreen } from '../features/admin/screens/records-screen.js';
import { ReviewScreen } from '../features/admin/screens/review-screen.js';
import {
  ADMIN_NOW,
  blockedAttempts,
  deviceRequests as initialRequests,
  employees as initialEmployees,
  records as initialRecords,
} from './admin-data.js';
import { PrototypeMenu } from './prototype-menu.js';

const BASE = '/prototipo/admin';
const ME_ID = 'e02';

export function AdminPrototype() {
  const [records, setRecords] = useState<AttendanceRecord[]>(initialRecords);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [requests, setRequests] = useState(initialRequests);
  const [params, setParams] = useSearchParams();

  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const pending = records.filter((r) => r.review === 'pending');
  const detailId = params.get('detalle');
  const detail = records.find((r) => r.id === detailId) ?? null;
  // The signed-in administrator (prototype: Andrés Rodríguez). Cannot delete or
  // demote themselves, so this always resolves.
  const me = employeeById.get(ME_ID);
  if (!me) throw new Error('El administrador del prototipo no existe');

  const recordCountById = new Map<string, number>();
  for (const r of records) {
    recordCountById.set(r.employeeId, (recordCountById.get(r.employeeId) ?? 0) + 1);
  }

  const applyAction = (id: string, action: UserAction) => {
    setEmployees((current) =>
      action === 'delete'
        ? current.filter((e) => e.id !== id)
        : current.map((e) => {
            if (e.id !== id) return e;
            switch (action) {
              case 'make-admin':
                return { ...e, role: 'admin' };
              case 'remove-admin':
                return { ...e, role: 'employee' };
              case 'deactivate':
                return { ...e, active: false };
              case 'reactivate':
                return { ...e, active: true };
            }
          }),
    );
  };

  const decide = (id: string, decision: 'approved' | 'rejected') => {
    setRecords((current) => current.map((r) => (r.id === id ? { ...r, review: decision } : r)));
  };
  const openDetail = (id: string) => {
    setParams({ detalle: id });
  };

  return (
    <AdminLayout
      basePath={BASE}
      admin={{ name: me.name, initials: initials(me.name) }}
      counts={{ review: pending.length, devices: requests.length }}
      markHref="/prototipo/empleado/marcar?rol=admin"
    >
      <Routes>
        <Route
          index
          element={
            <OverviewScreen
              employees={employees}
              employeeById={employeeById}
              records={records}
              blocked={blockedAttempts}
              deviceRequests={requests}
              now={ADMIN_NOW}
              links={{
                records: `${BASE}/marcaciones`,
                review: `${BASE}/revision`,
                devices: `${BASE}/celulares`,
              }}
            />
          }
        />
        <Route
          path="marcaciones"
          element={
            <RecordsScreen records={records} employeeById={employeeById} onOpen={openDetail} />
          }
        />
        <Route
          path="revision"
          element={
            <ReviewScreen
              pending={pending}
              blocked={blockedAttempts}
              employeeById={employeeById}
              onDecision={decide}
            />
          }
        />
        <Route
          path="empleados"
          element={
            <EmployeesScreen
              employees={employees}
              me={me}
              recordCountById={recordCountById}
              onAction={applyAction}
              onAdd={(e: { name: string; email: string; role: Role }) => {
                setEmployees((current) => [
                  { id: crypto.randomUUID(), ...e, active: true, device: null },
                  ...current,
                ]);
              }}
            />
          }
        />
        <Route
          path="celulares"
          element={
            <DevicesScreen
              requests={requests}
              employees={employees}
              employeeById={employeeById}
              onDecision={(id) => {
                setRequests((current) => current.filter((r) => r.id !== id));
              }}
            />
          }
        />
      </Routes>

      <RecordDetail
        record={detail}
        employeeName={detail ? (employeeById.get(detail.employeeId)?.name ?? 'Empleado') : ''}
        onClose={() => {
          setParams({});
        }}
        onDecision={(id, decision) => {
          decide(id, decision);
          setParams({});
        }}
      />
      <PrototypeMenu placement="bottom-right" />
    </AdminLayout>
  );
}
