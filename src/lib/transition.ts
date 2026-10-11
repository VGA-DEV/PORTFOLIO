const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/**
 * How far the move from one section to the next has got, from 0 to 1, read from the
 * transition gap between them: it starts when the gap's top reaches 70% of the screen
 * and ends when its bottom reaches 45%, so the move is over before the next section's
 * text is read and starts only once the previous one has gone.
 */
export function gapProgress(gap: HTMLElement, viewport: number) {
  const rect = gap.getBoundingClientRect();
  if (rect.height === 0) return -1;
  return clamp01((viewport * 0.7 - rect.top) / (viewport * 0.25 + rect.height));
}
