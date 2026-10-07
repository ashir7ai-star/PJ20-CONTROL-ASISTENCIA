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

  it('advierte que es un borrador y marca los datos de la empresa por completar', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText(/Borrador pendiente de revisión legal/)).toBeInTheDocument();
    expect(screen.getAllByText(/Por completar:/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/NIT: 901.724.892/)).toBeInTheDocument();
  });

  it('es accesible', async () => {
    const { container } = render(<PrivacyPolicyPage />);
    expect(await a11yViolations(container)).toEqual([]);
  });
});
