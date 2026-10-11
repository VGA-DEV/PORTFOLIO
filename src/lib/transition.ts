const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/**
 * How far the move from one section to the next has got, from 0 to 1. Each section
 * ends in a stretch of extra scroll (its dwell) during which its content is held in
 * place, so nothing visibly scrolls while the watch moves on: the move starts when
 * the dwell reaches the bottom of the screen and ends when it has gone past it.
 * Returns -1 when there is no dwell to read.
 */
export function dwellProgress(dwell: HTMLElement, viewport: number) {
  const rect = dwell.getBoundingClientRect();
  if (rect.height === 0) return -1;
  // A little dead zone at the start: a section a few pixels short of the screen is
  // already held at the top of the page, and must not start moving on its own.
  return clamp01(((viewport - rect.top) / rect.height - 0.04) / 0.96);
}
