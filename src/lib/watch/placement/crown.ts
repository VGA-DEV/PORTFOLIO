import { HEADER, overlap, squareAround, type Point, type Rect } from './space';

/** Side of the button over the crown: a little bigger than the crown itself, and never too small to touch. */
export const crownButtonSize = (crownRadius: number) => Math.max(crownRadius * 2.6, 52);

/** Keep the button's centre where all of it is on screen and clear of the header. */
export const fitCrown = (p: Point, size: number, viewport: { w: number; h: number }): Point => ({
  x: Math.min(Math.max(p.x, size / 2 + 4), viewport.w - size / 2 - 4),
  y: Math.min(Math.max(p.y, HEADER + size / 2), viewport.h - size / 2 - 4),
});

/**
 * Where the control should sit. Over the crown if the text and the note leave it free (`null`); otherwise
 * the nearest free place around it, kept for as long as it is still good and close, so it does not jitter.
 */
export function chooseCrownGoal(o: {
  previous: Point | null;
  /** The crown itself, already fitted to the screen. */
  at: Point;
  size: number;
  viewport: { w: number; h: number };
  text: readonly Rect[];
  noteRect: Rect | null;
}): Point | null {
  const { previous, at, size, viewport, text, noteRect } = o;
  const spotCost = (p: Point) => {
    const rect = squareAround(p, size);
    let cost = 0;
    for (const r of text) cost += overlap(rect, r);
    if (noteRect) cost += overlap(rect, noteRect) * 3;
    return cost;
  };

  const free = size * size * 0.02;
  const reach = size * 3;
  const stillGood =
    previous !== null && Math.hypot(previous.x - at.x, previous.y - at.y) < reach && spotCost(previous) <= free;
  if (spotCost(at) <= free) return null;
  if (stillGood) return previous;
  let best = { p: at, cost: Infinity };
  for (const radius of [size * 0.9, size * 1.5, size * 2.2, size * 3, size * 4]) {
    for (let k = 0; k < 20; k++) {
      const angle = (k / 20) * Math.PI * 2;
      const p = fitCrown({ x: at.x + Math.cos(angle) * radius, y: at.y + Math.sin(angle) * radius }, size, viewport);
      const cost = spotCost(p) * 4 + Math.hypot(p.x - at.x, p.y - at.y) * 12;
      if (cost < best.cost) best = { p, cost };
    }
  }
  return best.p;
}
