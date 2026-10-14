import { clamp01 } from '../../math';
import {
  MOVE_AT,
  MOVE_BACK_AT,
  SWAP_AT,
  arriveProgress,
  dwellProgress,
  leaveProgress,
} from '../../transition';

/** What the watch has decided about one section's move: has it set off, and has it got well under way. */
export type MoveState = { moved: boolean; passed: boolean; ready: boolean; last: number };

/**
 * Where the watch is along the page (0 = hero, 1 = projects, ...). Each move to the next section is
 * triggered in the second half of the dwell that ends the section before it. The watch sets off at one
 * point going down and goes back at another going up, so that on the way up it returns just as the next
 * section's content has left. `states` keeps what was decided between calls.
 */
export function watchPosition(
  sections: readonly HTMLElement[],
  gaps: readonly (HTMLElement | undefined)[],
  viewport: number,
  states: MoveState[],
) {
  let position = 0;
  for (let i = 1; i < sections.length; i++) {
    const gap = gaps[i - 1];
    const progress = gap ? dwellProgress(gap, viewport) : -1;
    if (progress >= 0) {
      const state = states[i] ?? { moved: false, passed: false, ready: false, last: progress };
      states[i] = state;
      if (!state.ready || Math.abs(progress - state.last) > 0.3) {
        // First reading, or a jump (a link, or a resize that moved everything): take the
        // state that matches where we are, as if we had got here by scrolling.
        const up = state.ready && progress < state.last;
        state.moved = progress > (up ? MOVE_BACK_AT : MOVE_AT);
        state.passed = progress > 0.6;
        state.ready = true;
      } else if (progress < MOVE_AT) {
        state.moved = false;
        state.passed = false;
      } else if (progress > 0.6) {
        state.moved = true;
        state.passed = true;
      } else if (state.passed && progress < MOVE_BACK_AT) {
        state.moved = false;
        state.passed = false;
      } else if (!state.moved && !state.passed && progress > state.last) {
        state.moved = true;
      }
      state.last = progress;
      position += state.moved ? 1 : 0;
    } else {
      const top = sections[i].getBoundingClientRect().top;
      position += clamp01((viewport * 0.8 - top) / (viewport * 0.5));
    }
  }
  return position;
}

/** Which note is up, and how far in or out it is, read from the scroll through the dwells. */
export type NoteState = { index: number; out: number; inn: number };

/**
 * The note moves like the content does: it leaves as the last piece of the section, and arrives as the
 * last piece of the next one, so the two feel the same. `null` when the dwells are not measurable
 * (no sweep: sections keep their own place).
 */
export function noteStateAt(gaps: readonly (HTMLElement | undefined)[], viewport: number): NoteState | null {
  const progress = gaps.map((gap) => (gap ? dwellProgress(gap, viewport) : -1));
  if (!progress.every((p) => p >= 0)) return null;
  const index = progress.filter((p) => p > SWAP_AT).length;
  const own = progress[index] ?? 0;
  const before = index > 0 ? progress[index - 1] : 1;
  return { index, out: leaveProgress(own, 1), inn: arriveProgress(before, 1) };
}
