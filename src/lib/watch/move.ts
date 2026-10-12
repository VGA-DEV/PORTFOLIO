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

export const isMoveLive = () => live;
export const getMove = () => value;

/** How far the watch has settled on section `k`, from 0 (still leaving the one before) to 1 (there). */
export function arrivedAt(k: number) {
  if (!live || k <= 0) return 1;
  return Math.min(Math.max((value - (k - 1) - 0.6) / 0.35, 0), 1);
}

export function subscribeMove(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
