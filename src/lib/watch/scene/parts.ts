import { Transform } from 'ogl';
import { GEAR_SPECS } from '../build';
import type { Kit, Pieces } from './kit';
import { COLORS, gold, steel, type Material } from './materials';
import { tick } from './tick';

/** The case, strap, dial and movement, built a step at a time so setup never blocks the page. */
export async function buildBody({ addLayer }: Kit, pieces: Pieces) {
  // --- case ---------------------------------------------------------------
  addLayer('caseBack', pieces.caseBack, { mode: 4, albedo: COLORS.gold, f0: COLORS.gold, rough: 0.28 }, [0, 0, -1.6]);
  addLayer('caseBand', pieces.caseBand, gold(0.34), [0, 0, -0.95]);

  // End pieces: straight-sided trapezoids with rounded corners that carry the strap.
  addLayer('lugs', pieces.lugs, gold(0.2), [0, 0, -0.95]);

  // Bezel: a polished chamfer with film-sprocket notches on the flat top.
  addLayer('bezel', pieces.bezel, { ...gold(0.12), sprocket: 1 }, [0, 0, 1.15]);

  const crownMesh = addLayer('crown', pieces.crown, gold(0.28), [0, 0, -0.95], [0.97, 0.32, -0.16]);
  crownMesh.rotation.y = Math.PI / 2;

  await tick();

  // --- strap --------------------------------------------------------------
  const leather: Material = { mode: 1, albedo: COLORS.leather, f0: [0.04, 0.04, 0.04], rough: 0.7 };
  addLayer('strap', pieces.strapUp, leather, [0, 0.6, -0.95]);
  addLayer('strap', pieces.strapDown, leather, [0, -0.6, -0.95]);

  await tick();

  // --- dial ---------------------------------------------------------------
  addLayer('dial', pieces.dial, { mode: 2, albedo: COLORS.lavender, f0: [0.04, 0.04, 0.04], rough: 0.1 }, [0, 0, 0.35]);

  await tick();

  // --- movement -----------------------------------------------------------
  addLayer('movement', pieces.plate, steel(COLORS.rhodium, 0.3), [0, 0, -0.5]);

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

  return { crownMesh, gears };
}

export type Hands = { hour: Transform; minute: Transform; second: Transform };

/** The three hands, held to the movement by a gold cap. */
export function buildHands({ flatMesh, register }: Kit, pieces: Pieces, watch: Transform): Hands {
  const handGroup = new Transform();
  handGroup.setParent(watch);
  handGroup.position.set(0, 0, 0.06);
  register(handGroup, 'hands', [0, 0, 0.06], [0, 0, 0.8]);

  const makeHand = (geometry: Pieces['hourHand'], material: Material, z: number) => {
    const pivot = new Transform();
    pivot.setParent(handGroup);
    pivot.position.z = z;
    flatMesh(geometry, material).setParent(pivot);
    return pivot;
  };

  const blued = steel(COLORS.bluedSteel, 0.1);
  const hour = makeHand(pieces.hourHand, blued, 0.0);
  const minute = makeHand(pieces.minuteHand, blued, 0.03);
  const second = makeHand(pieces.secondHand, steel(COLORS.roseGold, 0.18), 0.06);

  const capMesh = flatMesh(pieces.cap, gold(0.12));
  capMesh.position.z = 0.085;
  capMesh.setParent(handGroup);

  return { hour, minute, second };
}

/** Local time, with a sweeping seconds hand. `ease` is how far into a move between sections the watch is. */
export function setHandsToTime(hands: Hands, ease: number) {
  const now = new Date();
  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;
  const tau = Math.PI * 2;
  hands.second.rotation.z = -(seconds / 60) * tau;
  // The minute and hour hands run ahead during a jump, as if time were passing.
  hands.minute.rotation.z = -(minutes / 60) * tau - tau * ease;
  hands.hour.rotation.z = -(hours / 12) * tau - (tau / 12) * ease;
}

/** The sapphire crystal, drawn last. */
export function buildCrystal({ addLayer }: Kit, pieces: Pieces) {
  const crystal = addLayer(
    'crystal',
    pieces.crystal,
    { mode: 3, albedo: [1, 1, 1], f0: [0.04, 0.04, 0.04], rough: 0.02, transparent: true },
    [0, 0, 1.75],
    [0, 0, 0.04],
  );
  crystal.renderOrder = 10;
}
