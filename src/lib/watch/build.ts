import { blossom, box, ellipsoid, extrudeStar, gear, hand, lathe, loftX, merge, translateFlat, tube } from './geometry';
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
  carTrim: Piece;
  cam: Piece;
  camTrim: Piece;
  camSpokes: Piece;
  camCrank: Piece;
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

  // The car, pointing along +x with its origin on the rails' line, in the style of a modern
  // coaster car: a smooth bullet-shaped body with a raised hood that slopes down to a blunt nose,
  // an open cockpit sunk between two rolled rims with two contoured seats, a handrail over the
  // hood and wheels on each rail. The body and the fittings are two pieces so they can be two tones.
  const wheel = (x: number, side: number) =>
    tube([[x, 0.074, side * (GAUGE + 0.02)], [x, 0.074, side * (GAUGE - 0.02)]], 0.038, 14, [0, 1, 0]);
  const axle = (x: number) => tube([[x, 0.074, -GAUGE - 0.045], [x, 0.074, GAUGE + 0.045]], 0.016, 8, [0, 1, 0]);
  const seat = (x: number) => [
    ellipsoid(x, 0.228, 0, 0.05, 0.02, 0.1),
    ellipsoid(x - 0.05, 0.262, 0, 0.024, 0.04, 0.12),
    ellipsoid(x - 0.052, 0.312, -0.056, 0.027, 0.05, 0.05),
    ellipsoid(x - 0.052, 0.312, 0.056, 0.027, 0.05, 0.05),
  ];
  const rim = (side: number) =>
    tube(
      [
        [-0.3, 0.2, side * 0.115],
        [-0.25, 0.217, side * 0.148],
        [-0.1, 0.223, side * 0.158],
        [0.0, 0.225, side * 0.158],
        [0.035, 0.232, side * 0.154],
      ],
      0.013,
      8,
      [0, 1, 0],
    );
  const car = loftX(
    [
      { x: -0.34, y0: 0.15, y1: 0.195, hw: 0.1 },
      { x: -0.3, y0: 0.125, y1: 0.205, hw: 0.145 },
      { x: -0.25, y0: 0.12, y1: 0.21, hw: 0.16 },
      { x: 0.0, y0: 0.12, y1: 0.215, hw: 0.165 },
      { x: 0.04, y0: 0.12, y1: 0.305, hw: 0.165 },
      { x: 0.14, y0: 0.12, y1: 0.295, hw: 0.165 },
      { x: 0.24, y0: 0.125, y1: 0.265, hw: 0.155 },
      { x: 0.315, y0: 0.135, y1: 0.23, hw: 0.125 },
      { x: 0.345, y0: 0.15, y1: 0.215, hw: 0.085 },
    ],
    5,
    24,
  );
  const carTrim = merge(
    axle(-0.15),
    axle(0.15),
    wheel(-0.15, -1),
    wheel(-0.15, 1),
    wheel(0.15, -1),
    wheel(0.15, 1),
    rim(-1),
    rim(1),
    // A handrail over the hood, with a post at each end.
    tube(
      [
        [0.09, 0.28, -0.1],
        [0.09, 0.34, -0.095],
        [0.09, 0.355, -0.06],
        [0.09, 0.358, 0],
        [0.09, 0.355, 0.06],
        [0.09, 0.34, 0.095],
        [0.09, 0.28, 0.1],
      ],
      0.011,
      8,
      [1, 0, 0],
    ),
    // Almond lamps on the nose and a curved bumper under it.
    ellipsoid(0.3, 0.205, -0.075, 0.04, 0.026, 0.04, 4, 10),
    ellipsoid(0.3, 0.205, 0.075, 0.04, 0.026, 0.04, 4, 10),
    tube([[0.31, 0.148, -0.1], [0.345, 0.148, 0], [0.31, 0.148, 0.1]], 0.015, 8, [0, 1, 0]),
    ...seat(-0.07),
    ...seat(-0.19),
  );
  return { rails: merge(...parts), car, carTrim };
}

/**
 * A classic hand-cranked cine camera, lens pointing along +x: a rounded body, two film
 * magazines stacked on top like ears, a lens barrel with a hood, a viewfinder and a tripod.
 * The body is brass; the fittings are a second piece; the magazine spokes and the crank are
 * separate pieces because they turn.
 */
function buildCamera() {
  const body = loftX(
    [
      { x: -0.34, y0: -0.14, y1: 0.15, hw: 0.115 },
      { x: -0.3, y0: -0.16, y1: 0.17, hw: 0.14 },
      { x: 0.12, y0: -0.16, y1: 0.17, hw: 0.14 },
      { x: 0.24, y0: -0.14, y1: 0.15, hw: 0.115 },
    ],
    5,
    20,
  );
  // Two magazines, one a little behind the other, each a drum with a rim on both faces.
  const drum = (x: number, y: number, r: number, half: number) => [
    tube([[x, y, -half], [x, y, half]], r, 28, [0, 1, 0]),
    tube([[x, y, half - 0.002], [x, y, half + 0.014]], r + 0.012, 28, [0, 1, 0]),
    tube([[x, y, -half - 0.014], [x, y, -half + 0.002]], r + 0.012, 28, [0, 1, 0]),
  ];
  const drums = [...drum(-0.2, 0.34, 0.17, 0.07), ...drum(0.0, 0.32, 0.15, 0.075)];
  // A lens barrel, a hood and a tripod with three legs.
  const lens = [
    tube([[0.24, 0, 0], [0.5, 0, 0]], 0.08, 18, [0, 1, 0]),
    tube([[0.5, 0, 0], [0.62, 0, 0]], 0.108, 18, [0, 1, 0]),
  ];
  const tripod = [
    tube([[0, -0.16, 0], [0, -0.22, 0]], 0.1, 14, [1, 0, 0]),
    tube([[0, -0.22, 0], [0.3, -0.66, 0.16]], 0.024, 8, [0, 0, 1]),
    tube([[0, -0.22, 0], [-0.3, -0.66, 0.16]], 0.024, 8, [0, 0, 1]),
    tube([[0, -0.22, 0], [0, -0.66, -0.32]], 0.024, 8, [1, 0, 0]),
  ];
  const trim = merge(
    // Collars round the barrel, a bright ring on the front of the hood, the viewfinder and a
    // counter window on the side.
    tube([[0.3, 0, 0], [0.322, 0, 0]], 0.09, 18, [0, 1, 0]),
    tube([[0.42, 0, 0], [0.442, 0, 0]], 0.09, 18, [0, 1, 0]),
    tube([[0.618, 0, 0], [0.636, 0, 0]], 0.078, 18, [0, 1, 0]),
    tube([[-0.22, 0.1, 0.17], [0.12, 0.1, 0.17]], 0.022, 10, [0, 1, 0]),
    tube([[0.12, 0.1, 0.17], [0.15, 0.1, 0.17]], 0.03, 10, [0, 1, 0]),
    ellipsoid(0.02, -0.03, 0.14, 0.045, 0.045, 0.012, 5, 14),
    ...[-0.26, 0.02].map((x) => tube([[x, 0.02, 0.14], [x, 0.02, 0.15]], 0.016, 8, [0, 1, 0])),
  );
  // What turns: the spokes on a magazine face, and the hand crank.
  const spokes = merge(
    tube([[0, 0, 0], [0, 0, 0.03]], 0.04, 12, [0, 1, 0]),
    ...[0, Math.PI / 3, (2 * Math.PI) / 3].map((a) => box(0, 0, 0.01, 0.26, 0.03, 0.02, a)),
  );
  const crank = merge(
    tube([[0, 0, 0], [0, 0, 0.05]], 0.03, 10, [0, 1, 0]),
    tube([[0, 0, 0.05], [0.14, 0, 0.05]], 0.014, 8, [0, 1, 0]),
    tube([[0.14, 0, 0.05], [0.14, 0, 0.12]], 0.022, 10, [1, 0, 0]),
  );
  return { cam: merge(body, ...drums, ...lens, ...tripod), camTrim: trim, camSpokes: spokes, camCrank: crank };
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
  const { rails, car, carTrim } = buildCoaster();
  const { cam, camTrim, camSpokes, camCrank } = buildCamera();
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
    carTrim,
    cam,
    camTrim,
    camSpokes,
    camCrank,
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
