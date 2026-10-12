import { blossom, box, extrudeStar, gear, hand, lathe, merge, translateFlat } from './geometry';
import { loft, roundedTrapezoid, strap, tonneauOutline, type SmoothMesh } from './smooth';

/**
 * All the watch's geometry, built from plain numbers. It is pure computation with
 * no DOM, so it can run in a Web Worker and keep the page's main thread free.
 */

export const OUTLINE_POINTS = 120;

/** Flat-shaded pieces are bare positions; smooth ones carry normals and uvs. */
export type Piece = Float32Array | SmoothMesh;

export type WatchPieces = {
  caseBack: Piece;
  caseBand: Piece;
  lugs: Piece;
  bezel: Piece;
  crown: Piece;
  strapUp: Piece;
  strapDown: Piece;
  dial: Piece;
  plate: Piece;
  gears: Piece[];
  hourHand: Piece;
  minuteHand: Piece;
  secondHand: Piece;
  cap: Piece;
  crystal: Piece;
  /** Small gold miniatures, one per interest ("complications"). */
  rails: Piece;
  frame: Piece;
  car: Piece;
  reel: Piece;
  film: Piece;
  invader: Piece;
  globe: Piece;
  globeRing: Piece;
  plane: Piece;
  petal: Piece;
};

/** The gears in a V, as the scene also needs their size to place them. */
export const GEAR_SPECS = [
  { x: -0.42, y: 0.48, teeth: 14, out: 0.32, hub: 0.07, spokes: 3 },
  { x: 0.42, y: 0.48, teeth: 14, out: 0.32, hub: 0.07, spokes: 3 },
  { x: 0.0, y: -0.16, teeth: 18, out: 0.42, hub: 0.09, spokes: 4 },
] as const;

const translate = (mesh: SmoothMesh, dx: number, dy: number, dz: number): SmoothMesh => {
  const position = new Float32Array(mesh.position);
  for (let i = 0; i < position.length; i += 3) {
    position[i] += dx;
    position[i + 1] += dy;
    position[i + 2] += dz;
  }
  return { ...mesh, position };
};

const mergeSmooth = (...parts: SmoothMesh[]): SmoothMesh => ({
  position: merge(...parts.map((p) => p.position)),
  normal: merge(...parts.map((p) => p.normal)),
  uv: merge(...parts.map((p) => p.uv)),
});

type TrackPoint = { x: number; y: number; z: number; a: number; s: number };

/**
 * The roller coaster's route, seen from the side: a lift hill, a crest, a drop, one
 * loop that shifts a little sideways so it does not cross itself, and a run-out.
 * Built once from a few key points smoothed with a Catmull-Rom spline and resampled
 * at an even spacing, so the rails and the little car follow exactly the same line.
 */
export const COASTER_STEP = 0.04;

let coasterCache: { points: TrackPoint[]; length: number } | null = null;

export function coasterPath() {
  if (coasterCache) return coasterCache;
  const keys: [number, number, number][] = [
    [-1.0, 0.06, -0.07],
    [-0.85, 0.06, -0.07],
    [-0.55, 0.45, -0.07],
    [-0.3, 0.74, -0.07],
    [-0.1, 0.7, -0.07],
    [0.1, 0.36, -0.07],
    [0.2, 0.14, -0.07],
  ];
  // The loop: a circle whose centre drifts forward and across as it goes round.
  const radius = 0.3;
  const around = 28;
  for (let i = 0; i <= around; i++) {
    const t = (i / around) * Math.PI * 2;
    keys.push([0.3 + radius * Math.sin(t) + 0.12 * (t / (Math.PI * 2)), 0.06 + radius * (1 - Math.cos(t)), -0.07 + 0.14 * (t / (Math.PI * 2))]);
  }
  keys.push([0.6, 0.06, 0.07], [0.85, 0.06, 0.07], [1.05, 0.06, 0.07]);

  const dense: [number, number, number][] = [];
  const at = (i: number) => keys[Math.min(Math.max(i, 0), keys.length - 1)];
  for (let i = 0; i < keys.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      const t2 = t * t;
      const t3 = t2 * t;
      dense.push([0, 1, 2].map((c) =>
        0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3),
      ) as [number, number, number]);
    }
  }
  dense.push(keys[keys.length - 1]);

  // An even spacing along the line, so the box segments and the car's pace are regular.
  const points: TrackPoint[] = [];
  let carry = 0;
  let travelled = 0;
  points.push({ x: dense[0][0], y: dense[0][1], z: dense[0][2], a: 0, s: 0 });
  for (let i = 1; i < dense.length; i++) {
    const [x0, y0, z0] = dense[i - 1];
    const [x1, y1, z1] = dense[i];
    const seg = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    let used = 0;
    while (carry + (seg - used) >= COASTER_STEP) {
      used += COASTER_STEP - carry;
      carry = 0;
      travelled += COASTER_STEP;
      const f = seg === 0 ? 0 : used / seg;
      points.push({ x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, z: z0 + (z1 - z0) * f, a: 0, s: travelled });
    }
    carry += seg - used;
  }
  points.forEach((p, i) => {
    const next = points[Math.min(i + 1, points.length - 1)];
    const prev = points[Math.max(i - 1, 0)];
    p.a = Math.atan2(next.y - prev.y, next.x - prev.x);
  });
  coasterCache = { points, length: points[points.length - 1].s };
  return coasterCache;
}

/** The track point at a distance along the route. */
export function coasterAt(s: number): TrackPoint {
  const { points, length } = coasterPath();
  const index = Math.min(Math.max(Math.floor(s / COASTER_STEP), 0), points.length - 2);
  const a = points[index];
  const b = points[index + 1];
  const f = Math.min(Math.max((Math.min(Math.max(s, 0), length) - a.s) / COASTER_STEP, 0), 1);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, a: a.a + (b.a - a.a) * f, s };
}

/** A roller coaster: two gold rails, violet ties and posts, and a small car to ride them. */
function buildCoaster() {
  const { points } = coasterPath();
  const rails: Float32Array[] = [];
  const frame: Float32Array[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    const mz = (p.z + q.z) / 2;
    const angle = Math.atan2(q.y - p.y, q.x - p.x);
    const length = Math.hypot(q.x - p.x, q.y - p.y) * 1.12;
    rails.push(box(mx, my, mz - 0.045, length, 0.032, 0.03, angle), box(mx, my, mz + 0.045, length, 0.032, 0.03, angle));
    if (i % 3 === 0) frame.push(box(mx, my - 0.022, mz, 0.024, 0.02, 0.12, angle));
    // Posts hold the track up wherever it is not going round the loop.
    const onLoop = mx > 0.2 && mx < 0.58 && mz > -0.06;
    if (i % 6 === 3 && !onLoop && my > 0.14) frame.push(box(mx, (my - 0.03) / 2, mz, 0.034, my - 0.03, 0.034));
  }
  const car = merge(
    box(0, 0.05, 0, 0.26, 0.06, 0.13),
    box(-0.08, 0.1, 0, 0.06, 0.06, 0.11),
    box(0.03, 0.1, 0, 0.06, 0.06, 0.11),
    box(0.1, 0.085, 0, 0.04, 0.03, 0.11),
  );
  return { rails: merge(...rails), frame: merge(...frame), car };
}

/** A film reel with its strip trailing off to one side. */
function buildReel() {
  const spokes = [0, Math.PI / 3, (2 * Math.PI) / 3].map((a) => box(0, 0, 0, 0.5, 0.045, 0.03, a));
  const reel = merge(
    lathe([[0.1, -0.035], [0.26, -0.035], [0.26, 0.035], [0.1, 0.035]], 28, 0),
    lathe([[0, -0.045], [0.1, -0.045], [0.1, 0.045], [0, 0.045]], 16, 0),
    ...spokes,
  );
  const strips: Float32Array[] = [];
  for (let i = 0; i < 14; i++) {
    const x = 0.28 + i * 0.1;
    const y = -0.24 - i * i * 0.0105;
    const slope = -Math.atan(2 * i * 0.0105 / 0.1);
    strips.push(box(x, y, 0, 0.11, 0.16, 0.012, slope));
  }
  return { reel, film: merge(...strips) };
}

/** A small pixel space-invader built from cubes. */
function buildInvader() {
  const rows = [
    '..#.....#..',
    '...#...#...',
    '..#######..',
    '.##.###.##.',
    '###########',
    '#.#######.#',
    '#.#.....#.#',
    '...##.##...',
  ];
  const size = 0.05;
  const cubes: Float32Array[] = [];
  rows.forEach((row, r) => {
    [...row].forEach((cell, c) => {
      if (cell === '#') cubes.push(box((c - 5) * size * 1.08, (3.5 - r) * size * 1.08, 0, size, size, size));
    });
  });
  return merge(...cubes);
}

/** A faceted globe with an equator ring and a paper plane to orbit it. */
function buildGlobe() {
  const radius = 0.3;
  const steps = 7;
  const profile = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * Math.PI;
    return [Math.sin(a) * radius, Math.cos(a) * radius] as const;
  });
  const plane = extrudeStar(
    [
      [0, 0.12],
      [0.08, -0.07],
      [0, -0.035],
      [-0.08, -0.07],
    ],
    -0.008,
    0.008,
  );
  return {
    globe: lathe(profile, 14, 0),
    globeRing: lathe([[0.37, -0.014], [0.42, -0.014], [0.42, 0.014], [0.37, 0.014]], 40, 0),
    plane,
  };
}

export function buildWatchPieces(): WatchPieces {
  const { rails, frame, car } = buildCoaster();
  const { reel, film } = buildReel();
  const { globe, globeRing, plane } = buildGlobe();
  const outline = tonneauOutline(OUTLINE_POINTS);

  // End pieces: straight-sided trapezoids with rounded corners that carry the strap.
  const plateUp = roundedTrapezoid(1.34, 1.16, 0.62, 0.17);
  const plateDown = [...plateUp].reverse().map(([x, y]) => [x, -y] as const);
  const plateProfile = [[0, -0.31], [0.92, -0.31], [1.0, -0.27], [1.0, -0.07], [0.92, -0.03], [0, -0.03]] as const;

  const strapOptions = { start: 1.5, lengthUnits: 1.8, widthStart: 1.12, widthEnd: 0.94, thickness: 0.16, bend: 0.55, z: -0.14 };

  return {
    caseBack: loft(outline, [[0, -0.43], [0.95, -0.43], [0.985, -0.4], [0.985, -0.34], [0, -0.34]]),
    caseBand: loft(
      outline,
      [[0.985, -0.34], [1.0, -0.31], [1.0, -0.03], [0.985, 0.0], [0.93, 0.0], [0.93, -0.3], [0.94, -0.34]],
      { closed: true },
    ),
    lugs: mergeSmooth(
      translate(loft(plateUp, plateProfile), 0, 1.26, 0),
      translate(loft(plateDown, plateProfile), 0, -1.26, 0),
    ),
    bezel: loft(
      outline,
      [[1.0, 0.0], [1.0, 0.05], [0.975, 0.1], [0.915, 0.115], [0.9, 0.095], [0.9, 0.0]],
      { closed: true },
    ),
    crown: lathe([[0, 0], [0.12, 0], [0.145, 0.03], [0.145, 0.2], [0.115, 0.24], [0, 0.24]], 26, 0),
    strapUp: strap({ direction: 1, ...strapOptions }),
    strapDown: strap({ direction: -1, ...strapOptions }),
    dial: loft(outline, [[0, -0.03], [0.9, -0.03], [0.9, 0.0], [0, 0.0]]),
    plate: loft(outline, [[0, -0.31], [0.84, -0.31], [0.84, -0.27], [0, -0.27]]),
    gears: GEAR_SPECS.map((spec) =>
      gear({
        teeth: spec.teeth,
        outerRadius: spec.out,
        rootRadius: spec.out * 0.84,
        rimRadius: spec.out * 0.7,
        hubRadius: spec.hub,
        spokes: spec.spokes,
        thickness: 0.05,
      }),
    ),
    hourHand: hand(0.5, 0.07, 0.12, -0.012, 0.012),
    minuteHand: hand(0.78, 0.045, 0.16, -0.012, 0.012),
    secondHand: merge(
      hand(0.74, 0.012, 0.13, -0.006, 0.006),
      translateFlat(blossom(0.045, -0.006, 0.006), 0, -0.13, 0),
    ),
    cap: lathe([[0, 0], [0.075, 0], [0.06, 0.04], [0, 0.05]], 20, 0),
    crystal: loft(outline, [[0.92, 0.0], [0.91, 0.05], [0.66, 0.078], [0.32, 0.09], [0, 0.094]]),
    rails,
    frame,
    car,
    reel,
    film,
    invader: buildInvader(),
    globe,
    globeRing,
    plane,
    petal: blossom(0.13, -0.006, 0.006),
  };
}

/** Every buffer in the result, so a worker can hand them over without copying. */
export function bufferList(pieces: WatchPieces): ArrayBuffer[] {
  const buffers: ArrayBuffer[] = [];
  const add = (piece: Piece) => {
    if (piece instanceof Float32Array) buffers.push(piece.buffer as ArrayBuffer);
    else buffers.push(piece.position.buffer as ArrayBuffer, piece.normal.buffer as ArrayBuffer, piece.uv.buffer as ArrayBuffer);
  };
  for (const [key, value] of Object.entries(pieces)) {
    if (key === 'gears') (value as Piece[]).forEach(add);
    else add(value as Piece);
  }
  return buffers;
}

/** Build off the main thread when a Worker is available, otherwise inline. */
export async function loadWatchPieces(): Promise<WatchPieces> {
  if (typeof Worker !== 'undefined') {
    try {
      const worker = new Worker('/watch-geometry.worker.js');
      const pieces = await new Promise<WatchPieces>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<WatchPieces>) => resolve(event.data);
        worker.onerror = (event) => reject(event);
        worker.postMessage(null);
      });
      worker.terminate();
      return pieces;
    } catch {
      // Fall through to the main thread.
    }
  }
  return buildWatchPieces();
}
