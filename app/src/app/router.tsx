import { createBrowserRouter, Navigate } from 'react-router';

import { NotFoundPage } from '../pages/not-found.js';
import { EmployeePrototype } from '../prototype/employee-prototype.js';
import { PrototypeIndex } from '../prototype/prototype-index.js';

/**
 * Fase 1 routes: the prototype is the entry point. Real routes (login guard,
 * employee/admin split) arrive with authentication in Fase 2–3.
 * Developer pages (design catalog, system status) are lazy-loaded so they never
 * weigh on the employee bundle.
 */
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/prototipo" replace /> },
  { path: '/prototipo', element: <PrototypeIndex /> },
  { path: '/prototipo/empleado/:pantalla', element: <EmployeePrototype /> },
  { path: '/prototipo/empleado/:pantalla/:problema', element: <EmployeePrototype /> },
  {
    path: '/diseno',
    lazy: async () => {
      const { DesignCatalog } = await import('../pages/design-catalog.js');
      return { Component: DesignCatalog };
    },
  },
  {
    path: '/estado',
    lazy: async () => {
      const { SystemStatusPage } = await import('../pages/system-status.js');
      return { Component: SystemStatusPage };
    },
  },
  { path: '*', element: <NotFoundPage /> },
]);
