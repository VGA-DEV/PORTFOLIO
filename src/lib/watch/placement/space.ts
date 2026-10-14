/** Boxes and points in screen pixels, and the margins notes and the crown keep from the screen edges. */

export type Rect = { l: number; t: number; r: number; b: number };
export type Point = { x: number; y: number };

/** Height of the fixed header: nothing is placed under it. */
export const HEADER = 84;
export const MARGIN = 14;

export const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

/** A box of `halfW` by `halfH` around a centre. */
export const rectOf = (x: number, y: number, halfW: number, halfH: number): Rect => ({
  l: x - halfW,
  r: x + halfW,
  t: y - halfH,
  b: y + halfH,
});

/** A square of side `size` around a point. */
export const squareAround = (p: Point, size: number): Rect => rectOf(p.x, p.y, size / 2, size / 2);
