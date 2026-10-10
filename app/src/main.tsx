import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { router } from './app/router.js';
import { startInstallCapture } from './lib/install.js';
import { registerServiceWorker } from './lib/service-worker.js';
import './index.css';

// Chrome offers installing only once and early: keep that offer for our own invitation (D9).
startInstallCapture();
registerServiceWorker();

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
