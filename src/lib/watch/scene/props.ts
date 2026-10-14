import { Transform } from 'ogl';
import { coasterAt, coasterPath, GLOBE } from '../build';
import type { Kit, Pieces } from './kit';
import { COLORS, gold, steel } from './materials';

/**
 * The miniatures, one small object per interest, and what keeps them alive: a roller coaster with a car
 * that rides it, a cine camera with turning magazines, a bobbing invader, a globe with a circling plane
 * and a spinning record with a floating note.
 */
export function buildProps({ flatMesh, propGroup }: Kit, pieces: Pieces) {
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

  // A record player with its record turning and a music note floating above it.
  const turntableNode = propGroup('propTurntable', [-1.0, -2.1, 1.3], [0, 0, 0.3]);
  const turntableModel = new Transform();
  turntableModel.setParent(turntableNode);
  turntableModel.scale.set(0.95, 0.95, 0.95);
  // The case back is seen from behind, so the record player is turned to face the viewer.
  turntableModel.rotation.y = Math.PI;
  turntableModel.rotation.x = 0.65;
  flatMesh(pieces.deck, gold(0.14)).setParent(turntableModel);
  const recordMesh = flatMesh(pieces.record, gold(0.14));
  recordMesh.position.set(-0.08, 0.012, 0);
  recordMesh.setParent(turntableModel);
  const noteMesh = flatMesh(pieces.note, steel(COLORS.roseGold, 0.16));
  noteMesh.setParent(turntableModel);

  let invaderPhase = 0;
  let notePhase = 0;

  /**
   * Advance every miniature by `dt` seconds. Pointing at the content beside a miniature makes it
   * livelier (`excite` from 0 to 1, `boost` the matching speed-up): everything runs faster.
   */
  const animate = (dt: number, excite: number, boost: number) => {
    for (const spokes of magazineSpokes) spokes.rotation.z -= 0.7 * dt * boost;
    // The car is hauled up the lift, then runs on its own: faster the lower it is.
    const here = coasterAt(carAt);
    carAt += dt * boost * (carAt < crest.s ? 0.34 : 0.3 + 1.15 * Math.sqrt(Math.max(0, crest.y - here.y)));
    if (carAt >= route.length) carAt = 0;
    cars.forEach((mesh, index) => {
      const behind = carAt - index * 0.74;
      const place = coasterAt(behind);
      const pop = Math.max(0, Math.min(1, behind / 0.15, (route.length - behind) / 0.15));
      mesh.position.set(place.x, place.y, place.z);
      mesh.rotation.z = place.a;
      mesh.scale.set(pop, pop, pop);
    });
    // Phases are accumulated, not read from the clock, so a change of pace never makes them jump.
    invaderPhase += dt * 1.8 * boost;
    notePhase += dt * 1.6 * boost;
    invaderMesh.position.y = Math.sin(invaderPhase) * 0.05 * (1 + excite);
    invaderMesh.rotation.y = Math.sin(invaderPhase * 0.5) * 0.5 * (1 + excite);
    planePivot.rotation.y += 0.9 * dt * boost;
    ballGroup.rotation.y += 0.25 * dt * boost;
    recordMesh.rotation.y -= 1.4 * dt * boost;
    const bob = Math.sin(notePhase);
    noteMesh.position.set(-0.1 + Math.sin(notePhase * 0.56) * 0.04, 0.55 + bob * 0.05 * (1 + excite), 0);
    noteMesh.rotation.z = bob * 0.12;
  };

  return { animate };
}
