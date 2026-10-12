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
  // And one at the end, so landing a few pixels short of the end (a link to the next
  // section, say) still finishes the move instead of leaving the sweep's edge showing.
  return clamp01(((viewport - rect.top) / rect.height - 0.04) / 0.92);
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * The change of section works row by row, top to bottom, so something is always on
 * screen: the rows of the section that is going leave; the watch moves on; and only once
 * it is on its way the same rows of the one that is coming arrive in their place. `r` is
 * the row's place from 0 (first) to 1 (last).
 */
export const leaveProgress = (p: number, r: number) => smooth(clamp01((p - (0.04 + 0.3 * r)) / 0.18));
export const arriveProgress = (p: number, r: number) => smooth(clamp01((p - (0.44 + 0.3 * r)) / 0.18));

/** Progress at which the watch starts to move on, and at which the note's text changes over. */
export const MOVE_AT = 0.15;
/** Going back up, the watch returns here, just as the next section's content has left. */
export const MOVE_BACK_AT = 0.55;
export const SWAP_AT = 0.5;
