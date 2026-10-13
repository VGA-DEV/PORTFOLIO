import { Camera, Geometry, Mesh, Program, Renderer, Texture, Transform, Vec3 } from 'ogl';
import {
  BACK_HALF_X,
  BACK_HALF_Y,
  createDialCanvas,
  createEngravingCanvas,
  DIAL_HALF_X,
  DIAL_HALF_Y,
  paintDial,
  paintEngraving,
} from './dial';
import { coasterAt, coasterPath, GEAR_SPECS, GLOBE, loadWatchPieces, OUTLINE_POINTS, type Piece } from './build';
import { tonneauOutline } from './smooth';

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
  leather: [0.085, 0.022, 0.15],
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
  vec2 uvd = vec2(vLocal.x / ${DIAL_HALF_X.toFixed(4)} * 0.5 + 0.5, vLocal.y / ${DIAL_HALF_Y.toFixed(4)} * 0.5 + 0.5);
  vec3 tex = pow(texture(tDial, uvd).rgb, vec3(2.2));
  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  vec3 col = tex * (0.34 + 0.34 * key) + studio(r, 0.1) * fres * 0.3;
  outColor = vec4(pow(aces(col), vec3(1.0 / 2.2)), 1.0);
#elif MODE == 4
  // Seen from behind, so the engraving is mirrored left to right.
  vec2 uvb = vec2(0.5 - vLocal.x / ${BACK_HALF_X.toFixed(4)} * 0.5, vLocal.y / ${BACK_HALF_Y.toFixed(4)} * 0.5 + 0.5);
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

/** Where the part being described sits on screen, and the middle of the watch. */
export type AnchorInfo = {
  x: number;
  y: number;
  centreX: number;
  /** The crown of the watch on screen, in pixels, so a real button can sit over it. */
  crown: { x: number; y: number; radius: number };
  /** Rough box of the watch case on screen, in pixels, for keeping notes clear of it. */
  model: { x: number; y: number; halfW: number; halfH: number };
  /** The miniature on show, if any, as a box in pixels: notes keep clear of it too. */
  prop: { x: number; y: number; halfW: number; halfH: number } | null;
  /** Continuous position along the page, 0 = hero. */
  position: number;
};

export type WatchScene = {
  /** Turn the crown, in radians; the visitor winds it by dragging. */
  spinCrown: (radians: number) => void;
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
  /** Black {VGA_DEV} logo painted on the dial and the case back. */
  logoUrl: string;
  /** Per section: +1 puts the watch on the right of the screen, -1 on the left. */
  sides: readonly number[];
  /** Called after every rendered frame with where the highlighted part is on screen. */
  onAnchor?: (anchor: AnchorInfo) => void;
  /**
   * Whether the page is in its two-column layout (text on one side, the watch on the other).
   * Otherwise the text fills the width and the watch is fitted to a stage measured from the screen.
   */
  isWide?: () => boolean;
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
  | 'crown'
  | 'propCoaster'
  | 'propCamera'
  | 'propGame'
  | 'propGlobe'
  | 'propPetals';

type PoseState = {
  /** Point of the highlighted part, in watch space: where the text callout is tied. */
  anchor: V3;
  /** Widest extent of what is on show, in scene units. */
  width: number;
  rotation: V3;
  focus: V3;
  /** Half the visible height, in scene units. */
  half: number;
  /** 0 assembled, 1 fully taken apart. */
  explode: number;
  /** Portrait screens: how much of the width the view spans (bigger = smaller watch). */
  zoom?: number;
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
  { anchor: [0, 0, 0.1], width: 2.4, rotation: [0.16, -0.45, 0], focus: [0, 0, 0], half: 2.9, explode: 0, zoom: 0.98, show: ALL },
  { anchor: [0, 0, 0.1], width: 3.4, rotation: [0.2, -0.8, 0.03], focus: [0, 0, 0], half: 2.9, explode: 0, zoom: 0.98, show: { ...ALL, propCoaster: 1 } },
  { anchor: [0, 0, 0.25], width: 2.6, rotation: [0.12, -0.4, 0], focus: [0, 0, 0.25], half: 2.4, explode: 0.55, show: { ...ALL, propCamera: 1 } },
  { anchor: [0, 0.1, -0.55], width: 2.4, rotation: [0.22, -0.9, 0.04], focus: [0, 0, -0.6], half: 2.8, explode: 0.85, show: { ...ALL, propGame: 1 } },
  // The strap: the camera comes in close on it, so the case and the dial stay above, behind it.
  { anchor: [0, -2.35, -0.3], width: 1.7, rotation: [0.5, -0.4, 0], focus: [0, -2.0, 0], half: 1.9, explode: 0.15, show: { ...ALL, propGlobe: 1 } },
  { anchor: [0, 0, -0.9], width: 3.4, rotation: [0.04, Math.PI + 0.12, 0], focus: [0, 0, -0.8], half: 2.4, explode: 0.3, show: { ...ALL, propPetals: 1 } },
];

const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Ease out with a small overshoot, so the miniatures spring up. */
/** Half width and half height of each miniature, in scene units, for keeping notes off it. */
const PROP_EXTENT: Partial<Record<Group, [number, number]>> = {
  propCoaster: [1.3, 0.7],
  propCamera: [0.95, 0.9],
  propGame: [0.55, 0.45],
  propGlobe: [0.6, 0.65],
  propPetals: [0.6, 0.9],
};

const popIn = (x: number) => 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2;
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/**
 * A program whose compile is started without waiting for the result, so the GPU
 * driver can compile every shader in parallel while the page stays responsive.
 * Call `finish()` once `KHR_parallel_shader_compile` reports completion.
 */
class DeferredProgram extends Program {
  override setShaders({ vertex, fragment }: { vertex?: string; fragment?: string }) {
    const gl = this.gl;
    if (vertex) {
      gl.shaderSource(this.vertexShader, vertex);
      gl.compileShader(this.vertexShader);
    }
    if (fragment) {
      gl.shaderSource(this.fragmentShader, fragment);
      gl.compileShader(this.fragmentShader);
    }
    gl.linkProgram(this.program);
  }

  /** Read back the result and look up uniform and attribute locations, as OGL does. */
  finish() {
    const gl = this.gl;
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(this.program));
      return;
    }
    const self = this as unknown as {
      uniformLocations: Map<unknown, unknown>;
      attributeLocations: Map<unknown, number>;
      attributeOrder: string;
    };
    self.uniformLocations = new Map();
    const uniformCount = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      const uniform = gl.getActiveUniform(this.program, i) as
        | (WebGLActiveInfo & { uniformName: string; nameComponents: string[] })
        | null;
      if (!uniform) continue;
      self.uniformLocations.set(uniform, gl.getUniformLocation(this.program, uniform.name));
      const split = uniform.name.match(/(\w+)/g) ?? [uniform.name];
      uniform.uniformName = split[0];
      uniform.nameComponents = split.slice(1);
    }
    self.attributeLocations = new Map();
    const order: string[] = [];
    const attributeCount = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < attributeCount; i++) {
      const attribute = gl.getActiveAttrib(this.program, i);
      if (!attribute) continue;
      const location = gl.getAttribLocation(this.program, attribute.name);
      if (location === -1) continue;
      order[location] = attribute.name;
      self.attributeLocations.set(attribute, location);
    }
    self.attributeOrder = order.join('');
  }
}

/** Let the browser breathe between heavy steps, so setup never blocks scrolling or input. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function createWatchScene({
  canvas,
  still,
  logoUrl,
  sides,
  isWide,
  onAnchor,
}: WatchSceneOptions): Promise<WatchScene> {
  // Geometry is built in a worker while the renderer and textures are set up here.
  const piecesPromise = loadWatchPieces();

  const renderer = new Renderer({
    canvas,
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    dpr: Math.min(window.devicePixelRatio || 1, window.matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5),
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

  const outline = tonneauOutline(OUTLINE_POINTS);

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
  const dialCanvas = createDialCanvas();
  const backCanvas = createEngravingCanvas();
  paintDial(dialCanvas, outline, fontFamily, null);
  paintEngraving(backCanvas, outline, null);
  const dialTexture = texture(dialCanvas);
  const backTexture = texture(backCanvas);

  // The logo arrives after the first frame: repaint both textures once it has loaded.
  const logo = new Image();
  logo.onload = () => {
    paintDial(dialCanvas, outline, fontFamily, logo);
    paintEngraving(backCanvas, outline, logo);
    dialTexture.needsUpdate = true;
    backTexture.needsUpdate = true;
    if (still) redrawStill();
  };
  logo.src = logoUrl;

  const glassPhase = { value: 0.2 };

  type Material = {
    mode: 0 | 1 | 2 | 3 | 4;
    albedo: Rgb;
    f0: Rgb;
    rough: number;
    transparent?: boolean;
    sprocket?: number;
  };
  // One program per kind of surface (and flat or smooth normals), shared by every
  // mesh. All of them start compiling at once and are awaited without blocking.
  const programs = new Map<string, DeferredProgram>();
  const programFor = (mode: Material['mode'], flat: boolean) => {
    const key = `${mode}:${flat}`;
    let created = programs.get(key);
    if (!created) {
      created = new DeferredProgram(gl, {
        vertex: vertexSource(flat),
        fragment: fragmentSource(mode, flat),
        cullFace: false,
        transparent: mode === 3,
        depthWrite: mode !== 3,
        uniforms: {
          uAlbedo: { value: [0, 0, 0] },
          uF0: { value: [0, 0, 0] },
          uRough: { value: 0 },
          uPhase: glassPhase,
          uSprocket: { value: 0 },
          ...(mode === 2 ? { tDial: { value: dialTexture } } : {}),
          ...(mode === 4 ? { tBack: { value: backTexture } } : {}),
        },
      });
      programs.set(key, created);
    }
    return created;
  };
  for (const [mode, flat] of [[0, false], [0, true], [1, false], [2, false], [3, false], [4, false]] as const) {
    programFor(mode, flat);
  }

  /** A mesh sets its own colour and finish just before it is drawn. */
  const makeMesh = (geometry: Geometry, m: Material, flat: boolean) => {
    const program = programFor(m.mode, flat);
    const mesh = new Mesh(gl, { geometry, program });
    const albedo = [...m.albedo];
    const f0 = [...m.f0];
    const uniforms = program.uniforms as Record<string, { value: unknown }>;
    mesh.onBeforeRender(() => {
      uniforms.uAlbedo.value = albedo;
      uniforms.uF0.value = f0;
      uniforms.uRough.value = m.rough;
      uniforms.uSprocket.value = m.sprocket ?? 0;
    });
    return mesh;
  };

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
    data: Piece,
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
    const mesh = makeMesh(new Geometry(gl, attributes), material, flat);
    mesh.position.set(...base);
    mesh.setParent(watch);
    register(mesh, group, base, offset);
    return mesh;
  };

  const pieces = await piecesPromise;

  // Wait for the parallel shader compile (if the browser supports it), then read the results.
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const allCompiled = () =>
    !parallel ||
    [...programs.values()].every((p) => gl.getProgramParameter(p.program, parallel.COMPLETION_STATUS_KHR));
  while (!allCompiled()) await new Promise<void>((resolve) => setTimeout(resolve, 16));
  for (const p of programs.values()) p.finish();

  // --- case ---------------------------------------------------------------
  addLayer(
    'caseBack',
    pieces.caseBack,
    { mode: 4, albedo: COLORS.gold, f0: COLORS.gold, rough: 0.28 },
    [0, 0, -1.6],
  );

  addLayer(
    'caseBand',
    pieces.caseBand,
    gold(0.34),
    [0, 0, -0.95],
  );

  // End pieces: straight-sided trapezoids with rounded corners that carry the strap.
  addLayer('lugs', pieces.lugs, gold(0.2), [0, 0, -0.95]);

  // Bezel: a polished chamfer with film-sprocket notches on the flat top.
  addLayer(
    'bezel',
    pieces.bezel,
    { ...gold(0.12), sprocket: 1 },
    [0, 0, 1.15],
  );

  const crownMesh = addLayer(
    'crown',
    pieces.crown,
    gold(0.28),
    [0, 0, -0.95],
    [0.97, 0.32, -0.16],
  );
  crownMesh.rotation.y = Math.PI / 2;

  await tick();

  // --- strap --------------------------------------------------------------
  const leather: Material = { mode: 1, albedo: COLORS.leather, f0: [0.04, 0.04, 0.04], rough: 0.7 };
  addLayer('strap', pieces.strapUp, leather, [0, 0.6, -0.95]);
  addLayer('strap', pieces.strapDown, leather, [0, -0.6, -0.95]);

  await tick();

  // --- dial ---------------------------------------------------------------
  addLayer(
    'dial',
    pieces.dial,
    { mode: 2, albedo: COLORS.lavender, f0: [0.04, 0.04, 0.04], rough: 0.1 },
    [0, 0, 0.35],
  );

  await tick();

  // --- movement -----------------------------------------------------------
  addLayer(
    'movement',
    pieces.plate,
    steel(COLORS.rhodium, 0.3),
    [0, 0, -0.5],
  );

  // Three meshing gears in a V: two on top, the larger one at the point.
  const gearMaterials = [steel(COLORS.violet, 0.25), steel(COLORS.lavender, 0.25), gold(0.2)];
  const gearSpeeds = [0.5, 0.5, -0.39];
  const gears = GEAR_SPECS.map((spec, index) => {
    const mesh = addLayer(
      'movement',
      pieces.gears[index],
      gearMaterials[index],
      [0, 0, -0.3 + index * 0.04],
      [spec.x, spec.y, -0.23],
    );
    return { mesh, speed: gearSpeeds[index] };
  });

  await tick();

  // --- hands --------------------------------------------------------------
  const handGroup = new Transform();
  handGroup.setParent(watch);
  handGroup.position.set(0, 0, 0.06);
  register(handGroup, 'hands', [0, 0, 0.06], [0, 0, 0.8]);

  const makeHand = (geometry: Piece, material: Material, z: number) => {
    const pivot = new Transform();
    pivot.setParent(handGroup);
    pivot.position.z = z;
    const mesh = makeMesh(
      new Geometry(gl, { position: { size: 3, data: geometry as Float32Array } }),
      material,
      true,
    );
    mesh.setParent(pivot);
    return pivot;
  };

  const blued = steel(COLORS.bluedSteel, 0.1);
  const hourHand = makeHand(pieces.hourHand, blued, 0.0);
  const minuteHand = makeHand(pieces.minuteHand, blued, 0.03);
  const secondHand = makeHand(pieces.secondHand, steel(COLORS.roseGold, 0.18), 0.06);

  // A gold cap holds the three hands to the movement.
  const capMesh = makeMesh(
    new Geometry(gl, { position: { size: 3, data: pieces.cap as Float32Array } }),
    gold(0.12),
    true,
  );
  capMesh.position.z = 0.085;
  capMesh.setParent(handGroup);

  // --- miniatures: one small object per interest -----------------------------
  const flatMesh = (piece: Piece, material: Material) =>
    makeMesh(new Geometry(gl, { position: { size: 3, data: piece as Float32Array } }), material, true);
  const propGroup = (group: Group, base: [number, number, number], offset: [number, number, number] = [0, 0, 0]) => {
    const node = new Transform();
    node.setParent(watch);
    node.position.set(...base);
    register(node, group, base, offset);
    return node;
  };

  // A roller coaster beside the watch, with a little car that rides it all the way round.
  const coasterNode = propGroup('propCoaster', [-2.55, 0.85, 0.3]);
  coasterNode.rotation.y = 0.8;
  // The track runs towards the viewer, turned a little to the left.
  const coasterLine = new Transform();
  coasterLine.setParent(coasterNode);
  coasterLine.scale.set(1.05, 1.05, 1.05);
  coasterLine.rotation.y = -Math.PI / 2 - 0.8;
  const coasterTrack = new Transform();
  coasterTrack.setParent(coasterLine);
  coasterTrack.position.set(0, -0.3, 0);
  flatMesh(pieces.rails, gold(0.12)).setParent(coasterTrack);
  // A train of two cars, the second one behind the first.
  // Each car is a body in brass and its fittings in a coppery tone, moved as one.
  const cars = [0, 1].map(() => {
    const node = new Transform();
    node.setParent(coasterTrack);
    flatMesh(pieces.car, gold(0.12)).setParent(node);
    flatMesh(pieces.carTrim, steel(COLORS.roseGold, 0.16)).setParent(node);
    return node;
  });
  const route = coasterPath();
  const crest = route.points.filter((p) => p.x < 0).reduce((top, p) => (p.y > top.y ? p : top));
  let carAt = 0;

  // A cine camera on a tripod, to the right of the watch and pointing back at it.
  const cameraNode = propGroup('propCamera', [1.4, -0.7, 0.4], [0, 0, 0.3]);
  const cameraModel = new Transform();
  cameraModel.setParent(cameraNode);
  cameraModel.scale.set(-0.5, 0.5, 0.5);
  flatMesh(pieces.cam, gold(0.14)).setParent(cameraModel);
  // The two magazines turn slowly, as if the film were running.
  const magazineSpokes = [
    [-0.2, 0.34, -0.012],
    [0.0, 0.32, 0.028],
  ].map(([x, y, z]) => {
    const mesh = flatMesh(pieces.camSpokes, gold(0.14));
    mesh.position.set(x, y, z);
    mesh.setParent(cameraModel);
    return mesh;
  });

  // A pixel space-invader floats among the loose parts.
  const gameNode = propGroup('propGame', [-1.25, 1.1, 0.1]);
  const invaderMesh = flatMesh(pieces.invader, gold(0.18));
  invaderMesh.setParent(gameNode);
  invaderMesh.scale.set(1.7, 1.7, 1.7);

  // An antique desk globe on a stand, with a propeller plane flying round it on a dotted path.
  const globeNode = propGroup('propGlobe', [-1.5, -2.55, 0.45], [0, 0, 0.3]);
  const globeModel = new Transform();
  globeModel.setParent(globeNode);
  globeModel.scale.set(0.8, 0.8, 0.8);
  flatMesh(pieces.globeStand, gold(0.14)).setParent(globeModel);
  const globeTilt = new Transform();
  globeTilt.setParent(globeModel);
  globeTilt.rotation.z = 0.41;
  const ballGroup = new Transform();
  ballGroup.setParent(globeTilt);
  flatMesh(pieces.globeBall, gold(0.14)).setParent(ballGroup);
  flatMesh(pieces.globeGrid, steel(COLORS.roseGold, 0.16)).setParent(ballGroup);
  const orbitTilt = new Transform();
  orbitTilt.setParent(globeModel);
  orbitTilt.rotation.x = 0.35;
  flatMesh(pieces.planeTrail, steel(COLORS.roseGold, 0.16)).setParent(orbitTilt);
  const planePivot = new Transform();
  planePivot.setParent(orbitTilt);
  const planeMesh = flatMesh(pieces.plane, steel(COLORS.roseGold, 0.16));
  planeMesh.position.set(GLOBE.orbit, 0, 0);
  planeMesh.rotation.y = Math.PI / 2;
  planeMesh.rotation.x = 0.25;
  planeMesh.setParent(planePivot);

  // Blossom petals drift down past the crown.
  const petalsNode = propGroup('propPetals', [1.05, 0.3, 0.1]);
  const petals = Array.from({ length: 9 }, (_, i) => {
    const mesh = flatMesh(pieces.petal, steel(COLORS.roseGold, 0.25));
    mesh.setParent(petalsNode);
    return { mesh, phase: i / 9, x: Math.cos(i * 2.4) * 0.55, z: Math.sin(i * 1.7) * 0.6, spin: 0.6 + (i % 3) * 0.4 };
  });

  await tick();

  // --- sapphire crystal, drawn last ----------------------------------------
  const crystal = addLayer(
    'crystal',
    pieces.crystal,
    { mode: 3, albedo: [1, 1, 1], f0: [0.04, 0.04, 0.04], rough: 0.02, transparent: true },
    [0, 0, 1.75],
    [0, 0, 0.04],
  );
  crystal.renderOrder = 10;

  await tick();

  /** An invisible marker moved onto the part each section talks about. */
  const anchorNode = new Transform();
  anchorNode.setParent(watch);

  // --- state ---------------------------------------------------------------
  const lastIndex = STATES.length - 1;

  // The watch travels round the screen like the tip of a clock hand: each change of
  // side is half a turn clockwise (through the bottom, then through the top).
  const angles: number[] = [];
  for (let i = 0; i <= lastIndex; i++) {
    const side = sides[i] ?? 1;
    if (i === 0) angles.push(side > 0 ? 0 : Math.PI);
    else angles.push(angles[i - 1] - ((sides[i - 1] ?? 1) === side ? 0 : Math.PI));
  }
  // Portrait screens: vertical place of the watch per section, from the top (0) to the bottom (1).
  /** One column: the height of the watch's centre, as a fraction of the screen, in each section. */
  const stackRows = [0.72, 0.5, 0.5, 0.48, 0.5, 0.5];
  let position = 0;
  let shownPosition = 0;
  let positionVelocity = 0;
  let pointerX = 0;
  let pointerY = 0;
  let shownX = 0;
  let shownY = 0;
  let width = 1;
  let height = 1;
  /** How wide the watch is across the current pose, in scene units. */
  let modelUnits = 2.4;
  /** The miniature that is most in view this frame. */
  let leadProp: { node: Transform; group: Group; scale: number } | null = null;
  let raf = 0;
  let lastTime = 0;
  let running = false;

  /** `half` is always half the height in view, in scene units. */
  const fitCamera = (half: number) => {
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    camera.position.set(0, 0, half / tan);
    camera.lookAt([0, 0, 0]);
  };

  // Frame rate cap on phones, to spare the battery.
  // Full rate while anything moves; half rate while the scene only ticks the seconds hand.
  let lastRender = 0;
  let activeUntil = 0;
  const wake = () => {
    activeUntil = performance.now() + 1500;
  };
  // If the device cannot keep up, trade resolution for smoothness instead of frames.
  let frameAverage = 16;
  let slowFrames = 0;

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
    const wide = isWide ? isWide() : width >= 992;
    const aspect = width / height;
    const widest = lerp(from.width, to.width, ease);
    modelUnits = widest;
    let half: number;
    let centre = 0.27;
    if (wide) {
      // Two columns: the content column is a fixed 36rem, so on narrower windows the strip left
      // for the watch shrinks. Centre the watch in that strip and zoom out if the model would
      // still not fit it.
      const container = Math.min(1120, width - 32);
      const strip = Math.min(Math.max(((width + container) / 2 - 576) / width, 0.34), 0.5);
      centre = Math.min(Math.max(strip / 2, 0.17), 0.27);
      const halfShare = Math.max(strip / 2 - 0.03, 0.12);
      const fitHalf = Math.max(widest / (0.8 * aspect), widest / (4 * halfShare * aspect));
      half = Math.max(lerp(from.half, to.half, ease), fitHalf) + 1.1 * burst;
    } else {
      // One column: a stage measured from the screen itself, the same rule on every device. The
      // watch is never wider than 75% of the width nor taller than 36% of the height.
      const unit = Math.min((0.75 * width) / widest, (0.36 * height) / 2.8);
      half = height / (2 * unit) + 1.1 * burst;
    }
    const explode = lerp(from.explode, to.explode, ease) + 0.9 * burst;
    // Pieces leave late in the move, once they have flown apart.
    const fade = smooth(Math.min(Math.max((u - 0.3) / 0.5, 0), 1));

    leadProp = null;
    for (const layer of layers) {
      const visibleFrom = from.show[layer.group] ?? 0;
      const visibleTo = to.show[layer.group] ?? 0;
      const vis = lerp(visibleFrom, visibleTo, fade);
      const isProp = layer.group.startsWith('prop');
      // The miniatures need room to be read: they only show beside the content, not behind it.
      const scale = vis <= 0.001 || (isProp && !wide) ? 0 : isProp ? popIn(vis) : Math.pow(vis, 0.7);
      layer.node.visible = scale > 0.01;
      if (isProp && scale > 0.4 && (!leadProp || scale > leadProp.scale)) leadProp = { node: layer.node, group: layer.group, scale };
      layer.node.scale.set(scale, scale, scale);
      layer.node.position.set(
        layer.base[0] + layer.offset[0] * explode,
        layer.base[1] + layer.offset[1] * explode,
        layer.base[2] + layer.offset[2] * explode,
      );
    }

    watch.position.set(-focus[0], -focus[1], -focus[2]);
    rotator.rotation.x = rotation[0] + burst * 0.15 - shownY * 0.12;
    rotator.rotation.y = rotation[1] - burst * 0.25 + shownX * 0.18;
    rotator.rotation.z = rotation[2];

    // Orbit: opposite the section's text, and round the screen between sections.
    const theta = lerp(angles[a] ?? 0, angles[b] ?? 0, ease);
    const viewW = half * aspect;
    const viewH = half;
    const rx = (wide ? 1 - 2 * centre : 0.1) * viewW;
    const ry = (wide ? 0.55 : 0.06) * viewH;
    const row = lerp(stackRows[a] ?? 0.5, stackRows[b] ?? 0.5, ease);
    const baseY = wide ? 0 : (0.5 - row) * 2 * viewH;
    rotator.position.x = rx * Math.cos(theta);
    rotator.position.y = baseY + ry * Math.sin(theta) + Math.sin(t * 0.0009) * 0.03;
    glassPhase.value = 0.2 + 0.4 * explode + shownX * 0.25 + Math.sin(t * 0.0004) * 0.05;
    fitCamera(half);
    const anchor = lerp3(from.anchor, to.anchor, ease);
    anchorNode.position.set(anchor[0], anchor[1], anchor[2]);

    // Local time, with a sweeping seconds hand.
    const now = new Date();
    const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    const tau = Math.PI * 2;
    secondHand.rotation.z = -(seconds / 60) * tau;
    // The minute and hour hands run ahead during a jump, as if time were passing.
    minuteHand.rotation.z = -(minutes / 60) * tau - tau * ease;
    hourHand.rotation.z = -(hours / 12) * tau - (tau / 12) * ease;

    // The miniatures are alive: a cine camera with turning magazines, a bobbing invader, a circling plane, falling petals.
    for (const spokes of magazineSpokes) spokes.rotation.z -= 0.7 * dt;
    // The car is hauled up the lift, then runs on its own: faster the lower it is.
    const here = coasterAt(carAt);
    carAt += dt * (carAt < crest.s ? 0.34 : 0.3 + 1.15 * Math.sqrt(Math.max(0, crest.y - here.y)));
    if (carAt >= route.length) carAt = 0;
    cars.forEach((mesh, index) => {
      const behind = carAt - index * 0.74;
      const place = coasterAt(behind);
      const pop = Math.max(0, Math.min(1, behind / 0.15, (route.length - behind) / 0.15));
      mesh.position.set(place.x, place.y, place.z);
      mesh.rotation.z = place.a;
      mesh.scale.set(pop, pop, pop);
    });
    invaderMesh.position.y = Math.sin(t * 0.0018) * 0.05;
    invaderMesh.rotation.y = Math.sin(t * 0.0009) * 0.5;
    planePivot.rotation.y += 0.9 * dt;
    ballGroup.rotation.y += 0.25 * dt;
    for (const petal of petals) {
      const fall = (t * 0.00008 * petal.spin + petal.phase) % 1;
      petal.mesh.position.set(petal.x, 0.9 - fall * 1.8, petal.z);
      petal.mesh.rotation.set(t * 0.001 * petal.spin, t * 0.0013, fall * 6);
    }

    const spin = 1 + 5 * burst + (a === 1 && u < 0.5 ? 1.5 : 0);
    for (const g of gears) g.mesh.rotation.z += g.speed * dt * spin;
  };

  const anchorPoint = new Vec3();
  const centrePoint = new Vec3();
  const crownPoint = new Vec3();
  const crownEdge = new Vec3();
  const propPoint = new Vec3();
  /** Tell the page where the highlighted part is, so a text callout can be tied to it. */
  const reportAnchor = () => {
    if (!onAnchor) return;
    const m = anchorNode.worldMatrix;
    anchorPoint.set(m[12], m[13], m[14]);
    camera.project(anchorPoint);
    const r = rotator.worldMatrix;
    centrePoint.set(r[12], r[13], r[14]);
    camera.project(centrePoint);
    const c = crownMesh.worldMatrix;
    crownPoint.set(c[12], c[13], c[14]);
    // A point 0.22 units to the side of the crown tells how big it looks on screen.
    const side = camera.worldMatrix;
    crownEdge.set(c[12] + side[0] * 0.22, c[13] + side[1] * 0.22, c[14] + side[2] * 0.22);
    camera.project(crownPoint);
    camera.project(crownEdge);
    const crownRadius = Math.hypot(
      (crownEdge.x - crownPoint.x) * 0.5 * width,
      (crownEdge.y - crownPoint.y) * 0.5 * height,
    );
    const pxPerUnit = Math.max(crownRadius / 0.22, 1);
    let prop: AnchorInfo['prop'] = null;
    const lead = leadProp as { node: Transform; group: Group; scale: number } | null;
    const extent = lead ? PROP_EXTENT[lead.group] : undefined;
    if (lead && extent) {
      const pm = lead.node.worldMatrix;
      propPoint.set(pm[12], pm[13], pm[14]);
      camera.project(propPoint);
      prop = {
        x: (propPoint.x * 0.5 + 0.5) * width,
        y: (1 - (propPoint.y * 0.5 + 0.5)) * height,
        halfW: extent[0] * pxPerUnit * Math.min(lead.scale, 1),
        halfH: extent[1] * pxPerUnit * Math.min(lead.scale, 1),
      };
    }
    onAnchor({
      prop,
      model: {
        x: (centrePoint.x * 0.5 + 0.5) * width,
        y: (1 - (centrePoint.y * 0.5 + 0.5)) * height,
        halfW: (modelUnits / 2) * pxPerUnit,
        halfH: 1.4 * pxPerUnit,
      },
      crown: {
        x: (crownPoint.x * 0.5 + 0.5) * width,
        y: (1 - (crownPoint.y * 0.5 + 0.5)) * height,
        radius: Math.max(crownRadius, 24),
      },
      x: (anchorPoint.x * 0.5 + 0.5) * width,
      y: (1 - (anchorPoint.y * 0.5 + 0.5)) * height,
      centreX: (centrePoint.x * 0.5 + 0.5) * width,
      position: shownPosition,
    });
  };

  const frame = (now: number) => {
    const dt = Math.min(Math.max((now - lastTime) / 1000, 0.001), 0.25);
    lastTime = now;
    // A critically damped spring: the move starts gently, glides and settles without overshoot.
    const omega = 4.2;
    for (let left = dt; left > 0; left -= 1 / 120) {
      const h = Math.min(left, 1 / 120);
      positionVelocity += (omega * omega * (position - shownPosition) - 2 * omega * positionVelocity) * h;
      shownPosition += positionVelocity * h;
    }
    shownX = damp(shownX, pointerX, 4, dt);
    shownY = damp(shownY, pointerY, 4, dt);
    if (Math.abs(shownPosition - position) > 0.002 || Math.abs(positionVelocity) > 0.002) wake();
    const idle = now > activeUntil;
    if (now - lastRender >= (idle ? 33 : 0)) {
      const frameMs = now - lastRender;
      lastRender = now;
      // The animations advance by the time since the last drawing, not since the last screen
      // tick: when idle, ticks are skipped to save power and must not slow them down.
      applyPose(now, Math.min(Math.max(frameMs / 1000, 0.001), 0.25));
      renderer.render({ scene, camera });
      reportAnchor();
      if (!idle) {
        frameAverage = frameAverage * 0.9 + Math.min(frameMs, 100) * 0.1;
        slowFrames = frameAverage > 26 ? slowFrames + 1 : 0;
        if (slowFrames > 40 && renderer.dpr > 0.75) {
          renderer.dpr = Math.max(0.75, renderer.dpr - 0.25);
          resize();
          slowFrames = 0;
          frameAverage = 16;
        }
      }
    }
    if (running) raf = requestAnimationFrame(frame);
  };

  const onPointer = (event: PointerEvent) => {
    wake();
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
  fitCamera(3);

  // Compile the shaders a few at a time, so no single task is long.
  for (const group of new Set(layers.map((layer) => layer.group))) {
    for (const layer of layers) layer.node.visible = layer.group === group;
    renderer.render({ scene, camera });
    await tick();
  }
  for (const layer of layers) layer.node.visible = true;

  if (still) redrawStill();
  else window.addEventListener('pointermove', onPointer, { passive: true });

  return {
    setPosition: (value) => {
      position = Math.min(Math.max(value, 0), lastIndex);
      wake();
      if (still) {
        shownPosition = position;
        positionVelocity = 0;
        redrawStill();
      }
    },
    spinCrown: (radians) => {
      crownMesh.rotation.z += radians;
      wake();
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
