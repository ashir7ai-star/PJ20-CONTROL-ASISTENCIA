import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { a11yViolations } from '../test/a11y.js';
import { PrivacyPolicyPage } from './privacy-policy.js';

describe('Política de Tratamiento de Datos', () => {
  it('cubre lo que exige la Ley 1581: responsable, datos, finalidades, sensibles, derechos y plazos', () => {
    render(<PrivacyPolicyPage />);
    for (const title of [
      '1. Responsable del tratamiento',
      '2. Datos que tratamos',
      '3. Para qué los usamos',
      '4. Datos sensibles',
      '5. Tus derechos',
      '6. Consultas y reclamos',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(
      screen.getByText(/no estás obligado a autorizar el tratamiento de datos sensibles/),
    ).toBeInTheDocument();
    expect(screen.getByText(/No rastreamos tu ubicación/)).toBeInTheDocument();
  });

  it('es la versión final: sin borrador, con domicilio en Cali y los plazos de conservación', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.queryByText(/Borrador/)).toBeNull();
    expect(screen.queryByText(/Por completar/)).toBeNull();
    expect(screen.getByText(/Cali, Valle del Cauca, Colombia/)).toBeInTheDocument();
    expect(
      screen.getByText(/no estás obligado a autorizar el tratamiento de datos sensibles/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Si no la autorizas:/)).toBeInTheDocument();
    expect(screen.getAllByText(/90 días/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/3 años después/)).toBeInTheDocument();
    expect(screen.getByText(/copias de seguridad diarias cifradas/)).toBeInTheDocument();
    expect(screen.getByText(/encargados del tratamiento/)).toBeInTheDocument();
    expect(screen.getByText(/NIT: 901.724.892-9/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nathan@ylevigroup.com' })).toHaveAttribute(
      'href',
      'mailto:nathan@ylevigroup.com',
    );
  });

  it('es accesible', async () => {
    const { container } = render(<PrivacyPolicyPage />);
    expect(await a11yViolations(container)).toEqual([]);
  });
});
