import { Camera, Renderer, Texture, Transform } from 'ogl';
import { damp, lerp, smooth } from '../../math';
import { COARSE_QUERY } from '../../media';
import { loadWatchPieces, OUTLINE_POINTS } from '../build';
import { createDialCanvas, createEngravingCanvas, paintDial, paintEngraving } from '../dial';
import { tonneauOutline } from '../smooth';
import { createAnchorProjector, type LeadProp } from './anchor';
import { frameView, orbitAngles, orbitPlace, STACK_ROWS } from './framing';
import { createKit } from './kit';
import { buildBody, buildCrystal, buildHands, setHandsToTime } from './parts';
import { lerp3, popIn, STATES } from './poses';
import { buildProps } from './props';
import { tick } from './tick';
import type { WatchScene, WatchSceneOptions } from './types';

export type { AnchorInfo, WatchScene, WatchSceneOptions } from './types';

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
    dpr: Math.min(window.devicePixelRatio || 1, window.matchMedia(COARSE_QUERY).matches ? 1.25 : 1.5),
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

  // All the shaders start compiling at once, in parallel with the geometry being built.
  const kit = createKit(gl, watch, dialTexture, backTexture);
  const { programs, layers, glassPhase } = kit;

  const pieces = await piecesPromise;

  // Wait for the parallel shader compile (if the browser supports it), then read the results.
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const allCompiled = () =>
    !parallel ||
    [...programs.values()].every((p) => gl.getProgramParameter(p.program, parallel.COMPLETION_STATUS_KHR));
  while (!allCompiled()) await new Promise<void>((resolve) => setTimeout(resolve, 16));
  for (const p of programs.values()) p.finish();

  const { crownMesh, gears } = await buildBody(kit, pieces);
  const hands = buildHands(kit, pieces, watch);
  const props = buildProps(kit, pieces);

  await tick();

  buildCrystal(kit, pieces);

  await tick();

  /** An invisible marker moved onto the part each section talks about. */
  const anchorNode = new Transform();
  anchorNode.setParent(watch);
  const projectAnchor = createAnchorProjector({ camera, anchorNode, rotator, crownMesh });

  // --- state ---------------------------------------------------------------
  const lastIndex = STATES.length - 1;
  const angles = orbitAngles(sides, STATES.length);

  let position = 0;
  let shownPosition = 0;
  let positionVelocity = 0;
  let pointerX = 0;
  let pointerY = 0;
  let shownX = 0;
  let shownY = 0;
  let width = 1;
  let height = 1;
  /** The root font size in pixels: on large screens the text scales, and the content column with it. */
  let rem = 16;
  /** How lively the miniatures are: 0 at rest, 1 while the visitor points at the content beside them. */
  let exciteTarget = 0;
  let excite = 0;
  /** How wide the watch is across the current pose, in scene units. */
  let modelUnits = 2.4;
  let leadProp: LeadProp | null = null;
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

  /** Pixels at the bottom of the canvas covered by the footer: the scene is framed in the part above them. */
  let inset = 0;
  const viewHeight = () => Math.max(height - inset, 1);
  /**
   * The projection, with the scene squeezed into the top of the canvas when the footer covers the bottom.
   * The canvas itself never changes size (resizing it clears it and makes the watch flicker): the
   * vertical axis is scaled and shifted in the projection matrix instead, so everything the camera
   * projects, and the coordinates the page reads back, stay in the pixels of the full canvas.
   */
  const applyProjection = () => {
    camera.perspective({ aspect: width / viewHeight() });
    const scale = viewHeight() / height;
    if (scale < 0.9999) {
      const m = camera.projectionMatrix;
      for (let column = 0; column < 4; column += 1) {
        m[column * 4 + 1] = scale * m[column * 4 + 1] + (1 - scale) * m[column * 4 + 3];
      }
    }
  };

  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    width = Math.max(parent.clientWidth, 1);
    height = Math.max(parent.clientHeight, 1);
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    renderer.setSize(width, height);
    applyProjection();
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
    const aspect = width / viewHeight();
    const { half, centre, widest } = frameView({ from, to, ease, burst, wide, width, viewHeight: viewHeight(), rem });
    modelUnits = widest;
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
      const spread = explode + lerp(from.apart?.[layer.group] ?? 0, to.apart?.[layer.group] ?? 0, ease);
      layer.node.position.set(
        layer.base[0] + layer.offset[0] * spread,
        layer.base[1] + layer.offset[1] * spread,
        layer.base[2] + layer.offset[2] * spread,
      );
    }

    watch.position.set(-focus[0], -focus[1], -focus[2]);
    rotator.rotation.x = rotation[0] + burst * 0.15 - shownY * 0.12;
    rotator.rotation.y = rotation[1] - burst * 0.25 + shownX * 0.18;
    rotator.rotation.z = rotation[2];

    // Orbit: opposite the section's text, and round the screen between sections.
    const theta = lerp(angles[a] ?? 0, angles[b] ?? 0, ease);
    const row = lerp(STACK_ROWS[a] ?? 0.5, STACK_ROWS[b] ?? 0.5, ease);
    const place = orbitPlace({ wide, centre, half, aspect, theta, row });
    rotator.position.x = place.x;
    rotator.position.y = place.y + Math.sin(t * 0.0009) * 0.03;
    glassPhase.value = 0.2 + 0.4 * explode + shownX * 0.25 + Math.sin(t * 0.0004) * 0.05;
    fitCamera(half);
    const anchor = lerp3(from.anchor, to.anchor, ease);
    anchorNode.position.set(anchor[0], anchor[1], anchor[2]);

    setHandsToTime(hands, ease);

    excite = damp(excite, exciteTarget, 5, dt);
    props.animate(dt, excite, 1 + 2.4 * excite);

    const spin = 1 + 5 * burst + (a === 1 && u < 0.5 ? 1.5 : 0);
    for (const g of gears) g.mesh.rotation.z += g.speed * dt * spin;
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
      // Tell the page where the highlighted part is, so a text callout can be tied to it.
      onAnchor?.(projectAnchor({ width, height, modelUnits, lead: leadProp, position: shownPosition }));
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
    setExcite: (value) => {
      exciteTarget = value > 0 ? 1 : 0;
      wake();
    },
    setBottomInset: (pixels) => {
      const next = Math.min(Math.max(Math.round(pixels), 0), height * 0.4);
      if (next === inset) return;
      inset = next;
      applyProjection();
      wake();
      if (still) redrawStill();
    },
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
