import { createBrowserRouter, Navigate } from 'react-router';

import { AppLoading } from '../components/brand/app-loading.js';
import { NotFoundPage } from '../pages/not-found.js';
import { EmployeePrototype } from '../prototype/employee-prototype.js';
import { PrototypeIndex } from '../prototype/prototype-index.js';

/**
 * Fase 1 routes: the prototype is the entry point. Real routes (login guard,
 * employee/admin split) arrive with authentication in Fase 2–3.
 * The admin panel and developer pages are lazy-loaded so they never weigh on
 * (or leak into) the employee bundle; AppLoading covers the download.
 */
export const router = createBrowserRouter(
  [
    {
      HydrateFallback: AppLoading,
      children: [
        { path: '/', element: <Navigate to="/prototipo" replace /> },
        { path: '/prototipo', element: <PrototypeIndex /> },
        { path: '/prototipo/empleado/:pantalla', element: <EmployeePrototype /> },
        { path: '/prototipo/empleado/:pantalla/:problema', element: <EmployeePrototype /> },
        {
          // Separate bundle: the admin panel never ships to employee devices.
          path: '/prototipo/admin/*',
          lazy: async () => {
            const { AdminPrototype } = await import('../prototype/admin-prototype.js');
            return { Component: AdminPrototype };
          },
        },
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
      ],
    },
  ],
  // Same build works at the domain root (Easypanel) or under a sub-path (GitHub Pages).
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);
