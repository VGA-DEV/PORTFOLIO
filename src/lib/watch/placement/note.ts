import type { AnchorInfo } from '../scene';
import { HEADER, MARGIN, overlap, rectOf, type Point, type Rect } from './space';

/** Every time the watch settles on a section the note draws a fresh look: where it likes to sit and how its line bends. */
export const rollLook = () => ({
  /** Which side of the watch the note likes to sit on, as an angle round it. */
  phi: Math.random() * Math.PI * 2,
  hookAngle: ((35 + Math.random() * 45) * Math.PI) / 180,
  sideAngle: ((25 + Math.random() * 35) * Math.PI) / 180,
  curved: Math.random() < 0.4,
  bow: Math.random() < 0.5 ? 1 : -1,
});

export type Look = ReturnType<typeof rollLook>;

/** Where the note has chosen to sit, and which cell of the search grid that was (empty = not chosen yet). */
export type NoteSpot = Point & { key: string };

type Surroundings = {
  anchor: AnchorInfo;
  look: Look;
  /** What the note must keep off: the text, and the crown button. */
  text: readonly Rect[];
  crownRect: Rect | null;
};

/** How bad a place is for a note: overlap with text, the watch and the crown, and distance. */
function boxCost(box: Rect, { anchor: a, look, text, crownRect }: Surroundings) {
  const model = rectOf(a.model.x, a.model.y, a.model.halfW, a.model.halfH);
  let cost = overlap(box, model) * 1.6;
  // Over the text is worse than over the watch: it hides what is being read.
  for (const r of text) cost += overlap(box, r) * 30;
  if (crownRect) cost += overlap(box, crownRect) * 3;
  if (a.prop) cost += overlap(box, rectOf(a.prop.x, a.prop.y, a.prop.halfW, a.prop.halfH)) * 2.5;
  const dx = (box.l + box.r) / 2 - a.x;
  const dy = (box.t + box.b) / 2 - a.y;
  // Stay close to the watch, on the side this look prefers.
  const gapX = Math.max(0, box.l - model.r, model.l - box.r);
  const gapY = Math.max(0, box.t - model.b, model.t - box.b);
  const wx = (box.l + box.r) / 2 - (a.model.x + Math.cos(look.phi) * (a.model.halfW + (box.r - box.l) / 2 + 20));
  const wy = (box.t + box.b) / 2 - (a.model.y + Math.sin(look.phi) * (a.model.halfH + (box.b - box.t) / 2 + 20));
  return cost + Math.hypot(dx, dy) * 6 + Math.hypot(gapX, gapY) * 45 + Math.hypot(wx, wy) * 22;
}

/**
 * Look for the freest background around, and keep the current spot unless a clearly better one appears.
 * `viewport` is the room available (the footer, an opaque band over the canvas, cuts the height); on a phone
 * the note is a compact strip at the bottom of it.
 */
export function chooseNoteSpot(
  around: Surroundings & { w: number; h: number; current: NoteSpot; viewport: { w: number; h: number }; phone: boolean },
): NoteSpot {
  const { w, h, current, viewport, phone } = around;
  const { w: vw, h: vh } = viewport;
  if (phone) return { x: (vw - w) / 2, y: vh - h - 18, key: 'phone' };
  let best = { x: current.x, y: current.y, cost: Infinity, key: current.key };
  const xs = 8;
  const ys = 9;
  for (let i = 0; i <= xs; i++) {
    for (let j = 0; j <= ys; j++) {
      const x = MARGIN + ((vw - 2 * MARGIN - w) * i) / xs;
      const y = HEADER + ((vh - HEADER - MARGIN - h) * j) / ys;
      const cost = boxCost({ l: x, t: y, r: x + w, b: y + h }, around);
      if (cost < best.cost) best = { x, y, cost, key: `${i}:${j}` };
    }
  }
  const currentCost = boxCost({ l: current.x, t: current.y, r: current.x + w, b: current.y + h }, around);
  const chosen: NoteSpot =
    current.key === '' || best.cost < currentCost * 0.7 - 500 ? { x: best.x, y: best.y, key: best.key } : current;
  // The note may have grown since the spot was chosen: it must never hang off the screen.
  return {
    ...chosen,
    x: Math.min(Math.max(chosen.x, MARGIN), Math.max(vw - MARGIN - w, MARGIN)),
    y: Math.min(Math.max(chosen.y, HEADER), Math.max(vh - MARGIN - h, HEADER)),
  };
}

/**
 * How wide the note is. On wide screens it takes the free strip beside the content column, however narrow
 * (`watchOnRight`: the watch sits to the right of the text, so the strip is on the left, and the other way round).
 */
export function noteWidth(o: {
  phone: boolean;
  viewportW: number;
  remPx: number;
  text: readonly Rect[];
  watchOnRight: boolean;
}) {
  let free = o.viewportW - 2 * MARGIN;
  if (!o.phone && o.text.length > 0) {
    const textLeft = Math.min(...o.text.map((r) => r.l));
    const textRight = Math.max(...o.text.map((r) => r.r));
    const beside = o.watchOnRight ? textLeft - 2 * MARGIN : o.viewportW - textRight - 2 * MARGIN;
    if (beside > 0) free = Math.min(free, Math.max(beside, 200));
  }
  return Math.min((o.phone ? 20 : 22) * o.remPx, free);
}

const f = (n: number) => n.toFixed(1);

/**
 * Tie the note to the part. Above or below it the line leaves the part at 60 degrees
 * and turns at the knee to run along the note's edge; to one side it leaves at 45
 * degrees and meets the note's edge, which then carries the rule.
 * Returns the SVG path and which edge of the note it ends on.
 */
export function calloutPath(a: Pick<AnchorInfo, 'x' | 'y'>, box: Rect, look: Look) {
  const { l: L, t: T, r: R, b: B } = box;
  const w = R - L;
  const bcx = (L + R) / 2;
  const bcy = (T + B) / 2;
  // The first leg of the line is straight, or bows a little to one side.
  const leg = (x1: number, y1: number, x2: number, y2: number) => {
    if (!look.curved) return `L${f(x2)},${f(y2)}`;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const bow = Math.hypot(x2 - x1, y2 - y1) * 0.22 * look.bow;
    const nx = -(y2 - y1) / (Math.hypot(x2 - x1, y2 - y1) || 1);
    const ny = (x2 - x1) / (Math.hypot(x2 - x1, y2 - y1) || 1);
    return `Q${f(mx + nx * bow)},${f(my + ny * bow)} ${f(x2)},${f(y2)}`;
  };

  if (bcx - w / 2 > a.x + 24 || bcx + w / 2 < a.x - 24) {
    const dirx = bcx > a.x ? 1 : -1;
    const edgeX = dirx > 0 ? L : R;
    const attachY = T + 14;
    const dy = attachY - a.y;
    let kneeX = a.x + dirx * (Math.abs(dy) / Math.tan(look.sideAngle));
    if (dirx * (edgeX - kneeX) < 10) kneeX = edgeX - dirx * 10;
    return {
      d: `M${f(a.x)},${f(a.y)} ${leg(a.x, a.y, kneeX, attachY)} L${f(edgeX)},${f(attachY)} L${f(edgeX)},${f(B)}`,
      edge: (dirx > 0 ? 'left' : 'right') as 'left' | 'right',
    };
  }
  const below = bcy > a.y;
  const edgeY = below ? T : B;
  const dy = Math.max(Math.abs(edgeY - a.y), 24);
  const angleTo = (end: number) => Math.atan2(dy, Math.max(Math.abs(a.x - end), 1));
  const kneeAtLeft = Math.abs(angleTo(L) - look.hookAngle) < Math.abs(angleTo(R) - look.hookAngle);
  const kneeX = kneeAtLeft ? L : R;
  const farX = kneeAtLeft ? R : L;
  return {
    d: `M${f(a.x)},${f(a.y)} ${leg(a.x, a.y, kneeX, edgeY)} L${f(farX)},${f(edgeY)}`,
    edge: (below ? 'top' : 'bottom') as 'top' | 'bottom',
  };
}
