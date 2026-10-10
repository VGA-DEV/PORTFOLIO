import { Camera, Geometry, Mesh, Program, Renderer, Texture, Transform } from 'ogl';
import { makeDialCanvas, makeEngravingCanvas } from './dial';
import { blossom, box, gear, hand, lathe, merge, translateFlat } from './geometry';
import { loft, strap, tonneauOutline, type SmoothMesh } from './smooth';

type Rgb = readonly [number, number, number];
type V3 = readonly [number, number, number];

/** Palette, kept in step with globals.css. */
const COLORS = {
  gold: [1.0, 0.72, 0.3],
  rhodium: [0.78, 0.8, 0.88],
  lavender: [0.78, 0.8, 0.945],
  violet: [0.5, 0.2, 0.85],
  bluedSteel: [0.1, 0.14, 0.5],
  roseGold: [0.95, 0.55, 0.46],
  leather: [0.13, 0.035, 0.22],
} as const;

const vertexSource = (flat: boolean) => /* glsl */ `#version 300 es
${flat ? '#define FLAT' : ''}
in vec3 position;
#ifndef FLAT
in vec3 normal;
in vec2 uv;
#endif
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out vec2 vUv;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vLocal = position;
#ifdef FLAT
  vNormal = vec3(0.0, 0.0, 1.0);
  vUv = vec2(0.0);
#else
  vNormal = mat3(modelMatrix) * normal;
  vUv = uv;
#endif
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/** MODE: 0 metal, 1 leather, 2 dial, 3 sapphire glass, 4 engraved case back. */
const fragmentSource = (mode: 0 | 1 | 2 | 3 | 4, flat: boolean) => /* glsl */ `#version 300 es
precision highp float;
${flat ? '#define FLAT' : ''}
#define MODE ${mode}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
in vec2 vUv;
out vec4 outColor;
uniform vec3 cameraPosition;
uniform vec3 uAlbedo;
uniform vec3 uF0;
uniform float uRough;
uniform float uPhase;
uniform float uSprocket;
#if MODE == 2
uniform sampler2D tDial;
#endif
#if MODE == 4
uniform sampler2D tBack;
#endif

float softbox(vec3 d, vec3 axis, vec2 size, float soft) {
  float z = dot(d, axis);
  if (z < 0.02) return 0.0;
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), axis));
  vec3 up = cross(axis, right);
  vec2 p = vec2(dot(d, right), dot(d, up)) / z;
  vec2 q = abs(p) - size;
  return 1.0 - smoothstep(-soft, soft, max(q.x, q.y));
}

// A small photo studio: a big key softbox, a tall strip, a purple fill and a rim.
vec3 studio(vec3 d, float rough) {
  float soft = 0.04 + rough * 1.1;
  vec3 c = mix(vec3(0.03, 0.02, 0.05), vec3(0.2, 0.18, 0.3), smoothstep(-0.7, 0.9, d.y));
  c += vec3(1.0, 0.96, 0.9) * 2.6 * softbox(d, normalize(vec3(-0.5, 0.75, 0.6)), vec2(0.75, 0.5), soft);
  c += vec3(0.85, 0.9, 1.0) * 2.0 * softbox(d, normalize(vec3(0.95, 0.15, 0.3)), vec2(0.14, 0.95), soft);
  c += vec3(0.9, 0.6, 1.0) * 1.6 * softbox(d, normalize(vec3(-0.85, -0.25, 0.45)), vec2(0.35, 0.5), soft);
  c += vec3(1.0, 0.92, 0.8) * 1.4 * softbox(d, normalize(vec3(0.1, 0.3, -0.95)), vec2(0.9, 0.2), soft);
  return mix(c, vec3(0.35, 0.33, 0.42), clamp(rough * 0.7, 0.0, 0.8));
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

void main() {
#ifdef FLAT
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
#else
  vec3 n = normalize(vNormal);
#endif
  vec3 v = normalize(cameraPosition - vWorld);
  n = faceforward(n, -v, n);
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  vec3 r = reflect(-v, n);
  vec3 keyDir = normalize(vec3(-0.4, 0.8, 0.6));
  float key = max(dot(n, keyDir), 0.0);

#if MODE == 0
  vec3 fresnel = uF0 + (1.0 - uF0) * pow(1.0 - ndv, 5.0);
  vec3 col = studio(r, uRough) * fresnel + uAlbedo * 0.03;
  // Film-sprocket notches on the bezel's flat top.
  float hole = uSprocket * step(abs(fract(vUv.x * 88.0) - 0.5), 0.2) * step(abs(vUv.y - 0.417), 0.05);
  col = mix(col, vec3(0.02, 0.01, 0.03), hole * 0.9);
  outColor = vec4(pow(aces(col * 0.75), vec3(1.0 / 2.2)), 1.0);
#elif MODE == 1
  float grain = hash(floor(vLocal * 90.0));
  vec3 base = uAlbedo * (0.75 + 0.4 * grain);
  vec3 col = base * (0.14 + 0.85 * key);
  col += studio(r, 0.6) * 0.07;
  col += vec3(0.55, 0.35, 0.9) * pow(1.0 - ndv, 3.0) * 0.12;
  float line = min(abs(vUv.x - 0.14), abs(vUv.x - 0.36));
  float dash = step(0.5, fract(vUv.y * 38.0));
  float stitch = smoothstep(0.006, 0.0, line) * dash;
  col = mix(col, vec3(0.84, 0.74, 0.54), stitch * 0.9);
  outColor = vec4(pow(aces(col), vec3(1.0 / 2.2)), 1.0);
#elif MODE == 2
  vec2 uvd = vec2(vLocal.x / 0.84 * 0.5 + 0.5, vLocal.y / 1.134 * 0.5 + 0.5);
  vec3 tex = pow(texture(tDial, uvd).rgb, vec3(2.2));
  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  vec3 col = tex * (0.2 + 0.26 * key) + studio(r, 0.1) * fres * 0.3;
  outColor = vec4(pow(aces(col), vec3(1.0 / 2.2)), 1.0);
#elif MODE == 4
  // Seen from behind, so the engraving is mirrored left to right.
  vec2 uvb = vec2(0.5 - vLocal.x / 0.985 * 0.5, vLocal.y / 1.3298 * 0.5 + 0.5);
  float mask = texture(tBack, uvb).r;
  vec3 f0 = uF0 * mix(0.28, 1.0, mask);
  vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - ndv, 5.0);
  vec3 col = studio(r, mix(0.55, uRough, mask)) * fresnel + uAlbedo * 0.03;
  outColor = vec4(pow(aces(col * 0.75), vec3(1.0 / 2.2)), 1.0);
#else
  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  float along = dot(vLocal.xy, vec2(0.6, -0.8));
  float sweep = uPhase * 3.2 - 1.6;
  float streak = smoothstep(0.16, 0.0, abs(along - sweep));
  float streak2 = smoothstep(0.05, 0.0, abs(along - sweep + 0.34));
  vec3 refl = studio(r, 0.02) * fres * 1.6 + vec3(0.92, 0.94, 1.0) * (streak * 0.3 + streak2 * 0.2);
  float a = clamp(0.03 + fres * 1.2 + streak * 0.3 + streak2 * 0.2, 0.0, 0.85);
  outColor = vec4(pow(aces(refl), vec3(1.0 / 2.2)), a);
#endif
}
`;

export type WatchScene = {
  /** Continuous position along the page: 0 = hero, 1 = projects, and so on. */
  setPosition: (value: number) => void;
  setRunning: (running: boolean) => void;
  resize: () => void;
  dispose: () => void;
};

export type WatchSceneOptions = {
  canvas: HTMLCanvasElement;
  /** Render a single still frame instead of animating. */
  still: boolean;
  /** Lines engraved on the case back. */
  engraving: readonly string[];
};

type Group =
  | 'crystal'
  | 'bezel'
  | 'dial'
  | 'hands'
  | 'movement'
  | 'caseBand'
  | 'caseBack'
  | 'lugs'
  | 'strap'
  | 'crown';

type PoseState = {
  rotation: V3;
  focus: V3;
  /** Half the visible height, in scene units. */
  half: number;
  /** 0 assembled, 1 fully taken apart. */
  explode: number;
  show: Partial<Record<Group, number>>;
};

const ALL: Partial<Record<Group, number>> = {
  crystal: 1, bezel: 1, dial: 1, hands: 1, movement: 1, caseBand: 1, caseBack: 1, lugs: 1, strap: 1, crown: 1,
};

/**
 * One pose per page section: hero, projects, experience, stack, evolution,
 * contact. Between two sections the watch bursts apart, drops the pieces it no
 * longer needs and settles on the one the next section is about.
 */
const STATES: readonly PoseState[] = [
  { rotation: [0.16, -0.45, 0], focus: [0, 0, 0], half: 2.35, explode: 0, show: ALL },
  { rotation: [0.3, -0.55, 0], focus: [0, 0, -0.35], half: 1.5, explode: 0.45, show: { movement: 1 } },
  { rotation: [0.12, -0.3, 0], focus: [0, 0, 0.2], half: 1.6, explode: 0.3, show: { dial: 1, hands: 1 } },
  { rotation: [0.2, -0.95, 0.05], focus: [0, 0, 0], half: 3.55, explode: 1, show: ALL },
  { rotation: [0.04, Math.PI + 0.12, 0], focus: [0, 0, -0.4], half: 1.55, explode: 0.12, show: { caseBack: 1, caseBand: 1 } },
  { rotation: [0.15, -1.15, 0], focus: [0.95, 0.3, -0.1], half: 1.6, explode: 0.15, show: { crown: 1, caseBand: 1, lugs: 1, strap: 1, bezel: 1 } },
];

const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

type MeshData = Float32Array | SmoothMesh;

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

export function createWatchScene({ canvas, still, engraving }: WatchSceneOptions): WatchScene {
  const renderer = new Renderer({
    canvas,
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    dpr: Math.min(window.devicePixelRatio || 1, 1.75),
    webgl: 2,
  });
  const { gl } = renderer;
  gl.clearColor(0, 0, 0, 0);
  if (!(gl instanceof WebGL2RenderingContext)) throw new Error('WebGL2 required');

  const camera = new Camera(gl, { fov: 26, near: 1, far: 60 });
  const scene = new Transform();
  const rotator = new Transform();
  rotator.setParent(scene);
  /** Holds every piece; shifted so the focused point sits at the rotation centre. */
  const watch = new Transform();
  watch.setParent(rotator);

  const outline = tonneauOutline(160);

  const fontFamily =
    getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() ||
    'sans-serif';
  const texture = (image: HTMLCanvasElement) =>
    new Texture(gl, {
      image,
      generateMipmaps: true,
      minFilter: gl.LINEAR_MIPMAP_LINEAR,
      magFilter: gl.LINEAR,
      anisotropy: 8,
    });
  const dialTexture = texture(makeDialCanvas(outline, fontFamily));
  const backTexture = texture(makeEngravingCanvas(outline, fontFamily, engraving));

  const glassPhase = { value: 0.2 };

  type Material = {
    mode: 0 | 1 | 2 | 3 | 4;
    albedo: Rgb;
    f0: Rgb;
    rough: number;
    transparent?: boolean;
    sprocket?: number;
  };
  const program = (m: Material, flat: boolean) =>
    new Program(gl, {
      vertex: vertexSource(flat),
      fragment: fragmentSource(m.mode, flat),
      cullFace: false,
      transparent: m.transparent ?? false,
      depthWrite: !m.transparent,
      uniforms: {
        uAlbedo: { value: [...m.albedo] },
        uF0: { value: [...m.f0] },
        uRough: { value: m.rough },
        uPhase: glassPhase,
        uSprocket: { value: m.sprocket ?? 0 },
        ...(m.mode === 2 ? { tDial: { value: dialTexture } } : {}),
        ...(m.mode === 4 ? { tBack: { value: backTexture } } : {}),
      },
    });

  const gold = (rough: number): Material => ({ mode: 0, albedo: COLORS.gold, f0: COLORS.gold, rough });
  const steel = (color: Rgb, rough: number): Material => ({ mode: 0, albedo: color, f0: color, rough });

  type Layer = {
    node: Transform;
    group: Group;
    base: [number, number, number];
    offset: [number, number, number];
  };
  const layers: Layer[] = [];

  const register = (
    node: Transform,
    group: Group,
    base: [number, number, number],
    offset: [number, number, number],
  ) => {
    layers.push({ node, group, base, offset });
  };

  const addLayer = (
    group: Group,
    data: MeshData,
    material: Material,
    offset: [number, number, number],
    base: [number, number, number] = [0, 0, 0],
  ) => {
    const flat = data instanceof Float32Array;
    const attributes: Record<string, { size: number; data: Float32Array }> = flat
      ? { position: { size: 3, data } }
      : {
          position: { size: 3, data: data.position },
          normal: { size: 3, data: data.normal },
          uv: { size: 2, data: data.uv },
        };
    const mesh = new Mesh(gl, {
      geometry: new Geometry(gl, attributes),
      program: program(material, flat),
    });
    mesh.position.set(...base);
    mesh.setParent(watch);
    register(mesh, group, base, offset);
    return mesh;
  };

  // --- case ---------------------------------------------------------------
  addLayer(
    'caseBack',
    loft(outline, [[0, -0.43], [0.95, -0.43], [0.985, -0.4], [0.985, -0.34], [0, -0.34]]),
    { mode: 4, albedo: COLORS.gold, f0: COLORS.gold, rough: 0.28 },
    [0, 0, -1.6],
  );

  addLayer(
    'caseBand',
    loft(
      outline,
      [[0.985, -0.34], [1.0, -0.31], [1.0, -0.03], [0.985, 0.0], [0.88, 0.0], [0.88, -0.3], [0.9, -0.34]],
      { closed: true },
    ),
    gold(0.34),
    [0, 0, -0.95],
  );

  const lugShape = loft(tonneauOutline(56, 0.17, 0.27, 4, 4), [
    [0, -0.2], [0.9, -0.2], [1.0, -0.16], [1.0, -0.05], [0.9, -0.01], [0, -0.01],
  ]);
  addLayer(
    'lugs',
    mergeSmooth(
      translate(lugShape, -0.56, 1.46, 0),
      translate(lugShape, 0.56, 1.46, 0),
      translate(lugShape, -0.56, -1.46, 0),
      translate(lugShape, 0.56, -1.46, 0),
    ),
    gold(0.2),
    [0, 0, -0.95],
  );

  // Bezel: a polished chamfer with film-sprocket notches on the flat top.
  addLayer(
    'bezel',
    loft(
      outline,
      [[1.0, 0.0], [1.0, 0.05], [0.97, 0.105], [0.87, 0.117], [0.84, 0.095], [0.84, 0.0]],
      { closed: true },
    ),
    { ...gold(0.12), sprocket: 1 },
    [0, 0, 1.15],
  );

  const crown = addLayer(
    'crown',
    lathe([[0, 0], [0.12, 0], [0.145, 0.03], [0.145, 0.2], [0.115, 0.24], [0, 0.24]], 26, 0),
    gold(0.28),
    [0.75, 0, -0.95],
    [0.97, 0.32, -0.16],
  );
  crown.rotation.y = Math.PI / 2;

  // --- strap --------------------------------------------------------------
  const leather: Material = { mode: 1, albedo: COLORS.leather, f0: [0.04, 0.04, 0.04], rough: 0.7 };
  const strapOptions = { start: 1.5, lengthUnits: 2.0, widthStart: 0.78, widthEnd: 0.66, thickness: 0.13, bend: 0.75, z: -0.15 };
  addLayer('strap', strap({ direction: 1, ...strapOptions }), leather, [0, 0.6, -0.95]);
  addLayer('strap', strap({ direction: -1, ...strapOptions }), leather, [0, -0.6, -0.95]);

  // --- dial ---------------------------------------------------------------
  addLayer(
    'dial',
    loft(outline, [[0, -0.03], [0.84, -0.03], [0.84, 0.0], [0, 0.0]]),
    { mode: 2, albedo: COLORS.lavender, f0: [0.04, 0.04, 0.04], rough: 0.1 },
    [0, 0, 0.35],
  );

  // --- movement -----------------------------------------------------------
  addLayer(
    'movement',
    loft(outline, [[0, -0.31], [0.8, -0.31], [0.8, -0.27], [0, -0.27]]),
    steel(COLORS.rhodium, 0.45),
    [0, 0, -0.5],
  );

  const gearSpecs = [
    { x: 0.0, y: -0.15, teeth: 28, out: 0.62, root: 0.54, rim: 0.48, hub: 0.12, spokes: 5, material: steel(COLORS.rhodium, 0.22), speed: 0.2 },
    { x: 0.52, y: 0.78, teeth: 14, out: 0.3, root: 0.24, rim: 0.2, hub: 0.07, spokes: 3, material: gold(0.2), speed: -0.4 },
    { x: -0.5, y: 0.7, teeth: 12, out: 0.27, root: 0.21, rim: 0.18, hub: 0.07, spokes: 3, material: steel(COLORS.violet, 0.25), speed: 0.47 },
    { x: 0.5, y: -0.86, teeth: 16, out: 0.34, root: 0.28, rim: 0.23, hub: 0.08, spokes: 3, material: steel(COLORS.lavender, 0.25), speed: -0.35 },
  ];
  const gears = gearSpecs.map((spec, index) => {
    const mesh = addLayer(
      'movement',
      gear({
        teeth: spec.teeth,
        outerRadius: spec.out,
        rootRadius: spec.root,
        rimRadius: spec.rim,
        hubRadius: spec.hub,
        spokes: spec.spokes,
        thickness: 0.05,
      }),
      spec.material,
      [0, 0, -0.62 + index * 0.05],
      [spec.x, spec.y, -0.23],
    );
    return { mesh, speed: spec.speed };
  });

  const balance = addLayer(
    'movement',
    merge(
      lathe([[0.2, -0.025], [0.3, -0.025], [0.3, 0.025], [0.2, 0.025]], 24, 0),
      box(0, 0, 0, 0.5, 0.03, 0.035),
      box(0, 0, 0, 0.03, 0.5, 0.035),
    ),
    gold(0.15),
    [0, 0, -0.45],
    [-0.45, -0.85, -0.2],
  );

  // --- hands --------------------------------------------------------------
  const handGroup = new Transform();
  handGroup.setParent(watch);
  handGroup.position.set(0, 0, 0.06);
  register(handGroup, 'hands', [0, 0, 0.06], [0, 0, 0.8]);

  const makeHand = (geometry: Float32Array, material: Material, z: number) => {
    const pivot = new Transform();
    pivot.setParent(handGroup);
    pivot.position.z = z;
    const mesh = new Mesh(gl, {
      geometry: new Geometry(gl, { position: { size: 3, data: geometry } }),
      program: program(material, true),
    });
    mesh.setParent(pivot);
    return pivot;
  };

  const blued = steel(COLORS.bluedSteel, 0.1);
  const hourHand = makeHand(hand(0.6, 0.07, 0.12, -0.012, 0.012), blued, 0.0);
  const minuteHand = makeHand(hand(0.96, 0.045, 0.16, -0.012, 0.012), blued, 0.03);
  const secondHand = makeHand(
    merge(
      hand(0.92, 0.012, 0.2, -0.006, 0.006),
      translateFlat(blossom(0.06, -0.006, 0.006), 0, -0.2, 0),
    ),
    steel(COLORS.roseGold, 0.18),
    0.06,
  );

  // --- sapphire crystal, drawn last ----------------------------------------
  const crystal = addLayer(
    'crystal',
    loft(outline, [[0.86, 0.0], [0.85, 0.05], [0.62, 0.078], [0.3, 0.09], [0, 0.094]]),
    { mode: 3, albedo: [1, 1, 1], f0: [0.04, 0.04, 0.04], rough: 0.02, transparent: true },
    [0, 0, 1.75],
    [0, 0, 0.04],
  );
  crystal.renderOrder = 10;

  // --- state ---------------------------------------------------------------
  const lastIndex = STATES.length - 1;
  let position = 0;
  let shownPosition = 0;
  let pointerX = 0;
  let pointerY = 0;
  let shownX = 0;
  let shownY = 0;
  let width = 1;
  let height = 1;
  let raf = 0;
  let lastTime = 0;
  let running = false;

  const fitCamera = (half: number) => {
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const aspect = width / height;
    camera.position.set(0, 0, Math.max(half / (tan * aspect), half / tan));
    camera.lookAt([0, 0, 0]);
  };

  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    width = Math.max(parent.clientWidth, 1);
    height = Math.max(parent.clientHeight, 1);
    renderer.setSize(width, height);
    camera.perspective({ aspect: width / height });
  };

  const applyPose = (t: number, dt: number) => {
    const clamped = Math.min(Math.max(Number.isFinite(shownPosition) ? shownPosition : 0, 0), lastIndex);
    const a = Math.min(Math.floor(clamped), lastIndex);
    const b = Math.min(a + 1, lastIndex);
    const u = clamped - a;
    const ease = smooth(u);
    // The jump: strongest halfway between two sections.
    const burst = Math.sin(Math.PI * u);
    const from = STATES[a];
    const to = STATES[b];

    const rotation = lerp3(from.rotation, to.rotation, ease);
    const focus = lerp3(from.focus, to.focus, ease);
    const half = lerp(from.half, to.half, ease) + 1.1 * burst;
    const explode = lerp(from.explode, to.explode, ease) + 0.9 * burst;
    // Pieces leave late in the move, once they have flown apart.
    const fade = smooth(Math.min(Math.max((u - 0.3) / 0.5, 0), 1));

    for (const layer of layers) {
      const visibleFrom = from.show[layer.group] ?? 0;
      const visibleTo = to.show[layer.group] ?? 0;
      const vis = lerp(visibleFrom, visibleTo, fade);
      const scale = vis <= 0.001 ? 0 : Math.pow(vis, 0.7);
      layer.node.visible = scale > 0.01;
      layer.node.scale.set(scale, scale, scale);
      layer.node.position.set(
        layer.base[0] + layer.offset[0] * explode,
        layer.base[1] + layer.offset[1] * explode,
        layer.base[2] + layer.offset[2] * explode,
      );
    }

    watch.position.set(-focus[0], -focus[1], -focus[2]);
    rotator.rotation.x = rotation[0] + burst * 0.15 - shownY * 0.12;
    rotator.rotation.y = rotation[1] - burst * 0.6 + shownX * 0.18;
    rotator.rotation.z = rotation[2];
    rotator.position.y = Math.sin(t * 0.0009) * 0.03;
    glassPhase.value = 0.2 + 0.4 * explode + shownX * 0.25 + Math.sin(t * 0.0004) * 0.05;
    fitCamera(half);

    // Local time, with a sweeping seconds hand.
    const now = new Date();
    const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    const tau = Math.PI * 2;
    secondHand.rotation.z = -(seconds / 60) * tau;
    minuteHand.rotation.z = -(minutes / 60) * tau;
    hourHand.rotation.z = -(hours / 12) * tau;

    const spin = 1 + 5 * burst + (a === 1 && u < 0.5 ? 1.5 : 0);
    for (const g of gears) g.mesh.rotation.z += g.speed * dt * spin;
    balance.rotation.z = Math.sin(t * 0.0126) * 0.9;
  };

  const frame = (now: number) => {
    const dt = Math.min(Math.max((now - lastTime) / 1000, 0.001), 0.05);
    lastTime = now;
    shownPosition = damp(shownPosition, position, 6, dt);
    shownX = damp(shownX, pointerX, 4, dt);
    shownY = damp(shownY, pointerY, 4, dt);
    applyPose(now, dt);
    renderer.render({ scene, camera });
    if (running) raf = requestAnimationFrame(frame);
  };

  const onPointer = (event: PointerEvent) => {
    pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
    pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
  };

  const redrawStill = () => {
    applyPose(0, 0);
    renderer.render({ scene, camera });
  };

  const setRunning = (next: boolean) => {
    if (still || next === running) return;
    running = next;
    cancelAnimationFrame(raf);
    if (running) {
      lastTime = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  resize();
  if (still) redrawStill();
  else window.addEventListener('pointermove', onPointer, { passive: true });

  return {
    setPosition: (value) => {
      position = Math.min(Math.max(value, 0), lastIndex);
      if (still) {
        shownPosition = position;
        redrawStill();
      }
    },
    setRunning,
    resize: () => {
      resize();
      if (still) redrawStill();
    },
    dispose: () => {
      setRunning(false);
      window.removeEventListener('pointermove', onPointer);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
