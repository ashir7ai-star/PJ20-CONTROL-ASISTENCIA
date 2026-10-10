// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SIGN_IN_CHANNEL, signInOutcomes } from '@pj20/shared/constants';
import { describe, expect, it } from 'vitest';

describe('página de la ventana de inicio de sesión (public/acceso-listo.js)', () => {
  const script = readFileSync(
    fileURLToPath(new URL('../../public/acceso-listo.js', import.meta.url)),
    'utf8',
  );

  it('usa el mismo canal y los mismos resultados que la app', () => {
    expect(script).toContain(`var CHANNEL = '${SIGN_IN_CHANNEL}';`);
    expect(script).toContain(
      `var OUTCOMES = [${signInOutcomes.map((outcome) => `'${outcome}'`).join(', ')}];`,
    );
  });

  it('nunca envía datos de la sesión: solo el resultado', () => {
    expect(script).toContain('channel.postMessage(outcome);');
    expect(script).not.toMatch(/cookie|token|credential/i);
  });
});
