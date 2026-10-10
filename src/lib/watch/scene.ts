import { Camera, Geometry, Mesh, Program, Renderer, Texture, Transform } from 'ogl';
import { makeDialCanvas } from './dial';
import { box, gear, hand, lathe, merge } from './geometry';
import { loft, strap, tonneauOutline, type SmoothMesh } from './smooth';

type Rgb = readonly [number, number, number];

/** Palette, kept in step with globals.css. */
const COLORS = {
  gold: [1.0, 0.72, 0.3],
  goldBrushed: [0.92, 0.66, 0.28],
  rhodium: [0.78, 0.8, 0.88],
  lavender: [0.78, 0.8, 0.945],
  violet: [0.5, 0.2, 0.85],
  bluedSteel: [0.1, 0.14, 0.5],
  leather: [0.13, 0.035, 0.22],
  aubergine: [0.16, 0.03, 0.22],
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

/** MODE: 0 polished/brushed metal, 1 leather, 2 dial, 3 sapphire glass. */
const fragmentSource = (mode: 0 | 1 | 2 | 3, flat: boolean) => /* glsl */ `#version 300 es
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
#if MODE == 2
uniform sampler2D tDial;
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
  outColor = vec4(pow(aces(col * 0.75), vec3(1.0 / 2.2)), 1.0);
#elif MODE == 1
  float grain = hash(floor(vLocal * 90.0));
  vec3 base = uAlbedo * (0.75 + 0.4 * grain);
  vec3 col = base * (0.14 + 0.85 * key);
  col += studio(r, 0.6) * 0.07;
  col += vec3(0.55, 0.35, 0.9) * pow(1.0 - ndv, 3.0) * 0.12;
  // Stitching along both edges of the visible face.
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

export type WatchTime = {
  madridHour: number;
  madridMinute: number;
  dublinHour: number;
};

export type WatchScene = {
  setProgress: (value: number) => void;
  setTime: (time: WatchTime) => void;
  setRunning: (running: boolean) => void;
  resize: () => void;
  dispose: () => void;
};

export type WatchSceneOptions = {
  canvas: HTMLCanvasElement;
  /** Render a single still frame at `stillProgress` instead of animating. */
  still: boolean;
  stillProgress: number;
};

const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

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

export function createWatchScene({ canvas, still, stillProgress }: WatchSceneOptions): WatchScene {
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
  const watch = new Transform();
  watch.setParent(scene);

  const outline = tonneauOutline(160);

  const fontFamily =
    getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() ||
    'sans-serif';
  const dialTexture = new Texture(gl, {
    image: makeDialCanvas(outline, fontFamily),
    generateMipmaps: true,
    minFilter: gl.LINEAR_MIPMAP_LINEAR,
    magFilter: gl.LINEAR,
    anisotropy: 8,
  });

  const glassPhase = { value: 0.2 };

  type Material = { mode: 0 | 1 | 2 | 3; albedo: Rgb; f0: Rgb; rough: number; transparent?: boolean };
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
        ...(m.mode === 2 ? { tDial: { value: dialTexture } } : {}),
      },
    });

  const gold = (rough: number): Material => ({ mode: 0, albedo: COLORS.gold, f0: COLORS.gold, rough });
  const steel = (color: Rgb, rough: number): Material => ({ mode: 0, albedo: color, f0: color, rough });

  type Layer = { node: Transform; base: [number, number, number]; offset: [number, number, number] };
  const layers: Layer[] = [];

  const addLayer = (
    data: MeshData,
    material: Material,
    offset: [number, number, number],
    parent: Transform = watch,
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
    mesh.setParent(parent);
    layers.push({ node: mesh, base, offset });
    return mesh;
  };

  // --- case ---------------------------------------------------------------
  addLayer(
    loft(outline, [[0, -0.43], [0.95, -0.43], [0.985, -0.4], [0.985, -0.34], [0, -0.34]]),
    gold(0.3),
    [0, 0, -1.6],
  );

  addLayer(
    loft(
      outline,
      [[0.985, -0.34], [1.0, -0.31], [1.0, -0.03], [0.985, 0.0], [0.88, 0.0], [0.88, -0.3], [0.9, -0.34]],
      { closed: true },
    ),
    gold(0.34),
    [0, 0, -0.95],
  );

  const lugOutline = tonneauOutline(56, 0.17, 0.27, 4, 4);
  const lugProfile = [[0, -0.2], [0.9, -0.2], [1.0, -0.16], [1.0, -0.05], [0.9, -0.01], [0, -0.01]] as const;
  const lugShape = loft(lugOutline, lugProfile);
  addLayer(
    mergeSmooth(
      translate(lugShape, -0.56, 1.46, 0),
      translate(lugShape, 0.56, 1.46, 0),
      translate(lugShape, -0.56, -1.46, 0),
      translate(lugShape, 0.56, -1.46, 0),
    ),
    gold(0.2),
    [0, 0, -0.95],
  );

  // Bezel with a polished chamfer.
  addLayer(
    loft(
      outline,
      [[1.0, 0.0], [1.0, 0.05], [0.97, 0.105], [0.87, 0.117], [0.84, 0.095], [0.84, 0.0]],
      { closed: true },
    ),
    gold(0.12),
    [0, 0, 1.15],
  );

  // Crown, knurled.
  const crown = addLayer(
    lathe([[0, 0], [0.12, 0], [0.145, 0.03], [0.145, 0.2], [0.115, 0.24], [0, 0.24]], 26, 0),
    gold(0.28),
    [0.75, 0, -0.95],
    watch,
    [0.97, 0.32, -0.16],
  );
  crown.rotation.y = Math.PI / 2;

  // --- strap --------------------------------------------------------------
  const leather: Material = { mode: 1, albedo: COLORS.leather, f0: [0.04, 0.04, 0.04], rough: 0.7 };
  const strapOptions = { start: 1.5, lengthUnits: 2.0, widthStart: 0.78, widthEnd: 0.66, thickness: 0.13, bend: 0.75, z: -0.15 };
  addLayer(strap({ direction: 1, ...strapOptions }), leather, [0, 0.6, -0.95]);
  addLayer(strap({ direction: -1, ...strapOptions }), leather, [0, -0.6, -0.95]);

  // --- dial ---------------------------------------------------------------
  addLayer(
    loft(outline, [[0, -0.03], [0.84, -0.03], [0.84, 0.0], [0, 0.0]]),
    { mode: 2, albedo: COLORS.lavender, f0: [0.04, 0.04, 0.04], rough: 0.1 },
    [0, 0, 0.35],
  );

  // --- movement -----------------------------------------------------------
  addLayer(
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
      watch,
      [spec.x, spec.y, -0.23],
    );
    return { mesh, speed: spec.speed };
  });

  const balance = addLayer(
    merge(
      lathe([[0.2, -0.025], [0.3, -0.025], [0.3, 0.025], [0.2, 0.025]], 24, 0),
      box(0, 0, 0, 0.5, 0.03, 0.035),
      box(0, 0, 0, 0.03, 0.5, 0.035),
    ),
    gold(0.15),
    [0, 0, -0.45],
    watch,
    [-0.45, -0.85, -0.2],
  );

  // --- hands --------------------------------------------------------------
  const handGroup = new Transform();
  handGroup.setParent(watch);
  handGroup.position.set(0, 0, 0.06);
  layers.push({ node: handGroup, base: [0, 0, 0.06], offset: [0, 0, 0.8] });

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
  const dublinHand = makeHand(hand(0.78, 0.034, 0.1, -0.01, 0.01), gold(0.15), 0.06);

  // --- sapphire crystal, drawn last ----------------------------------------
  const crystal = addLayer(
    loft(outline, [[0.86, 0.0], [0.85, 0.05], [0.62, 0.078], [0.3, 0.09], [0, 0.094]]),
    { mode: 3, albedo: [1, 1, 1], f0: [0.04, 0.04, 0.04], rough: 0.02, transparent: true },
    [0, 0, 1.75],
    watch,
    [0, 0, 0.04],
  );
  crystal.renderOrder = 10;

  // --- state ---------------------------------------------------------------
  let progress = still ? stillProgress : 0;
  let shown = progress;
  let pointerX = 0;
  let pointerY = 0;
  let shownX = 0;
  let shownY = 0;
  let width = 1;
  let height = 1;
  let raf = 0;
  let last = 0;
  let running = false;
  let time: WatchTime = { madridHour: 10, madridMinute: 10, dublinHour: 9 };

  /** Tight on the assembled watch, pulled back as it comes apart. */
  const fitCamera = (amount: number) => {
    const e = amount * amount * (3 - 2 * amount);
    const half = 2.3 + (3.5 - 2.3) * e;
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
    fitCamera(shown);
  };

  const applyPose = (t: number, dt: number) => {
    const e = shown * shown * (3 - 2 * shown);
    for (const layer of layers) {
      layer.node.position.set(
        layer.base[0] + layer.offset[0] * e,
        layer.base[1] + layer.offset[1] * e,
        layer.base[2] + layer.offset[2] * e,
      );
    }
    fitCamera(shown);
    glassPhase.value = 0.1 + 0.45 * e + shownX * 0.25 + Math.sin(t * 0.0004) * 0.05;
    watch.rotation.y = -0.45 - 0.55 * e + shownX * 0.2;
    watch.rotation.x = 0.16 + 0.2 * e - shownY * 0.14;
    watch.rotation.z = 0.0 + 0.05 * e;
    watch.position.y = Math.sin(t * 0.0009) * 0.04;

    for (const g of gears) g.mesh.rotation.z += g.speed * dt;
    balance.rotation.z = Math.sin(t * 0.0126) * 0.9;

    const tau = Math.PI * 2;
    const minutes = time.madridMinute;
    minuteHand.rotation.z = -(minutes / 60) * tau;
    hourHand.rotation.z = -(((time.madridHour % 12) + minutes / 60) / 12) * tau;
    dublinHand.rotation.z = -(((time.dublinHour % 12) + minutes / 60) / 12) * tau;
  };

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000 || 0.016, 0.05);
    last = now;
    shown = damp(shown, progress, 5, dt);
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
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  resize();
  if (still) {
    shown = stillProgress;
    redrawStill();
  } else {
    window.addEventListener('pointermove', onPointer, { passive: true });
  }

  return {
    setProgress: (value) => {
      progress = Math.min(Math.max(value, 0), 1);
      if (still) {
        shown = progress;
        redrawStill();
      }
    },
    setTime: (next) => {
      time = next;
      if (still) redrawStill();
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
