import { lerp } from '../../math';

export type V3 = readonly [number, number, number];

export type Group =
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
  | 'propTurntable';

export type PoseState = {
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
  /** Extra despiece for some groups only, added to `explode` (the strap apart from an otherwise whole watch). */
  apart?: Partial<Record<Group, number>>;
  /** Extra width the wide layout must keep in view beyond `width`: a miniature that sticks out on the far side. */
  reach?: number;
};

const ALL: Partial<Record<Group, number>> = {
  crystal: 1, bezel: 1, dial: 1, hands: 1, movement: 1, caseBand: 1, caseBack: 1, lugs: 1, strap: 1, crown: 1,
};

/** The strap: the camera comes in close on it, so the case and the dial stay above, behind it. */
const STRAP: PoseState = {
  anchor: [0, -2.35, -0.3], width: 1.7, rotation: [0.5, -0.4, 0], focus: [0, -2.0, 0], half: 1.9, explode: 0.15, show: { ...ALL, propGlobe: 1 },
};

/**
 * One pose per page section: hero, projects, experience, stack, evolution (the design comparer),
 * evolution again (the numbers), contact. Between two sections the watch bursts apart, drops the pieces
 * it no longer needs and settles on the one the next section is about; between two sections that share a
 * pose (the two steps of Evolution) it stays where it is.
 */
export const STATES: readonly PoseState[] = [
  { anchor: [0, 0, 0.1], width: 2.4, rotation: [0.16, -0.45, 0], focus: [0, 0, 0], half: 2.9, explode: 0, zoom: 0.98, show: ALL },
  { anchor: [0, 0, 0.1], width: 3.4, rotation: [0.2, -0.8, 0.03], focus: [0, 0, 0], half: 2.9, explode: 0, zoom: 0.98, show: { ...ALL, propCoaster: 1 }, apart: { strap: 0.7 }, reach: 0.6 },
  { anchor: [0, 0, 0.25], width: 2.6, rotation: [0.12, -0.4, 0], focus: [0, 0, 0.25], half: 2.4, explode: 0.55, show: { ...ALL, propCamera: 1 } },
  { anchor: [0, 0.1, -0.55], width: 2.4, rotation: [0.22, -0.9, 0.04], focus: [0, 0, -0.6], half: 2.8, explode: 0.85, show: { ...ALL, propGame: 1 } },
  STRAP,
  STRAP,
  { anchor: [0, 0, -0.9], width: 3.4, rotation: [0.04, Math.PI + 0.12, 0], focus: [0, 0, -0.8], half: 2.4, explode: 0, show: { ...ALL, propTurntable: 1 } },
];

/** Half width and half height of each miniature, in scene units, for keeping notes off it. */
export const PROP_EXTENT: Partial<Record<Group, [number, number]>> = {
  propCoaster: [1.3, 0.7],
  propCamera: [0.95, 0.9],
  propGame: [0.55, 0.45],
  propGlobe: [0.6, 0.65],
  propTurntable: [0.6, 0.6],
};

/** Ease out with a small overshoot, so the miniatures spring up. */
export const popIn = (x: number) => 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2;

export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
