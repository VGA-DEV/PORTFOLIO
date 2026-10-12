import { blossom, box, ellipsoid, extrudeStar, gear, hand, lathe, merge, translateFlat, tube } from './geometry';
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
 * The roller coaster's route, seen from the side: the last of the lift hill, a wide
 * rounded crest at the very top, with the drop mirroring the climb. Built once from a few key points smoothed with a Catmull-Rom
 * spline and resampled at an even spacing, so the rails and the little cars follow
 * exactly the same line.
 */
export const COASTER_STEP = 0.04;

let coasterCache: { points: TrackPoint[]; length: number } | null = null;

export function coasterPath() {
  if (coasterCache) return coasterCache;
  // A short, rounded arch (like an upside-down U) rather than a pointed peak.
  const keys: [number, number, number][] = Array.from({ length: 13 }, (_, i) => {
    const x = -0.72 + (i / 12) * 1.44;
    return [x, 0.54 * (1 - Math.abs(x / 0.8) ** 2.4), 0] as [number, number, number];
  });

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

  // An even spacing along the line, so the box segments and the cars' pace are regular.
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

/** Half the gap between the two rails. */
const GAUGE = 0.13;

/**
 * A brass roller coaster seen from the top of the hill, in tubular steel style: two round rails
 * over a thicker spine, joined by slim struts, with a detailed train car. All one metal.
 */
function buildCoaster() {
  const { points } = coasterPath();
  const line = (z: number, lift: number) => points.map((p) => [p.x, p.y + lift, p.z + z] as const);
  const parts: Float32Array[] = [
    tube(line(-GAUGE, 0), 0.03, 8),
    tube(line(GAUGE, 0), 0.03, 8),
    tube(line(0, -0.085), 0.046, 8),
  ];
  // Struts from each rail down to the spine, every few steps.
  for (let i = 2; i < points.length - 1; i += 7) {
    const p = points[i];
    for (const side of [-1, 1]) {
      parts.push(tube([[p.x, p.y, p.z + side * GAUGE], [p.x, p.y - 0.085, p.z]], 0.011, 6, [1, 0, 0]));
    }
  }
  // The track ends in a cap on the spine, like a sealed pipe.
  const ends = [points[0], points[points.length - 1]];
  for (const e of ends) parts.push(tube([[e.x, e.y - 0.085, -GAUGE - 0.04], [e.x, e.y - 0.085, GAUGE + 0.04]], 0.026, 8, [0, 1, 0]));

  // The car, pointing along +x with its origin on the rails' line. Everything is round: a
  // cushioned body, a rounded nose, ellipsoid seats, arched bars, wheels with hubs and a curved
  // bumper at each end.
  const wheel = (x: number, side: number) =>
    tube([[x, 0.074, side * (GAUGE + 0.03)], [x, 0.074, side * (GAUGE - 0.03)]], 0.046, 14, [0, 1, 0]);
  const hub = (x: number, side: number) =>
    tube([[x, 0.074, side * (GAUGE + 0.03)], [x, 0.074, side * (GAUGE + 0.06)]], 0.024, 10, [0, 1, 0]);
  const arc = (x: number, y: number, bow: number, half: number, radius: number, lift = 0) =>
    tube(
      [-1, -0.5, 0, 0.5, 1].map((f) => [x + bow * (1 - f * f), y + lift * (1 - f * f), f * half] as const),
      radius,
      8,
      [0, 1, 0],
    );
  const seat = (x: number) => [
    ellipsoid(x, 0.205, 0, 0.055, 0.028, 0.1),
    ellipsoid(x - 0.05, 0.262, 0, 0.022, 0.065, 0.1),
    ellipsoid(x - 0.056, 0.332, 0, 0.022, 0.032, 0.06),
    arc(x + 0.05, 0.215, 0, 0.088, 0.011, 0.03),
  ];
  const car = merge(
    tube([[-0.11, 0.074, -GAUGE - 0.03], [-0.11, 0.074, GAUGE + 0.03]], 0.014, 8, [0, 1, 0]),
    tube([[0.11, 0.074, -GAUGE - 0.03], [0.11, 0.074, GAUGE + 0.03]], 0.014, 8, [0, 1, 0]),
    wheel(-0.11, -1),
    wheel(-0.11, 1),
    wheel(0.11, -1),
    wheel(0.11, 1),
    hub(-0.11, -1),
    hub(-0.11, 1),
    hub(0.11, -1),
    hub(0.11, 1),
    // Rounded fenders over the wheels.
    ellipsoid(-0.11, 0.128, -GAUGE, 0.075, 0.024, 0.045),
    ellipsoid(-0.11, 0.128, GAUGE, 0.075, 0.024, 0.045),
    ellipsoid(0.11, 0.128, -GAUGE, 0.075, 0.024, 0.045),
    ellipsoid(0.11, 0.128, GAUGE, 0.075, 0.024, 0.045),
    // Body: a flat underside, the cushioned tub and a rounded nose that flows out of it.
    ellipsoid(0, 0.142, 0, 0.27, 0.032, 0.15),
    ellipsoid(-0.01, 0.185, 0, 0.23, 0.065, 0.155),
    ellipsoid(0.2, 0.17, 0, 0.12, 0.055, 0.13),
    // Rolled rims along the top of each side.
    tube([[-0.2, 0.236, -0.14], [-0.1, 0.246, -0.15], [0, 0.248, -0.155], [0.1, 0.246, -0.15], [0.2, 0.236, -0.14]], 0.014, 8, [0, 1, 0]),
    tube([[-0.2, 0.236, 0.14], [-0.1, 0.246, 0.15], [0, 0.248, 0.155], [0.1, 0.246, 0.15], [0.2, 0.236, 0.14]], 0.014, 8, [0, 1, 0]),
    // Round studs along the sides.
    ...[-0.13, -0.065, 0, 0.065, 0.13].flatMap((x) => [
      ellipsoid(x, 0.195, -0.158, 0.011, 0.011, 0.008, 4, 8),
      ellipsoid(x, 0.195, 0.158, 0.011, 0.011, 0.008, 4, 8),
    ]),
    // Front: a curved bumper, a round lamp and a little ball on the nose; back: two rounded fins
    // and a curved bumper.
    arc(0.275, 0.14, 0.02, 0.125, 0.018),
    ellipsoid(0.29, 0.2, 0, 0.035, 0.032, 0.032),
    ellipsoid(0.2, 0.24, 0, 0.02, 0.02, 0.02, 4, 8),
    ellipsoid(-0.2, 0.225, -0.07, 0.035, 0.075, 0.02),
    ellipsoid(-0.2, 0.225, 0.07, 0.035, 0.075, 0.02),
    arc(-0.235, 0.14, -0.02, 0.125, 0.016),
    ...seat(-0.07),
    ...seat(0.085),
    // Hitch to the next car.
    tube([[0.285, 0.15, 0], [0.37, 0.15, 0]], 0.013, 8, [0, 0, 1]),
  );
  return { rails: merge(...parts), car };
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
  const { rails, car } = buildCoaster();
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
