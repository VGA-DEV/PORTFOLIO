import { Vec3, type Camera, type Transform } from 'ogl';
import type { Group } from './poses';
import { PROP_EXTENT } from './poses';
import type { AnchorInfo } from './types';

/** The miniature most in view this frame. */
export type LeadProp = { node: Transform; group: Group; scale: number };

type AnchorTargets = {
  camera: Camera;
  /** The invisible marker moved onto the part each section talks about. */
  anchorNode: Transform;
  /** The node the whole watch turns on: its position is the middle of the watch. */
  rotator: Transform;
  crownMesh: Transform;
};

type AnchorView = {
  /** Canvas size in pixels. */
  width: number;
  height: number;
  /** How wide the watch is across the current pose, in scene units. */
  modelUnits: number;
  lead: LeadProp | null;
  position: number;
};

/**
 * Turns what the scene shows into screen pixels, so the page can tie a text callout to the highlighted
 * part, keep clear of the watch and the miniature, and put a real button over the crown.
 */
export function createAnchorProjector({ camera, anchorNode, rotator, crownMesh }: AnchorTargets) {
  const anchorPoint = new Vec3();
  const centrePoint = new Vec3();
  const crownPoint = new Vec3();
  const crownEdge = new Vec3();
  const propPoint = new Vec3();

  return ({ width, height, modelUnits, lead, position }: AnchorView): AnchorInfo => {
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
    return {
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
      position,
    };
  };
}
