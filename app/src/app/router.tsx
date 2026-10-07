import { createBrowserRouter, Navigate } from 'react-router';

import { AppLoading } from '../components/brand/app-loading.js';
import { RealApp } from './real-app.js';
import { NotFoundPage } from '../pages/not-found.js';

/**
 * "/" is the real app (session → consent → Marcar). The prototype, the admin
 * panel and developer pages are lazy-loaded so they never weigh on (or leak
 * into) the bundle every employee downloads; AppLoading covers the download.
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
        // Prototype (Fase 1 review tool): its own bundle, never loaded by the real app.
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
