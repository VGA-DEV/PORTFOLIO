/**
 * Procedural low-poly geometry for the watch. Everything is a flat list of
 * triangles (positions only): the shaders derive flat normals from screen-space
 * derivatives, so winding order and normals never have to be right.
 */

export type Vec2 = readonly [number, number];

class TriangleBuilder {
  readonly data: number[] = [];

  tri(a: readonly number[], b: readonly number[], c: readonly number[]) {
    this.data.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }

  quad(
    a: readonly number[],
    b: readonly number[],
    c: readonly number[],
    d: readonly number[],
  ) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  build() {
    return new Float32Array(this.data);
  }
}

/** Revolve a closed (r, z) profile around the z axis with `sides` facets. */
export function lathe(
  profile: readonly Vec2[],
  sides: number,
  startAngle = Math.PI / sides,
) {
  const b = new TriangleBuilder();
  const point = (r: number, z: number, angle: number) =>
    [r * Math.cos(angle), r * Math.sin(angle), z] as const;

  for (let i = 0; i < sides; i++) {
    const a0 = startAngle + (i / sides) * Math.PI * 2;
    const a1 = startAngle + ((i + 1) / sides) * Math.PI * 2;
    for (let j = 0; j < profile.length; j++) {
      const [r0, z0] = profile[j];
      const [r1, z1] = profile[(j + 1) % profile.length];
      b.quad(point(r0, z0, a0), point(r0, z0, a1), point(r1, z1, a1), point(r1, z1, a0));
    }
  }
  return b.build();
}

/** Extrude a polygon that is star-shaped around the origin (fan triangulation). */
function extrudeStar(outline: readonly Vec2[], z0: number, z1: number) {
  const b = new TriangleBuilder();
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    b.tri([0, 0, z1], [x0, y0, z1], [x1, y1, z1]);
    b.tri([0, 0, z0], [x1, y1, z0], [x0, y0, z0]);
    b.quad([x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]);
  }
  return b.build();
}

/** Axis-aligned box centred on (cx, cy, cz), then rotated around z. */
export function box(
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  rotZ = 0,
) {
  const b = new TriangleBuilder();
  const cos = Math.cos(rotZ);
  const sin = Math.sin(rotZ);
  const v = (x: number, y: number, z: number) =>
    [cx + (x * cos - y * sin), cy + (x * sin + y * cos), cz + z] as const;
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const p = [
    v(-hx, -hy, -hz),
    v(hx, -hy, -hz),
    v(hx, hy, -hz),
    v(-hx, hy, -hz),
    v(-hx, -hy, hz),
    v(hx, -hy, hz),
    v(hx, hy, hz),
    v(-hx, hy, hz),
  ];
  b.quad(p[4], p[5], p[6], p[7]);
  b.quad(p[1], p[0], p[3], p[2]);
  b.quad(p[0], p[4], p[7], p[3]);
  b.quad(p[5], p[1], p[2], p[6]);
  b.quad(p[3], p[7], p[6], p[2]);
  b.quad(p[0], p[1], p[5], p[4]);
  return b.build();
}

type Vec3 = readonly [number, number, number];

/**
 * A faceted tube along a 3D polyline, closed at both ends: a rail, a pipe, an axle or a wheel.
 * `ref` is any direction the path does not run along, used to orient the cross-section.
 */
export function tube(path: readonly Vec3[], radius: number, sides = 8, ref: Vec3 = [0, 0, 1]) {
  const b = new TriangleBuilder();
  const norm = (v: Vec3): Vec3 => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const cross = (u: Vec3, v: Vec3): Vec3 => [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const rings = path.map((p, i) => {
    const prev = path[Math.max(i - 1, 0)];
    const next = path[Math.min(i + 1, path.length - 1)];
    const t = norm([next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]]);
    let u = cross(t, ref);
    if (Math.hypot(u[0], u[1], u[2]) < 0.2) u = cross(t, [0, 1, 0]);
    u = norm(u);
    const v = cross(t, u);
    return Array.from({ length: sides }, (_, k) => {
      const a = (k / sides) * Math.PI * 2;
      const c = Math.cos(a) * radius;
      const s = Math.sin(a) * radius;
      return [p[0] + u[0] * c + v[0] * s, p[1] + u[1] * c + v[1] * s, p[2] + u[2] * c + v[2] * s] as const;
    });
  });
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      b.quad(rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]);
    }
  }
  for (const [ring, centre] of [[rings[0], path[0]], [rings[rings.length - 1], path[path.length - 1]]] as const) {
    for (let k = 0; k < sides; k++) b.tri(centre, ring[k], ring[(k + 1) % sides]);
  }
  return b.build();
}

/**
 * A smooth body lofted along x: each section is a rounded rectangle (a superellipse) spanning
 * y0..y1 and half-width hw, so noses, hoods and tubs sweep without any flat boxes.
 */
export function loftX(
  sections: readonly { x: number; y0: number; y1: number; hw: number }[],
  power = 3,
  sides = 18,
) {
  const b = new TriangleBuilder();
  const rings = sections.map(({ x, y0, y1, hw }) => {
    const yc = (y0 + y1) / 2;
    const hh = (y1 - y0) / 2;
    return Array.from({ length: sides }, (_, k) => {
      const a = (k / sides) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const sx = Math.sign(c) * Math.abs(c) ** (2 / power);
      const sy = Math.sign(sn) * Math.abs(sn) ** (2 / power);
      return [x, yc + sy * hh, sx * hw] as const;
    });
  });
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      b.quad(rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]);
    }
  }
  for (const i of [0, sections.length - 1]) {
    const { x, y0, y1 } = sections[i];
    for (let k = 0; k < sides; k++) b.tri([x, (y0 + y1) / 2, 0], rings[i][k], rings[i][(k + 1) % sides]);
  }
  return b.build();
}

/** A faceted ellipsoid: a rounded blob for cushions, bodies, lamps and the like. */
export function ellipsoid(
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
  rings = 6,
  sides = 10,
) {
  const b = new TriangleBuilder();
  const at = (i: number, k: number) => {
    const phi = -Math.PI / 2 + (i / rings) * Math.PI;
    const theta = (k / sides) * Math.PI * 2;
    return [
      cx + rx * Math.cos(phi) * Math.cos(theta),
      cy + ry * Math.sin(phi),
      cz + rz * Math.cos(phi) * Math.sin(theta),
    ] as const;
  };
  for (let i = 0; i < rings; i++) {
    for (let k = 0; k < sides; k++) b.quad(at(i, k), at(i, k + 1), at(i + 1, k + 1), at(i + 1, k));
  }
  return b.build();
}

/** Join several geometries into one draw call. */
export function merge(...parts: Float32Array[]) {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * A skeletonised gear: a toothed rim, a hub and spokes. Teeth are trapezoids,
 * the rim is hollow so the plate shows through, like a skeleton movement.
 */
export function gear(options: {
  teeth: number;
  outerRadius: number;
  rootRadius: number;
  rimRadius: number;
  hubRadius: number;
  spokes: number;
  thickness: number;
}) {
  const { teeth, outerRadius, rootRadius, rimRadius, hubRadius, spokes, thickness } =
    options;
  const z0 = -thickness / 2;
  const z1 = thickness / 2;
  const b = new TriangleBuilder();

  const outline: Vec2[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const at = (frac: number, r: number): Vec2 => [
      r * Math.cos(a + frac * step),
      r * Math.sin(a + frac * step),
    ];
    outline.push(at(0.0, rootRadius), at(0.18, outerRadius), at(0.5 - 0.18, outerRadius), at(0.5, rootRadius));
  }

  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    const k0 = rimRadius / Math.hypot(x0, y0);
    const k1 = rimRadius / Math.hypot(x1, y1);
    const i0: Vec2 = [x0 * k0, y0 * k0];
    const i1: Vec2 = [x1 * k1, y1 * k1];
    b.quad([x0, y0, z1], [x1, y1, z1], [i1[0], i1[1], z1], [i0[0], i0[1], z1]);
    b.quad([x1, y1, z0], [x0, y0, z0], [i0[0], i0[1], z0], [i1[0], i1[1], z0]);
    b.quad([x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]);
    b.quad([i1[0], i1[1], z0], [i0[0], i0[1], z0], [i0[0], i0[1], z1], [i1[0], i1[1], z1]);
  }

  const parts = [b.build()];
  for (let s = 0; s < spokes; s++) {
    const angle = (s / spokes) * Math.PI * 2 + Math.PI / 2;
    const length = rimRadius - hubRadius * 0.4;
    const mid = (rimRadius + hubRadius * 0.4) / 2;
    parts.push(
      box(
        Math.cos(angle) * mid,
        Math.sin(angle) * mid,
        0,
        length,
        rimRadius * 0.12,
        thickness * 0.8,
        angle,
      ),
    );
  }
  parts.push(
    lathe(
      [
        [0, z0 * 1.4],
        [hubRadius, z0 * 1.4],
        [hubRadius * 0.7, z1 * 1.8],
        [0, z1 * 1.8],
      ],
      14,
    ),
  );
  return merge(...parts);
}

/** A convex kite for a watch hand, pointing along +y from the pivot. */
export function hand(length: number, width: number, tail: number, z0: number, z1: number) {
  return extrudeStar(
    [
      [-width, 0],
      [0, length],
      [width, 0],
      [0, -tail],
    ],
    z0,
    z1,
  );
}

/** Shift a flat triangle list. */
export function translateFlat(data: Float32Array, dx: number, dy: number, dz: number) {
  const out = new Float32Array(data);
  for (let i = 0; i < out.length; i += 3) {
    out[i] += dx;
    out[i + 1] += dy;
    out[i + 2] += dz;
  }
  return out;
}

/** A five-petal blossom, star-shaped about the origin, for the seconds-hand counterweight. */
export function blossom(radius: number, z0: number, z1: number) {
  const outline: Vec2[] = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2;
    const r = radius * (0.72 + 0.28 * Math.abs(Math.cos((5 * a) / 2)));
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  });
  return extrudeStar(outline, z0, z1);
}
