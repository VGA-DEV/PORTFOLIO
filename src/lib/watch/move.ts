/**
 * Where the watch is on its way from one section to the next, shared with the page so
 * that a section's content can wait for the watch to have arrived: the watch moves first,
 * and only then does the content that goes with it come in.
 */
let value = 0;
let live = false;
const listeners = new Set<() => void>();

export function setMove(next: number) {
  if (Math.abs(next - value) < 0.0005) return;
  value = next;
  listeners.forEach((fn) => fn());
}

/** Whether a 3D watch is running; without one nothing waits for it. */
export function setMoveLive(next: boolean) {
  live = next;
  listeners.forEach((fn) => fn());
}


/** How far the watch has settled on section `k`, from 0 (still leaving the one before) to 1 (there). */
export function arrivedAt(k: number) {
  if (!live || k <= 0) return 1;
  return Math.min(Math.max((value - (k - 1) - 0.5) / 0.4, 0), 1);
}

export function subscribeMove(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * How far the watch has set off from section `k` (0 = still there, 1 = well on its way).
 * The content that is leaving is held back until it has, so a fast scroll never empties the screen.
 */
export function leftFrom(k: number) {
  if (!live) return 1;
  return Math.min(Math.max((value - k - 0.1) / 0.5, 0), 1);
}

/**
 * Whether the watch is still at (or on its way back to) section `k`'s piece, from 1 (at it)
 * to 0 (well past it). The content of a section is only shown while it is, so scrolling
 * back up never brings a section's content over a watch that is still on the next piece.
 */
export function stillAt(k: number) {
  if (!live) return 1;
  return Math.min(Math.max(1 - (value - k - 0.4) / 0.5, 0), 1);
}
