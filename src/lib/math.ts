/** Small numeric helpers shared by the scene, the section transitions and the page. */

export const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smoothstep: eases in and out between 0 and 1. */
export const smooth = (t: number) => t * t * (3 - 2 * t);

/** Move `current` towards `target` at `rate` per second, however long the frame took. */
export const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));
