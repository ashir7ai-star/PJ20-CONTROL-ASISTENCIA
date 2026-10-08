import { useEffect, useRef } from 'react';

import { cn } from '../../../lib/cn.js';

/**
 * "Energía": streaks of light shooting out from the Pulso button, accelerating
 * like a jump to light speed. Drawn on a canvas (smooth at 60 fps on low-end
 * Android). Colours come from the design tokens (--color-energy*).
 * Reduced motion → one static frame of the burst, no animation.
 */

export interface Streak {
  angle: number;
  /** Distance of the streak head from the centre (px). */
  distance: number;
  /** Outward speed (px/s); grows while travelling (warp feel). */
  speed: number;
  width: number;
  bright: boolean;
}

export interface FieldGeometry {
  /** Where streaks are born: just outside the button edge. */
  inner: number;
  /** Where they have fully faded out. */
  outer: number;
}

const STREAKS = 72;
// Calm, steady flow (owner feedback: the first version was too fast).
const ACCELERATION = 0.85; // speed multiplier per second

export function spawnStreak(
  geometry: FieldGeometry,
  random: () => number,
  scatter = false,
): Streak {
  const span = geometry.outer - geometry.inner;
  return {
    angle: random() * Math.PI * 2,
    distance: geometry.inner + (scatter ? random() * span : random() * 12),
    speed: 28 + random() * 62,
    width: 0.8 + random() * 1.9,
    bright: random() < 0.35,
  };
}

/** Advances one streak; respawns it at the button edge once it leaves the field. */
export function stepStreak(
  streak: Streak,
  seconds: number,
  geometry: FieldGeometry,
  random: () => number,
): Streak {
  const speed = streak.speed * (1 + ACCELERATION * seconds);
  const distance = streak.distance + speed * seconds;
  if (distance > geometry.outer) return spawnStreak(geometry, random);
  return { ...streak, speed, distance };
}

/** 0 → 1 as the streak leaves the button, 1 → 0 towards the outer edge. */
export function streakAlpha(distance: number, geometry: FieldGeometry): number {
  const fadeIn = Math.min(1, Math.max(0, (distance - geometry.inner) / 18));
  const progress = (distance - geometry.inner) / (geometry.outer - geometry.inner);
  const fadeOut = 1 - Math.min(1, Math.max(0, progress)) ** 2;
  return fadeIn * fadeOut;
}

interface Palette {
  energy: string;
  bright: string;
  dark: boolean;
}

/** Reads the theme colours. Called on mount and when the theme changes — never per frame. */
function readColors(): Palette {
  const styles = getComputedStyle(document.documentElement);
  return {
    energy: styles.getPropertyValue('--color-energy').trim(),
    bright: styles.getPropertyValue('--color-energy-bright').trim(),
    dark: document.documentElement.getAttribute('data-theme') === 'dark',
  };
}

function draw(
  ctx: CanvasRenderingContext2D,
  streaks: Streak[],
  size: number,
  geometry: FieldGeometry,
  { energy, bright, dark }: Palette,
  glow = true,
): void {
  const centre = size / 2;
  ctx.clearRect(0, 0, size, size);
  // Light adds up on dark backgrounds (like the reference image).
  ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
  ctx.lineCap = 'round';

  // Batch streaks with similar opacity/width/colour into one path each:
  // ~30 strokes per frame instead of 144 (smooth on low-end phones).
  const batches = new Map<
    string,
    { alpha: number; width: number; bright: boolean; xy: number[] }
  >();
  for (const s of streaks) {
    const alpha = streakAlpha(s.distance, geometry);
    if (alpha <= 0.01) continue;
    // Faster streaks draw longer trails.
    const length = Math.min(s.distance - geometry.inner, 12 + s.speed * 0.3);
    const cos = Math.cos(s.angle);
    const sin = Math.sin(s.angle);
    const level = Math.ceil(alpha * ALPHA_LEVELS) / ALPHA_LEVELS;
    const width = s.width < 1.6 ? 1.1 : 2.2;
    const key = `${String(level)}|${String(width)}|${String(s.bright)}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { alpha: level, width, bright: s.bright, xy: [] };
      batches.set(key, batch);
    }
    batch.xy.push(
      centre + cos * (s.distance - length),
      centre + sin * (s.distance - length),
      centre + cos * s.distance,
      centre + sin * s.distance,
    );
  }

  for (const pass of glow ? (['glow', 'core'] as const) : (['core'] as const)) {
    for (const b of batches.values()) {
      ctx.strokeStyle = pass === 'core' && b.bright ? bright : energy;
      ctx.globalAlpha = b.alpha * (pass === 'glow' ? (dark ? 0.35 : 0.22) : dark ? 0.95 : 0.8);
      ctx.lineWidth = pass === 'glow' ? b.width * 3.2 : b.width;
      ctx.beginPath();
      for (let i = 0; i < b.xy.length; i += 4) {
        ctx.moveTo(b.xy[i] ?? 0, b.xy[i + 1] ?? 0);
        ctx.lineTo(b.xy[i + 2] ?? 0, b.xy[i + 3] ?? 0);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * Adaptive quality: the field measures its own frame time and steps down
 * (fewer streaks, then no halo) if the phone cannot keep up. It never steps
 * back up, to avoid flickering between levels.
 */
export const QUALITY_LEVELS = [
  { streaks: 36, glow: false },
  { streaks: 52, glow: true },
  { streaks: STREAKS, glow: true },
] as const;

export interface QualityState {
  level: 0 | 1 | 2;
  /** Smoothed frame time (ms). */
  average: number;
  /** Frames measured at the current level. */
  frames: number;
}

const TARGET_FRAME_MS = 22; // below ~45 fps feels janky
const WARM_UP_FRAMES = 30;

export function initialQuality(): QualityState {
  return { level: 2, average: 16.7, frames: 0 };
}

export function adaptQuality(state: QualityState, frameMs: number): QualityState {
  // Ignore pauses (background tab, debugger) longer than 100 ms.
  if (frameMs > 100) return state;
  const average = state.average * 0.9 + frameMs * 0.1;
  const frames = state.frames + 1;
  if (frames > WARM_UP_FRAMES && average > TARGET_FRAME_MS && state.level > 0) {
    return { level: (state.level - 1) as 0 | 1, average: 16.7, frames: 0 };
  }
  return { ...state, average, frames };
}

/** Opacity steps used to batch streaks (more steps = smoother fades, more strokes). */
const ALPHA_LEVELS = 6;

interface EnergyFieldProps {
  /** Canvas side in CSS px (square, centred on the button). */
  size: number;
  /** Button radius in CSS px. */
  buttonRadius: number;
  className?: string;
}

export function EnergyField({ size, buttonRadius, className }: EnergyFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return; // No canvas support (or test environment): no effect.

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    ctx.scale(ratio, ratio);

    const geometry: FieldGeometry = { inner: buttonRadius + 2, outer: size / 2 };
    let streaks = Array.from({ length: STREAKS }, () => spawnStreak(geometry, Math.random, true));

    let palette = readColors();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Re-read colours only when the app theme changes (light ↔ dark).
    const themeObserver = new MutationObserver(() => {
      palette = readColors();
      if (reducedMotion) draw(ctx, streaks, size, geometry, palette);
    });
    themeObserver.observe(document.documentElement, { attributeFilter: ['data-theme'] });

    if (reducedMotion) {
      draw(ctx, streaks, size, geometry, palette);
      return () => {
        themeObserver.disconnect();
      };
    }

    let frame = 0;
    let last = performance.now();
    let quality = initialQuality();
    const tick = (now: number) => {
      const elapsed = now - last;
      // Clamp the step so returning from a background tab does not jump.
      const seconds = Math.min(elapsed / 1000, 0.05);
      last = now;
      quality = adaptQuality(quality, elapsed);
      const level = QUALITY_LEVELS[quality.level];
      if (streaks.length > level.streaks) streaks = streaks.slice(0, level.streaks);
      streaks = streaks.map((s) => stepStreak(s, seconds, geometry, Math.random));
      draw(ctx, streaks, size, geometry, palette, level.glow);
      frame = requestAnimationFrame(tick);
    };

    // Decorative motion never competes with loading the screen: start once the
    // browser is idle after the first paint (fallback: 1.2 s), then fade in.
    const start = () => {
      canvas.dataset.running = 'true';
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    // Idle-callback and timeout ids are separate namespaces: cancel with the matching API.
    const cancelStart =
      typeof window.requestIdleCallback === 'function'
        ? (() => {
            const id = window.requestIdleCallback(start, { timeout: 1500 });
            return () => {
              window.cancelIdleCallback(id);
            };
          })()
        : (() => {
            const id = window.setTimeout(start, 1200);
            return () => {
              window.clearTimeout(id);
            };
          })();
    return () => {
      cancelStart();
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
    };
  }, [size, buttonRadius]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="energy-field"
      aria-hidden="true"
      className={cn(
        // Hidden until the animation starts (reduced motion: shown at once).
        'pointer-events-none opacity-0 transition-opacity duration-700 data-[running=true]:opacity-100 motion-reduce:opacity-100',
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
