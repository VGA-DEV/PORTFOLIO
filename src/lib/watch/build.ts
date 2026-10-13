import { blossom, box, ellipsoid, gear, hand, lathe, loftX, merge, translateFlat, tube } from './geometry';
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
  camSpokes: Piece;
  invader: Piece;
  globeBall: Piece;
  globeGrid: Piece;
  globeStand: Piece;
  plane: Piece;
  planeTrail: Piece;
  deck: Piece;
  record: Piece;
  note: Piece;
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
 * A classic cine camera, lens pointing along +x, kept to its silhouette: a rounded body, two
 * film magazines on top like ears, a lens with a hood and a tripod. The magazine spokes are a
 * separate piece because they turn.
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
  // A magazine is a hollow ring (so the spokes and hub show through) with a thin flange on each face.
  const drum = (x: number, y: number, r: number, half: number) => [
    translateFlat(lathe([[r - 0.032, -half], [r, -half], [r, half], [r - 0.032, half]], 32, 0), x, y, 0),
    translateFlat(lathe([[r - 0.05, -half], [r + 0.012, -half], [r + 0.012, -half + 0.012], [r - 0.05, -half + 0.012]], 32, 0), x, y, 0),
    translateFlat(lathe([[r - 0.05, half - 0.012], [r + 0.012, half - 0.012], [r + 0.012, half], [r - 0.05, half]], 32, 0), x, y, 0),
  ];
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
  const spokes = merge(
    tube([[0, 0, -0.04], [0, 0, 0.04]], 0.045, 14, [0, 1, 0]),
    ...[0, Math.PI / 3, (2 * Math.PI) / 3].map((a) => box(0, 0, 0, 0.28, 0.034, 0.024, a)),
  );
  return { cam: merge(body, ...drum(-0.2, 0.34, 0.17, 0.07), ...drum(0.0, 0.32, 0.15, 0.075), ...lens, ...tripod), camSpokes: spokes };
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

/** A solid of revolution made about the z axis, stood up so its axis is y. */
const upright = (data: Float32Array) => {
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 3) {
    out[i] = data[i];
    out[i + 1] = data[i + 2];
    out[i + 2] = data[i + 1];
  }
  return out;
};

/** Where the globe's meridian arc and the plane's orbit are, shared with the scene. */
export const GLOBE = { radius: 0.3, arc: 0.37, orbit: 0.56 };

/**
 * A desk globe and a propeller plane. The ball (with relief continents and a graticule of fine
 * rings) turns inside a brass meridian arc on a stand; the plane flies round it along a dotted
 * flight path. The ball and its grid are separate pieces from the stand because they turn.
 */
function buildGlobe() {
  const r = GLOBE.radius;
  const ball = ellipsoid(0, 0, 0, r, r, r, 10, 22);

  // Continents as raised blobs at (latitude, longitude, size) in degrees.
  const land: [number, number, number][] = [
    [48, -100, 0.075],
    [-14, -60, 0.055],
    [50, 12, 0.04],
    [6, 20, 0.07],
    [52, 90, 0.09],
    [-25, 134, 0.042],
  ];
  const blobs = land.map(([lat, lon, size]) => {
    const la = (lat * Math.PI) / 180;
    const lo = (lon * Math.PI) / 180;
    const d = r * 0.96;
    return ellipsoid(d * Math.cos(la) * Math.cos(lo), d * Math.sin(la), d * Math.cos(la) * Math.sin(lo), size, size, size, 4, 8);
  });
  // Latitude rings and two crossing meridians, as slim tubes just clear of the ball.
  const ring = (lat: number) => {
    const la = (lat * Math.PI) / 180;
    return tube(
      Array.from({ length: 25 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const rr = (r + 0.004) * Math.cos(la);
        return [rr * Math.cos(a), (r + 0.004) * Math.sin(la), rr * Math.sin(a)] as const;
      }),
      0.005,
      5,
      [0, 1, 0],
    );
  };
  const meridian = (lon: number) => {
    const lo = (lon * Math.PI) / 180;
    return tube(
      Array.from({ length: 25 }, (_, i) => {
        const la = (i / 24) * Math.PI * 2;
        const rr = (r + 0.004) * Math.cos(la);
        return [rr * Math.cos(lo), (r + 0.004) * Math.sin(la), rr * Math.sin(lo)] as const;
      }),
      0.005,
      5,
      [0, 0, 1],
    );
  };
  const grid = merge(ring(0), ring(30), ring(-30), meridian(0), meridian(90), ...blobs);

  // The stand: a stepped base, a stem, and the meridian arc with a pin at each pole.
  const arc = tube(
    Array.from({ length: 21 }, (_, i) => {
      const a = -Math.PI / 2 + (i / 20) * Math.PI;
      return [0.0, GLOBE.arc * Math.sin(a), -GLOBE.arc * Math.cos(a)] as const;
    }).map(([x, y, z]) => [x, y, z] as const),
    0.014,
    8,
    [1, 0, 0],
  );
  const baseY = -0.6;
  const stand = merge(
    translateFlat(upright(lathe([[0, 0], [0.24, 0], [0.24, 0.025], [0.19, 0.045], [0.05, 0.06], [0, 0.06]], 24, 0)), 0, baseY, 0),
    arc,
    // The stem rises from the base to the bottom of the arc; a pin at each pole holds the ball.
    tube([[0, baseY + 0.06, 0], [0, -GLOBE.arc, 0]], 0.02, 10, [1, 0, 0]),
    tube([[0, -r - 0.07, 0], [0, -r - 0.01, 0]], 0.012, 8, [1, 0, 0]),
    tube([[0, r + 0.01, 0], [0, r + 0.07, 0]], 0.012, 8, [1, 0, 0]),
  );

  // A classic propeller plane, nose along +x: round fuselage, straight wings, tail, two engines.
  const plane = merge(
    ellipsoid(0, 0, 0, 0.12, 0.03, 0.03, 5, 10),
    ellipsoid(0.115, 0, 0, 0.04, 0.026, 0.026, 4, 8),
    box(0.01, 0.002, 0, 0.075, 0.008, 0.3),
    box(-0.1, 0.004, 0, 0.04, 0.006, 0.12),
    box(-0.105, 0.036, 0, 0.05, 0.055, 0.007, 0.5),
    tube([[-0.01, -0.012, -0.08], [0.065, -0.012, -0.08]], 0.015, 8, [0, 1, 0]),
    tube([[-0.01, -0.012, 0.08], [0.065, -0.012, 0.08]], 0.015, 8, [0, 1, 0]),
    box(0.07, -0.012, -0.08, 0.004, 0.06, 0.008),
    box(0.07, -0.012, -0.08, 0.004, 0.008, 0.06),
    box(0.07, -0.012, 0.08, 0.004, 0.06, 0.008),
    box(0.07, -0.012, 0.08, 0.004, 0.008, 0.06),
  );
  // The flight path: a ring of small beads, tilted by the scene.
  const trail = merge(
    ...Array.from({ length: 36 }, (_, i) => {
      const a = (i / 36) * Math.PI * 2;
      return ellipsoid(GLOBE.orbit * Math.cos(a), 0, GLOBE.orbit * Math.sin(a), 0.012, 0.012, 0.012, 3, 6);
    }),
  );
  return { globeBall: ball, globeGrid: grid, globeStand: stand, plane, planeTrail: trail };
}

/**
 * A record player in brass, kept to its silhouette: a rounded plinth, a record with a label, a
 * tonearm and one music note. The record is a separate piece because it turns.
 */
function buildTurntable() {
  const deck = merge(
    loftX(
      [
        { x: -0.52, y0: -0.1, y1: 0.0, hw: 0.36 },
        { x: -0.48, y0: -0.11, y1: 0.005, hw: 0.4 },
        { x: 0.48, y0: -0.11, y1: 0.005, hw: 0.4 },
        { x: 0.52, y0: -0.1, y1: 0.0, hw: 0.36 },
      ],
      5,
      20,
    ),
    // The tonearm: a round base and one bent arm.
    translateFlat(upright(lathe([[0, 0], [0.055, 0], [0.055, 0.05], [0, 0.05]], 16, 0)), 0.38, 0.0, -0.27),
    tube([[0.38, 0.065, -0.27], [0.28, 0.08, -0.1], [0.12, 0.07, 0.1]], 0.012, 8, [0, 1, 0]),
    ellipsoid(0.1, 0.06, 0.13, 0.03, 0.014, 0.018, 3, 8),
  );
  const record = merge(
    upright(lathe([[0, 0], [0.27, 0], [0.27, 0.012], [0, 0.012]], 36, 0)),
    upright(lathe([[0, 0.012], [0.09, 0.012], [0.09, 0.024], [0, 0.024]], 20, 0)),
  );
  const note = merge(
    ellipsoid(0, 0, 0, 0.055, 0.04, 0.02, 4, 10),
    tube([[0.046, 0.01, 0], [0.046, 0.25, 0]], 0.01, 6, [1, 0, 0]),
    box(0.085, 0.225, 0, 0.08, 0.026, 0.014, -0.55),
  );
  return { deck, record, note };
}

export function buildWatchPieces(): WatchPieces {
  const turntable = buildTurntable();
  const { rails, car, carTrim } = buildCoaster();
  const { cam, camSpokes } = buildCamera();
  const { globeBall, globeGrid, globeStand, plane, planeTrail } = buildGlobe();
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
    camSpokes,
    invader: buildInvader(),
    globeBall,
    globeGrid,
    globeStand,
    plane,
    planeTrail,
    deck: turntable.deck,
    record: turntable.record,
    note: turntable.note,
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
