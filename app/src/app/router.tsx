import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { AppLoading } from '../components/brand/app-loading.js';
import { RealApp } from './real-app.js';
import { NotFoundPage } from '../pages/not-found.js';

/**
 * Prototype with fictional data, design catalogue and status page: review
 * tools only. They exist in the GitHub Pages demo and in local development,
 * never in the app real employees use (the build drops them entirely, so no
 * sample names ever reach a phone).
 */
const SHOW_DEMO = import.meta.env.VITE_MODO === 'prototipo' || import.meta.env.DEV;

const demoRoutes: RouteObject[] = SHOW_DEMO
  ? [
      {
        path: '/prototipo',
        lazy: async () => {
          const { PrototypeIndex } = await import('../prototype/prototype-index.js');
          return { Component: PrototypeIndex };
        },
      },
      {
        path: '/prototipo/empleado/:pantalla/:problema?',
        lazy: async () => {
          const { EmployeePrototype } = await import('../prototype/employee-prototype.js');
          return { Component: EmployeePrototype };
        },
      },
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
    ]
  : [];

/**
 * "/" is the real app (session → consent → Marcar). The admin pages and the
 * privacy policy are lazy-loaded so they never weigh on (or leak into) the
 * bundle every employee downloads; AppLoading covers the download.
 */
export const router = createBrowserRouter(
  [
    {
      HydrateFallback: AppLoading,
      children: [
        {
          path: '/',
          // Static demo (GitHub Pages) has no API: it opens the prototype index.
          element:
            import.meta.env.VITE_MODO === 'prototipo' ? (
              <Navigate to="/prototipo" replace />
            ) : (
              <RealApp />
            ),
        },
        {
          // Real admin page (Fase 3): its own bundle, never shipped to employee devices.
          path: '/admin',
          lazy: async () => {
            const { TodayPage } = await import('../features/admin/today-page.js');
            return { Component: TodayPage };
          },
        },
        {
          path: '/admin/revisar',
          lazy: async () => {
            const { ReviewPage } = await import('../features/admin/review-page.js');
            return { Component: ReviewPage };
          },
        },
        {
          path: '/admin/empleados',
          lazy: async () => {
            const { EmployeesPage } = await import('../features/admin/employees-page.js');
            return { Component: EmployeesPage };
          },
        },
        ...demoRoutes,
        {
          // Public: linked from the consent screen and Google's sign-in consent screen.
          path: '/privacidad',
          lazy: async () => {
            const { PrivacyPolicyPage } = await import('../pages/privacy-policy.js');
            return { Component: PrivacyPolicyPage };
          },
        },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  // Same build works at the domain root (Easypanel) or under a sub-path (GitHub Pages).
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);
