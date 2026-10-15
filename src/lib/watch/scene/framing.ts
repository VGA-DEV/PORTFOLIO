import { lerp } from '../../math';
import type { PoseState } from './poses';

/**
 * The watch travels round the screen like the tip of a clock hand: each change of
 * side is half a turn clockwise (through the bottom, then through the top).
 */
export function orbitAngles(sides: readonly number[], count: number) {
  const angles: number[] = [];
  for (let i = 0; i < count; i++) {
    const side = sides[i] ?? 1;
    if (i === 0) angles.push(side > 0 ? 0 : Math.PI);
    else angles.push(angles[i - 1] - ((sides[i - 1] ?? 1) === side ? 0 : Math.PI));
  }
  return angles;
}

/** One column: the height of the watch's centre, as a fraction of the screen, in each section. */
export const STACK_ROWS = [0.72, 0.5, 0.5, 0.48, 0.5, 0.5, 0.5];

type FrameInput = {
  from: PoseState;
  to: PoseState;
  ease: number;
  /** 0 at rest, 1 halfway between two sections. */
  burst: number;
  wide: boolean;
  /** Canvas width, and the height left for the scene above the footer, in pixels. */
  width: number;
  viewHeight: number;
  /** The root font size in pixels: on large screens the text scales, and the content column with it. */
  rem: number;
};

/**
 * How much of the scene the camera sees. `half` is half the height in view, in scene units;
 * `centre` is where the watch sits across the strip left beside the text (wide layout only);
 * `widest` is how wide the watch is across the current pose.
 */
export function frameView({ from, to, ease, burst, wide, width, viewHeight, rem }: FrameInput) {
  const aspect = width / viewHeight;
  const widest = lerp(from.width, to.width, ease);
  let half: number;
  let centre = 0.27;
  if (wide) {
    // Two columns: the content column is a fixed 36rem, so on narrower windows the strip left
    // for the watch shrinks. Centre the watch in that strip and zoom out if the model would
    // still not fit it.
    const container = Math.min(70 * rem, width - 32);
    const strip = Math.min(Math.max(((width + container) / 2 - 36 * rem) / width, 0.34), 0.5);
    centre = Math.min(Math.max(strip / 2, 0.17), 0.27);
    const halfShare = Math.max(strip / 2 - 0.03, 0.12);
    const fitWidth = widest + lerp(from.reach ?? 0, to.reach ?? 0, ease);
    const fitHalf = Math.max(fitWidth / (0.8 * aspect), fitWidth / (4 * halfShare * aspect));
    half = Math.max(lerp(from.half, to.half, ease), fitHalf) + 1.1 * burst;
  } else {
    // One column: a stage measured from the screen itself, the same rule on every device. The
    // watch is never wider than 75% of the width nor taller than 36% of the height.
    const unit = Math.min((0.75 * width) / widest, (0.36 * viewHeight) / 2.8);
    half = viewHeight / (2 * unit) + 1.1 * burst;
  }
  return { half, centre, widest };
}

/** Where the watch sits on its orbit: opposite the section's text, and round the screen between sections. */
export function orbitPlace(o: { wide: boolean; centre: number; half: number; aspect: number; theta: number; row: number }) {
  const viewW = o.half * o.aspect;
  const viewH = o.half;
  const rx = (o.wide ? 1 - 2 * o.centre : 0.1) * viewW;
  const ry = (o.wide ? 0.55 : 0.06) * viewH;
  const baseY = o.wide ? 0 : (0.5 - o.row) * 2 * viewH;
  return { x: rx * Math.cos(o.theta), y: baseY + ry * Math.sin(o.theta) };
}
