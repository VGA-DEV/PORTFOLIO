import { Geometry, Mesh, Transform, type OGLRenderingContext, type Texture } from 'ogl';
import type { Piece, loadWatchPieces } from '../build';
import { DeferredProgram } from './deferred-program';
import type { Material } from './materials';
import type { Group } from './poses';
import { fragmentSource, vertexSource } from './shaders';

type Vec = [number, number, number];

/** Every piece of geometry the worker builds. */
export type Pieces = Awaited<ReturnType<typeof loadWatchPieces>>;

/** A node that belongs to a group of parts, with where it rests and how far it flies when the watch is taken apart. */
type Layer = {
  node: Transform;
  group: Group;
  base: Vec;
  offset: Vec;
};

export type Kit = ReturnType<typeof createKit>;

/**
 * The shared means of putting things on screen: one shader program per kind of surface (and
 * flat or smooth normals) shared by every mesh, and the list of layers the pose moves about.
 * Creating the kit starts every shader compiling at once, to be awaited without blocking.
 */
export function createKit(gl: OGLRenderingContext, watch: Transform, dialTexture: Texture, backTexture: Texture) {
  const glassPhase = { value: 0.2 };
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
    // Never culled: the pieces are few and a bounding sphere that is tangent to the edge of the view (the dial, cut by
    // the top of the screen on the strap pose) must not make a piece pop in and out as the watch moves a little.
    const mesh = new Mesh(gl, { geometry, program, frustumCulled: false });
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

  const layers: Layer[] = [];
  const register = (node: Transform, group: Group, base: Vec, offset: Vec) => {
    layers.push({ node, group, base, offset });
  };

  const addLayer = (group: Group, data: Piece, material: Material, offset: Vec, base: Vec = [0, 0, 0]) => {
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

  /** A mesh of flat-shaded positions only, for the hand-built parts and the miniatures. */
  const flatMesh = (piece: Piece, material: Material) =>
    makeMesh(new Geometry(gl, { position: { size: 3, data: piece as Float32Array } }), material, true);

  /** An empty node for one miniature, registered so the pose can show, hide and spread it. */
  const propGroup = (group: Group, base: Vec, offset: Vec = [0, 0, 0]) => {
    const node = new Transform();
    node.setParent(watch);
    node.position.set(...base);
    register(node, group, base, offset);
    return node;
  };

  return { glassPhase, programs, layers, makeMesh, register, addLayer, flatMesh, propGroup };
}
