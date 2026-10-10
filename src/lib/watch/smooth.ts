/**
 * Smooth, lit geometry for the tonneau case: lofts of a closed outline scaled
 * along a (scale, z) profile, and parametric surfaces. Both return positions,
 * normals and uvs so the shaders can shade polished metal and leather.
 */

export type Vec2 = readonly [number, number];
export type ProfilePoint = readonly [number, number];

export type SmoothMesh = {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
};

type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const normalize = (a: V3): V3 => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Case proportions shared by the 3D scene, the dial canvas and the SVG fallback. */
export const CASE = { a: 1, b: 1.22, taper: 0.16 } as const;

/**
 * A barrel (tonneau) outline, counter-clockwise: widest at the waist, narrower at
 * the flat top and bottom where the lugs attach.
 */
export function tonneauOutline(
  count = 160,
  a: number = CASE.a,
  b: number = CASE.b,
  ex = 2.1,
  ey = 3.4,
  taper: number = CASE.taper,
): Vec2[] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i / count) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const y = b * Math.sign(s) * Math.abs(s) ** (2 / ey);
    const squeeze = 1 - taper * (y / b) ** 2;
    return [a * Math.sign(c) * Math.abs(c) ** (2 / ex) * squeeze, y] as const;
  });
}

/**
 * Point where a ray from the centre, at `clockwiseDegrees` from 12 o'clock,
 * leaves the outline scaled by `scale`. Used for numerals and tick marks.
 */
export function rayHit(outline: readonly Vec2[], clockwiseDegrees: number, scale = 1): Vec2 {
  const angle = (clockwiseDegrees * Math.PI) / 180;
  const dx = Math.sin(angle);
  const dy = Math.cos(angle);
  let best: Vec2 = [0, 0];
  let bestT = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    const ex = x1 - x0;
    const ey = y1 - y0;
    const det = dx * -ey - dy * -ex;
    if (Math.abs(det) < 1e-9) continue;
    const t = (x0 * -ey - y0 * -ex) / det;
    const u = (dx * y0 - dy * x0) / det;
    if (t > bestT && u >= 0 && u <= 1) {
      bestT = t;
      best = [dx * t, dy * t];
    }
  }
  return [best[0] * scale, best[1] * scale];
}

/**
 * Loft a closed outline through a profile of (scale, z) points. The profile is
 * walked counter-clockwise in the (scale, z) half-plane so normals face out.
 * `closed` joins the last profile point back to the first (tubes, bands).
 */
export function loft(
  outline: readonly Vec2[],
  profile: readonly ProfilePoint[],
  options: { closed?: boolean; smoothDegrees?: number } = {},
): SmoothMesh {
  const { closed = false, smoothDegrees = 38 } = options;
  const n = outline.length;
  const m = profile.length;
  const segments = closed ? m : m - 1;
  const cosLimit = Math.cos((smoothDegrees * Math.PI) / 180);

  const ring = (j: number, i: number): V3 => {
    const [s, z] = profile[((j % m) + m) % m];
    const [x, y] = outline[((i % n) + n) % n];
    return [x * s, y * s, z];
  };

  const tangentU = (j: number, i: number, fallbackJ: number): V3 => {
    const t = sub(ring(j, i + 1), ring(j, i - 1));
    if (length(t) > 1e-6) return t;
    return sub(ring(fallbackJ, i + 1), ring(fallbackJ, i - 1));
  };

  /** Normal of segment `k` at outline index `i`, on its start (0) or end (1). */
  const segmentNormal = (k: number, i: number, end: 0 | 1): V3 => {
    const j0 = k;
    const j1 = k + 1;
    const tv = sub(ring(j1, i), ring(j0, i));
    const tu = end === 0 ? tangentU(j0, i, j1) : tangentU(j1, i, j0);
    return normalize(cross(tu, tv));
  };

  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];

  const push = (p: V3, nn: V3, u: number, v: number) => {
    position.push(p[0], p[1], p[2]);
    normal.push(nn[0], nn[1], nn[2]);
    uv.push(u, v);
  };

  for (let k = 0; k < segments; k++) {
    const prev = closed ? (k - 1 + segments) % segments : k - 1;
    const next = closed ? (k + 1) % segments : k + 1;
    for (let i = 0; i < n; i++) {
      const i1 = i + 1;
      const corner = (idx: number, end: 0 | 1) => {
        const own = segmentNormal(k, idx, end);
        const other = end === 0 ? prev : next;
        if (other < 0 || other >= segments) return own;
        const neighbour = segmentNormal(other, idx, end === 0 ? 1 : 0);
        return dot(own, neighbour) > cosLimit
          ? normalize([own[0] + neighbour[0], own[1] + neighbour[1], own[2] + neighbour[2]])
          : own;
      };
      const a = ring(k, i);
      const b = ring(k, i1);
      const c = ring(k + 1, i1);
      const d = ring(k + 1, i);
      const na0 = corner(i, 0);
      const nb0 = corner(i1, 0);
      const nc1 = corner(i1, 1);
      const nd1 = corner(i, 1);
      const u0 = i / n;
      const u1 = (i + 1) / n;
      const v0 = k / segments;
      const v1 = (k + 1) / segments;
      push(a, na0, u0, v0);
      push(b, nb0, u1, v0);
      push(c, nc1, u1, v1);
      push(a, na0, u0, v0);
      push(c, nc1, u1, v1);
      push(d, nd1, u0, v1);
    }
  }

  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    uv: new Float32Array(uv),
  };
}

/** A parametric surface with normals from central differences. */
export function parametric(
  nu: number,
  nv: number,
  f: (u: number, v: number) => V3,
  wrapU = false,
): SmoothMesh {
  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  const eps = 1e-3;

  const at = (iu: number, iv: number) => {
    const u = iu / nu;
    const v = iv / nv;
    const p = f(u, v);
    const du = sub(f(wrapU ? u + eps : Math.min(u + eps, 1), v), f(wrapU ? u - eps : Math.max(u - eps, 0), v));
    const dv = sub(f(u, Math.min(v + eps, 1)), f(u, Math.max(v - eps, 0)));
    const nn = normalize(cross(du, dv));
    return { p, nn, u, v };
  };

  const pushVertex = (q: ReturnType<typeof at>) => {
    position.push(q.p[0], q.p[1], q.p[2]);
    normal.push(q.nn[0], q.nn[1], q.nn[2]);
    uv.push(q.u, q.v);
  };

  for (let iu = 0; iu < nu; iu++) {
    for (let iv = 0; iv < nv; iv++) {
      const a = at(iu, iv);
      const b = at(iu + 1, iv);
      const c = at(iu + 1, iv + 1);
      const d = at(iu, iv + 1);
      [a, b, c, a, c, d].forEach(pushVertex);
    }
  }

  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    uv: new Float32Array(uv),
  };
}

/**
 * A leather strap: a rounded-rectangle cross-section swept along +y or -y,
 * curving back behind the case as it leaves the lugs.
 */
export function strap(options: {
  direction: 1 | -1;
  start: number;
  lengthUnits: number;
  widthStart: number;
  widthEnd: number;
  thickness: number;
  bend: number;
  z: number;
}): SmoothMesh {
  const { direction, start, lengthUnits, widthStart, widthEnd, thickness, bend, z } = options;
  return parametric(
    48,
    32,
    (u, v) => {
      const theta = u * Math.PI * 2;
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const w = (widthStart + (widthEnd - widthStart) * v) / 2;
      const cx = w * Math.sign(c) * Math.abs(c) ** (2 / 4);
      const cz = (thickness / 2) * Math.sign(s) * Math.abs(s) ** (2 / 4);
      const cy = direction * (start + v * lengthUnits);
      const centerZ = z - bend * v * v;
      // Frame along the path: T is the tangent, N the side that faces the viewer.
      const tangent = normalize([0, direction * lengthUnits, -2 * bend * v]);
      let nY = -tangent[2];
      let nZ = tangent[1];
      if (nZ < 0) {
        nY = -nY;
        nZ = -nZ;
      }
      const nl = Math.hypot(nY, nZ) || 1;
      return [cx, cy + (nY / nl) * cz, centerZ + (nZ / nl) * cz];
    },
    true,
  );
}
