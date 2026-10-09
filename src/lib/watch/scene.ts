import { Camera, Geometry, Mesh, Program, Renderer, Transform } from 'ogl';
import { box, extrudeStar, gear, hand, lathe, merge } from './geometry';

/** Palette, kept in step with globals.css. */
const COLORS = {
  champagne: [0.84, 0.74, 0.54],
  champagneDeep: [0.58, 0.47, 0.3],
  lavender: [0.78, 0.8, 0.945],
  purple: [0.345, 0.07, 0.62],
  violet: [0.635, 0.114, 1],
  aubergine: [0.2, 0.016, 0.25],
  strap: [0.4, 0.17, 0.62],
} as const;

type Rgb = readonly [number, number, number];

const VERTEX = /* glsl */ `#version 300 es
in vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec3 vView;
out vec3 vLocal;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  vLocal = position;
  gl_Position = projectionMatrix * mv;
}
`;

const COMMON = /* glsl */ `#version 300 es
precision highp float;
in vec3 vView;
in vec3 vLocal;
out vec4 outColor;
const vec3 KEY = normalize(vec3(-0.45, 0.7, 0.62));
const vec3 FILL = normalize(vec3(0.7, -0.2, 0.5));
vec3 faceNormal() {
  return normalize(cross(dFdx(vView), dFdy(vView)));
}
`;

const METAL_FRAGMENT = /* glsl */ `${COMMON}
uniform vec3 uColor;
uniform float uMetal;
uniform float uRim;
void main() {
  vec3 n = faceNormal();
  vec3 v = normalize(-vView);
  float key = max(dot(n, KEY), 0.0);
  float fill = max(dot(n, FILL), 0.0);
  vec3 r = reflect(-v, n);
  float env = smoothstep(-0.25, 0.65, r.y) * 0.85 + 0.25 * smoothstep(-0.6, 0.6, r.x);
  float spec = pow(max(dot(r, KEY), 0.0), 36.0);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = uColor * (0.2 + 0.5 * key + 0.18 * fill + 0.7 * env * uMetal);
  col += vec3(1.0, 0.96, 0.88) * spec * (0.25 + 0.75 * uMetal);
  col += vec3(0.78, 0.8, 0.945) * fres * uRim;
  outColor = vec4(col, 1.0);
}
`;

const DIAL_FRAGMENT = /* glsl */ `${COMMON}
uniform vec3 uBase;
uniform vec3 uRay;
uniform vec3 uGold;
const float TAU = 6.28318530718;
float box(vec2 p, vec2 c, vec2 h) {
  vec2 d = abs(p - c) - h;
  return max(d.x, d.y);
}
vec2 sector(vec2 p, float count) {
  float a = atan(p.y, p.x) - 1.5707963;
  float k = floor(a / (TAU / count) + 0.5);
  float ang = k * (TAU / count);
  float c = cos(-ang);
  float s = sin(-ang);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}
void main() {
  // Open-heart aperture: an octagonal window onto the movement.
  vec2 q = vLocal.xy - vec2(0.0, -0.28);
  float dw = max(max(abs(q.x), abs(q.y)), (abs(q.x) + abs(q.y)) * 0.70710678);
  if (dw < 0.4) discard;
  vec2 p = vLocal.xy / 1.18;
  float d8 = max(max(abs(p.x), abs(p.y)), (abs(p.x) + abs(p.y)) * 0.70710678);
  float a = atan(p.y, p.x);
  float rays = step(0.0, sin(a * 24.0));
  vec3 col = mix(uBase, uRay, rays * smoothstep(0.1, 0.95, d8) * 0.9);
  col *= 0.78 + 0.35 * smoothstep(1.0, 0.0, d8);

  // stepped deco centre
  float steps = floor(d8 * 7.0);
  col = mix(col, uBase * 0.55, step(d8, 0.43) * mod(steps, 2.0) * 0.6);

  // fine rings
  float ring1 = smoothstep(0.012, 0.0, abs(d8 - 0.9));
  float ring2 = smoothstep(0.008, 0.0, abs(d8 - 0.8));
  float ring3 = smoothstep(0.01, 0.0, abs(d8 - 0.47));
  col = mix(col, uGold, max(max(ring1, ring2 * 0.7), ring3 * 0.8));

  // hour batons and minute ticks
  vec2 h = sector(p, 12.0);
  float baton = step(box(h, vec2(0.0, 0.68), vec2(0.028, 0.1)), 0.0);
  vec2 m = sector(p, 60.0);
  float tick = step(box(m, vec2(0.0, 0.85), vec2(0.004, 0.025)), 0.0);
  col = mix(col, uGold, max(baton, tick * 0.8));

  // aperture rim
  col = mix(col, uGold, smoothstep(0.012, 0.0, abs(dw - 0.43)) + step(dw, 0.46) * step(0.4, dw) * 0.35);

  // centre boss
  col = mix(col, uGold, step(d8, 0.045));

  // soft diagonal sheen
  float sheen = smoothstep(0.35, 0.0, abs(dot(p, vec2(0.7, 0.7)) - 0.15));
  col += 0.05 * sheen;
  outColor = vec4(col, 1.0);
}
`;

const GLASS_FRAGMENT = /* glsl */ `${COMMON}
uniform float uPhase;
void main() {
  vec3 n = faceNormal();
  vec3 v = normalize(-vView);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.0);
  float along = dot(vLocal.xy, vec2(0.8, -0.6));
  float streak = smoothstep(0.14, 0.0, abs(along - (uPhase * 2.4 - 1.2)));
  float streak2 = smoothstep(0.05, 0.0, abs(along - (uPhase * 2.4 - 1.2) + 0.28));
  float a = 0.07 + fres * 0.42 + streak * 0.34 + streak2 * 0.22;
  vec3 col = mix(vec3(0.78, 0.82, 1.0), vec3(1.0), streak);
  outColor = vec4(col * a, a);
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

  const camera = new Camera(gl, { fov: 28, near: 1, far: 40 });
  const scene = new Transform();
  const watch = new Transform();
  watch.setParent(scene);

  const metal = (color: Rgb, metalness: number, rim = 0.15) =>
    new Program(gl, {
      vertex: VERTEX,
      fragment: METAL_FRAGMENT,
      cullFace: false,
      uniforms: {
        uColor: { value: [...color] },
        uMetal: { value: metalness },
        uRim: { value: rim },
      },
    });

  const layers: { node: Transform; base: [number, number, number]; offset: [number, number, number] }[] = [];

  const addLayer = (
    position: Float32Array,
    program: Program,
    base: [number, number, number],
    offset: [number, number, number],
    parent: Transform = watch,
  ) => {
    const mesh = new Mesh(gl, {
      geometry: new Geometry(gl, { position: { size: 3, data: position } }),
      program,
    });
    mesh.position.set(...base);
    mesh.setParent(parent);
    layers.push({ node: mesh, base, offset });
    return mesh;
  };

  // Case back and its engraved ring.
  addLayer(
    merge(
      lathe([[0, -0.04], [1.42, -0.04], [1.34, -0.11], [0, -0.11]], 8),
      lathe([[0.45, -0.11], [0.92, -0.11], [0.92, -0.15], [0.45, -0.15]], 8),
    ),
    metal(COLORS.champagneDeep, 0.9),
    [0, 0, -0.34],
    [0, 0, -1.55],
  );

  // Case middle band.
  addLayer(
    lathe([[1.17, 0.0], [1.5, 0.0], [1.5, -0.36], [1.17, -0.36]], 8),
    metal(COLORS.champagne, 0.95),
    [0, 0, 0],
    [0, 0, -0.95],
  );

  // Movement: plate and gear train.
  addLayer(
    lathe([[0, 0], [1.12, 0], [1.12, -0.05], [0, -0.05]], 8),
    metal(COLORS.aubergine, 0.3, 0.2),
    [0, 0, -0.17],
    [0, 0, -0.62],
  );

  const gearSpecs = [
    { x: -0.4, y: -0.2, teeth: 22, out: 0.46, root: 0.39, rim: 0.34, hub: 0.1, spokes: 4, color: COLORS.lavender, speed: 0.22 },
    { x: 0.42, y: -0.24, teeth: 16, out: 0.34, root: 0.28, rim: 0.24, hub: 0.08, spokes: 3, color: COLORS.violet, speed: -0.36 },
    { x: 0.5, y: 0.5, teeth: 12, out: 0.28, root: 0.22, rim: 0.19, hub: 0.07, spokes: 3, color: COLORS.champagne, speed: 0.49 },
    { x: -0.55, y: 0.45, teeth: 14, out: 0.32, root: 0.26, rim: 0.22, hub: 0.08, spokes: 3, color: COLORS.purple, speed: -0.42 },
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
        thickness: 0.06,
      }),
      metal(spec.color, 0.85),
      [spec.x, spec.y, -0.1],
      [0, 0, -0.38 + index * 0.06],
    );
    return { mesh, speed: spec.speed };
  });

  // Balance wheel.
  const balance = addLayer(
    merge(
      lathe([[0.2, -0.03], [0.3, -0.03], [0.3, 0.03], [0.2, 0.03]], 20, 0),
      box(0, 0, 0, 0.5, 0.035, 0.04),
      box(0, 0, 0, 0.035, 0.5, 0.04),
    ),
    metal(COLORS.champagne, 0.95),
    [0.0, -0.28, -0.04],
    [0, 0, -0.18],
  );

  // Dial.
  addLayer(
    extrudeStar(
      Array.from({ length: 8 }, (_, i) => {
        const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
        return [Math.cos(a) * 1.18, Math.sin(a) * 1.18] as const;
      }),
      -0.025,
      0.025,
    ),
    new Program(gl, {
      vertex: VERTEX,
      fragment: DIAL_FRAGMENT,
      cullFace: false,
      uniforms: {
        uBase: { value: [...COLORS.aubergine] },
        uRay: { value: [0.36, 0.1, 0.5] },
        uGold: { value: [...COLORS.champagne] },
      },
    }),
    [0, 0, 0.0],
    [0, 0, 0.05],
  );

  // Hands: a Madrid hour/minute pair and a lavender second-time-zone hand.
  const handGroup = new Transform();
  handGroup.setParent(watch);
  layers.push({ node: handGroup, base: [0, 0, 0.06], offset: [0, 0, 0.75] });
  handGroup.position.set(0, 0, 0.06);

  const makeHand = (geometry: Float32Array, program: Program, z: number) => {
    const pivot = new Transform();
    pivot.setParent(handGroup);
    pivot.position.z = z;
    const mesh = new Mesh(gl, {
      geometry: new Geometry(gl, { position: { size: 3, data: geometry } }),
      program,
    });
    mesh.setParent(pivot);
    return pivot;
  };

  const hourHand = makeHand(hand(0.62, 0.06, 0.12, -0.012, 0.012), metal(COLORS.champagne, 0.95), 0.0);
  const minuteHand = makeHand(hand(0.98, 0.04, 0.16, -0.012, 0.012), metal(COLORS.champagne, 0.95), 0.03);
  const dublinHand = makeHand(hand(0.8, 0.032, 0.1, -0.01, 0.01), metal(COLORS.lavender, 0.8), 0.06);

  // Bezel with chamfers.
  addLayer(
    lathe(
      [[1.1, 0.0], [1.1, 0.07], [1.2, 0.17], [1.42, 0.17], [1.52, 0.08], [1.52, 0.0]],
      8,
    ),
    metal(COLORS.champagne, 0.98),
    [0, 0, 0.02],
    [0, 0, 1.15],
  );

  // Strap stubs and lugs.
  const strap = metal(COLORS.strap, 0.15, 0.9);
  addLayer(box(0, 1.95, -0.12, 0.98, 1.0, 0.16), strap, [0, 0, 0], [0, 0.55, -0.7]);
  addLayer(box(0, -1.95, -0.12, 0.98, 1.0, 0.16), strap, [0, 0, 0], [0, -0.55, -0.7]);
  const lug = merge(
    box(-0.55, 1.5, -0.1, 0.16, 0.34, 0.22),
    box(0.55, 1.5, -0.1, 0.16, 0.34, 0.22),
    box(-0.55, -1.5, -0.1, 0.16, 0.34, 0.22),
    box(0.55, -1.5, -0.1, 0.16, 0.34, 0.22),
  );
  addLayer(lug, metal(COLORS.champagne, 0.95), [0, 0, 0], [0, 0, -0.95]);

  // Crown on the right edge.
  const crown = addLayer(
    lathe([[0, 0], [0.13, 0], [0.13, 0.26], [0.1, 0.3], [0, 0.3]], 12, 0),
    metal(COLORS.champagne, 0.95),
    [1.5, 0.35, -0.16],
    [0.7, 0, -0.95],
  );
  crown.rotation.y = Math.PI / 2;

  // Sapphire crystal, drawn last.
  const glassPhase = { value: 0.2 };
  const crystal = new Mesh(gl, {
    geometry: new Geometry(gl, {
      position: {
        size: 3,
        data: lathe(
          [[0, 0.07], [0.78, 0.06], [1.12, 0.0], [1.12, -0.02], [0, -0.02]],
          8,
        ),
      },
    }),
    program: new Program(gl, {
      vertex: VERTEX,
      fragment: GLASS_FRAGMENT,
      transparent: true,
      depthWrite: false,
      cullFace: false,
      uniforms: { uPhase: glassPhase },
    }),
  });
  crystal.renderOrder = 10;
  crystal.position.set(0, 0, 0.19);
  crystal.setParent(watch);
  layers.push({ node: crystal, base: [0, 0, 0.19], offset: [0, 0, 1.75] });

  // --- state -------------------------------------------------------------
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

  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    width = Math.max(parent.clientWidth, 1);
    height = Math.max(parent.clientHeight, 1);
    renderer.setSize(width, height);
    camera.perspective({ aspect: width / height });
    fitCamera(shown);
  };

  /** Tight on the assembled watch, pulled back as it comes apart. */
  const fitCamera = (amount: number) => {
    const e = amount * amount * (3 - 2 * amount);
    const half = 1.9 + (3.05 - 1.9) * e;
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const aspect = width / height;
    camera.position.set(0, 0, Math.max(half / (tan * aspect), half / tan));
    camera.lookAt([0, 0, 0]);
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
    watch.rotation.y = -0.5 - 0.5 * e + shownX * 0.2;
    watch.rotation.x = 0.2 + 0.2 * e - shownY * 0.14;
    watch.rotation.z = 0.0 + 0.06 * e;
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
    applyPose(0, 0);
    renderer.render({ scene, camera });
  } else {
    window.addEventListener('pointermove', onPointer, { passive: true });
  }

  return {
    setProgress: (value) => {
      progress = Math.min(Math.max(value, 0), 1);
      if (still) {
        shown = progress;
        applyPose(0, 0);
        renderer.render({ scene, camera });
      }
    },
    setTime: (next) => {
      time = next;
      if (still) {
        applyPose(0, 0);
        renderer.render({ scene, camera });
      }
    },
    setRunning,
    resize: () => {
      resize();
      if (still) {
        applyPose(0, 0);
        renderer.render({ scene, camera });
      }
    },
    dispose: () => {
      setRunning(false);
      window.removeEventListener('pointermove', onPointer);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
