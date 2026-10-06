import { describe, expect, it } from 'vitest';

import {
  type FieldGeometry,
  QUALITY_LEVELS,
  adaptQuality,
  initialQuality,
  spawnStreak,
  stepStreak,
  streakAlpha,
} from './energy-field.js';

const geometry: FieldGeometry = { inner: 98, outer: 170 };

/** Deterministic pseudo-random sequence for reproducible tests. */
function seeded(seed = 42) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

describe('campo de energía', () => {
  it('las líneas nacen en el borde del botón, no encima de él', () => {
    const random = seeded();
    for (let i = 0; i < 200; i++) {
      const s = spawnStreak(geometry, random);
      expect(s.distance).toBeGreaterThanOrEqual(geometry.inner);
      expect(s.distance).toBeLessThanOrEqual(geometry.inner + 12);
    }
  });

  it('al inicio se reparten por todo el campo (no aparecen todas juntas)', () => {
    const random = seeded();
    const distances = Array.from(
      { length: 200 },
      () => spawnStreak(geometry, random, true).distance,
    );
    expect(Math.max(...distances)).toBeGreaterThan(geometry.outer - 15);
  });

  it('se alejan y aceleran (efecto de velocidad de la luz)', () => {
    const random = seeded();
    const s = spawnStreak(geometry, random);
    const next = stepStreak(s, 0.016, geometry, random);
    expect(next.distance).toBeGreaterThan(s.distance);
    expect(next.speed).toBeGreaterThan(s.speed);
  });

  it('al salir del campo renacen en el borde del botón', () => {
    const random = seeded();
    const leaving = {
      ...spawnStreak(geometry, random),
      distance: geometry.outer - 0.1,
      speed: 500,
    };
    const reborn = stepStreak(leaving, 0.016, geometry, random);
    expect(reborn.distance).toBeLessThan(geometry.inner + 13);
  });

  it('aparecen suavemente y se desvanecen hacia el borde exterior', () => {
    expect(streakAlpha(geometry.inner, geometry)).toBe(0);
    expect(streakAlpha(geometry.inner + 30, geometry)).toBeGreaterThan(0.7);
    expect(streakAlpha(geometry.outer, geometry)).toBe(0);
  });
});

describe('calidad adaptativa', () => {
  const run = (frameMs: number, frames: number) => {
    let q = initialQuality();
    for (let i = 0; i < frames; i++) q = adaptQuality(q, frameMs);
    return q;
  };

  it('un celular fluido (60 fps) conserva la calidad completa', () => {
    expect(run(16.7, 600).level).toBe(2);
  });

  it('un celular lento baja la calidad paso a paso hasta el mínimo', () => {
    expect(run(33, 40).level).toBe(1);
    expect(run(33, 600).level).toBe(0);
  });

  it('no reacciona a una pausa aislada (pestaña en segundo plano)', () => {
    let q = run(16.7, 100);
    q = adaptQuality(q, 5000);
    expect(q.level).toBe(2);
  });

  it('nunca vuelve a subir de calidad (evita parpadeos)', () => {
    let q = run(33, 600);
    for (let i = 0; i < 600; i++) q = adaptQuality(q, 8);
    expect(q.level).toBe(0);
  });

  it('el nivel mínimo dibuja menos líneas y sin halo', () => {
    expect(QUALITY_LEVELS[0].streaks).toBeLessThan(QUALITY_LEVELS[2].streaks);
    expect(QUALITY_LEVELS[0].glow).toBe(false);
  });
});
