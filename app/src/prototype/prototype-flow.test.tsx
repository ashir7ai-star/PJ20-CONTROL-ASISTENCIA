import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { EmployeePrototype } from './employee-prototype.js';
import { PrototypeIndex } from './prototype-index.js';

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/prototipo', element: <PrototypeIndex /> },
      { path: '/prototipo/empleado/:pantalla', element: <EmployeePrototype /> },
      { path: '/prototipo/empleado/:pantalla/:problema', element: <EmployeePrototype /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('flujo completo del prototipo del empleado', () => {
  it('login → consentimiento → permisos → marcar → selfie → confirmación → en turno', async () => {
    const router = renderAt('/prototipo/empleado/login');

    fireEvent.click(await screen.findByRole('button', { name: 'Continuar con Google' }));
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar y continuar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Permitir acceso' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tomar selfie' }));

    expect(await screen.findByRole('heading', { name: 'Entrada registrada' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));

    expect(await screen.findByRole('button', { name: 'Marcar salida' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?turno=en');
  });

  it('señal débil lleva a la pantalla de advertencia', async () => {
    renderAt('/prototipo/empleado/marcar?gps=debil');
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar entrada' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Señal de GPS débil');
  });

  it('una pantalla desconocida vuelve al índice', async () => {
    renderAt('/prototipo/empleado/no-existe');
    expect(await screen.findByRole('heading', { name: 'Prototipo · Fase 1' })).toBeInTheDocument();
  });

  it('el índice lista todas las pantallas de error', async () => {
    renderAt('/prototipo');
    expect(
      await screen.findByRole('link', { name: 'Ubicación falsa detectada' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(20);
  });
});

describe('administrador marcando su asistencia', () => {
  it('conserva el rol durante el flujo y puede volver al panel', async () => {
    const router = createMemoryRouter(
      [
        { path: '/prototipo/empleado/:pantalla', element: <EmployeePrototype /> },
        { path: '/prototipo/admin', element: <p>Panel del administrador</p> },
      ],
      { initialEntries: ['/prototipo/empleado/marcar?rol=admin'] },
    );
    render(<RouterProvider router={router} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Marcar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tomar selfie' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Listo' }));

    const back = await screen.findByRole('button', { name: 'Ir al panel de administración' });
    expect(router.state.location.search).toBe('?turno=en&rol=admin');
    fireEvent.click(back);
    expect(await screen.findByText('Panel del administrador')).toBeInTheDocument();
  });
});
