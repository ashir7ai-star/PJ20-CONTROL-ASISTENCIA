import { MAX_SELFIE_BYTES } from '@pj20/shared';
import { describe, expect, it } from 'vitest';

import {
  businessDayRange,
  businessToday,
  isValidSelfie,
  reviewReasons,
  selfieKey,
  transitionError,
} from './rules.js';

describe('transiciones de marcación (§2.6)', () => {
  it('permite entrada sin historial y tras una salida', () => {
    expect(transitionError(null, 'check_in')).toBeNull();
    expect(transitionError('check_out', 'check_in')).toBeNull();
  });

  it('permite salida solo con una entrada abierta', () => {
    expect(transitionError('check_in', 'check_out')).toBeNull();
  });

  it('rechaza entrada sobre entrada', () => {
    expect(transitionError('check_in', 'check_in')).toMatch(/Marca tu salida/);
  });

  it('rechaza salida sin entrada', () => {
    expect(transitionError(null, 'check_out')).toMatch(/Marca tu entrada/);
    expect(transitionError('check_out', 'check_out')).toMatch(/Marca tu entrada/);
  });
});

describe('señales para revisión (§2.6, §2B.5)', () => {
  const at = new Date('2026-10-08T12:00:00Z');
  const base = { accuracyM: 8, locationCapturedAt: at, deviceTime: at };

  it('una marcación normal no queda para revisión', () => {
    expect(reviewReasons(base)).toEqual([]);
  });

  it('precisión mayor a 100 m queda para revisión; 100 m exactos no', () => {
    expect(reviewReasons({ ...base, accuracyM: 100 })).toEqual([]);
    expect(reviewReasons({ ...base, accuracyM: 100.5 })).toEqual(['low_accuracy']);
  });

  it('una ubicación de más de 30 s queda para revisión', () => {
    const deviceTime = new Date(at.getTime() + 31_000);
    expect(reviewReasons({ ...base, deviceTime })).toEqual(['stale_location']);
    expect(reviewReasons({ ...base, deviceTime: new Date(at.getTime() + 30_000) })).toEqual([]);
  });

  it('puede tener los dos motivos a la vez', () => {
    const deviceTime = new Date(at.getTime() + 60_000);
    expect(reviewReasons({ accuracyM: 500, locationCapturedAt: at, deviceTime })).toEqual([
      'low_accuracy',
      'stale_location',
    ]);
  });
});

describe('validación de la selfie', () => {
  const jpeg = (size: number) => {
    const bytes = new Uint8Array(size);
    bytes.set([0xff, 0xd8, 0xff, 0xe0]);
    bytes.set([0xff, 0xd9], size - 2);
    return bytes;
  };

  it('acepta un JPEG real de tamaño normal', () => {
    expect(isValidSelfie(jpeg(200_000))).toBe(true);
  });

  it('rechaza lo que no es JPEG (PNG, texto, vacío)', () => {
    const png = jpeg(5000);
    png.set([0x89, 0x50, 0x4e, 0x47]);
    expect(isValidSelfie(png)).toBe(false);
    expect(isValidSelfie(new TextEncoder().encode('hola'.repeat(500)))).toBe(false);
    expect(isValidSelfie(new Uint8Array(0))).toBe(false);
  });

  it('rechaza un JPEG truncado o demasiado grande', () => {
    const truncated = jpeg(5000).slice(0, 4000);
    expect(isValidSelfie(truncated)).toBe(false);
    expect(isValidSelfie(jpeg(MAX_SELFIE_BYTES + 1))).toBe(false);
  });
});

describe('día laboral en Bogotá (UTC−5)', () => {
  it('el 8 de octubre va de las 05:00 UTC a las 05:00 UTC del día siguiente', () => {
    const { start, end } = businessDayRange('2026-10-08');
    expect(start.toISOString()).toBe('2026-10-08T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-09T05:00:00.000Z');
  });

  it('a las 11 p. m. en Bogotá sigue siendo el mismo día aunque en UTC ya sea mañana', () => {
    expect(businessToday(new Date('2026-10-09T04:00:00Z'))).toBe('2026-10-08');
    expect(businessToday(new Date('2026-10-09T05:00:00Z'))).toBe('2026-10-09');
  });

  it('la selfie se guarda por día de Bogotá', () => {
    expect(selfieKey('emp', 'rec', new Date('2026-10-09T04:00:00Z'))).toBe(
      'selfies/2026/10/08/emp/rec.jpg',
    );
  });
});
