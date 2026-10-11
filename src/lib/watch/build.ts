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
  shelf: Piece;
  books: Piece;
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

/** A stack of four books, covers in gold and page blocks apart, with a ribbon bookmark. */
function buildBookStack() {
  const specs = [
    { w: 0.8, h: 0.12, d: 0.52, dx: 0.0, tilt: 0 },
    { w: 0.66, h: 0.1, d: 0.46, dx: 0.05, tilt: 0.02 },
    { w: 0.72, h: 0.13, d: 0.5, dx: -0.04, tilt: -0.03 },
    { w: 0.5, h: 0.09, d: 0.4, dx: 0.03, tilt: 0.05 },
  ];
  const covers: Float32Array[] = [];
  const pages: Float32Array[] = [];
  let y = 0;
  specs.forEach(({ w, h, d, dx, tilt }) => {
    const cy = y + h / 2;
    const cx = dx;
    const board = 0.016;
    pages.push(box(cx + 0.012, cy, 0, w - 0.05, h - board * 2, d - 0.03, tilt));
    covers.push(
      box(cx, cy + (h - board) / 2, 0, w, board, d, tilt),
      box(cx, cy - (h - board) / 2, 0, w, board, d, tilt),
      box(cx - w / 2 + 0.016, cy, 0, 0.032, h, d, tilt),
    );
    y += h + 0.004;
  });
  // The ribbon hangs from the top book over its front edge.
  covers.push(box(0.2, y - 0.07, specs[specs.length - 1].d / 2 + 0.004, 0.026, 0.2, 0.008));
  return { shelf: merge(...covers), books: merge(...pages) };
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
  const { shelf, books } = buildBookStack();
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
    shelf,
    books,
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
