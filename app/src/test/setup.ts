import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom has no canvas: make that explicit so canvas effects take their
// "no canvas support" path silently (real browsers are covered visually).
// (Node-environment tests have no DOM at all, hence the guard.)
if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
