import type { CSSProperties } from 'react';

type Group = {
  id: string;
  label: string;
  items: { label: string; core: boolean }[];
  /** The group belongs to the base the profile is built on (it has a core item). */
  core: boolean;
};

/** Teeth per group. The pitch is the same for every gear, so more teeth means a bigger gear. */
const TEETH: Record<string, number> = { backend: 26, frontend: 32, architecture: 28, devops: 24 };
const DEFAULT_TEETH = 26;
/** Gear module: pitch diameter per tooth, in layout units (`u`, one rem on wide screens). */
const MODULE = 0.5;
/** Seconds each tooth takes to pass the contact point: slow enough to be a background movement. */
const SECONDS_PER_TOOTH = 2.4;
/** The chain runs down the column, leaning right and left in turn (screen angles, y down). */
const LEAN = (30 * Math.PI) / 180;
/** How far the text plate sits inside the root of the teeth: the width of the metal rim. */
const RIM = 1;

type Gear = {
  group: Group;
  teeth: number;
  r: number;
  x: number;
  y: number;
  rot: number;
  turn: 1 | -1;
};

const fixed = (value: number) => value.toFixed(3);
const polar = (radius: number, angle: number) => `${fixed(radius * Math.cos(angle))},${fixed(radius * Math.sin(angle))}`;

/** A full circle as two arcs, to be cut out of a path with the even-odd rule. */
const hole = (cx: number, cy: number, radius: number) =>
  `M${fixed(cx - radius)},${fixed(cy)}a${radius},${radius} 0 1,0 ${fixed(2 * radius)},0a${radius},${radius} 0 1,0 ${fixed(-2 * radius)},0Z`;

/**
 * The metal of a gear, centred on (0, 0): the toothed outline, with a ring of round perforations
 * cut out of the rim like a skeletonised watch. The jewel sits where the first perforation would be.
 */
function metal(teeth: number, pitch: number) {
  const root = pitch - 1.25 * MODULE;
  const tip = pitch + MODULE;
  const step = (Math.PI * 2) / teeth;
  const parts: string[] = [];
  for (let k = 0; k < teeth; k += 1) {
    const centre = k * step;
    parts.push(
      polar(root, centre - 0.3 * step),
      polar(tip, centre - 0.14 * step),
      polar(tip, centre + 0.14 * step),
      polar(root, centre + 0.3 * step),
    );
  }
  const middle = root - RIM / 2 - 0.08;
  const holes = Math.round(teeth * 0.75);
  const cuts: string[] = [];
  for (let k = 1; k < holes; k += 1) {
    const angle = -Math.PI / 2 + (k * Math.PI * 2) / holes;
    cuts.push(hole(middle * Math.cos(angle), middle * Math.sin(angle), 0.17));
  }
  return { d: `M${parts.join('L')}Z${cuts.join('')}`, root, tip, middle };
}

/**
 * The groups as gears that mesh in a chain, like the movement of a watch. Every gear has the same
 * tooth size, so their sizes follow their tooth counts, and each one is turned so its teeth fit the
 * gaps of the one before it. Then they turn for real: neighbours in opposite directions, at speeds
 * in inverse proportion to their teeth, so they stay meshed.
 */
export function StackGears({ groups, label }: { groups: Group[]; label: string }) {
  const gears: Gear[] = [];
  groups.forEach((group, i) => {
    const teeth = TEETH[group.id] ?? DEFAULT_TEETH;
    const r = (teeth * MODULE) / 2;
    if (i === 0) {
      gears.push({ group, teeth, r, x: 0, y: 0, rot: 0, turn: 1 });
      return;
    }
    const before = gears[i - 1];
    // Down and to the right, then down and to the left, and so on.
    const alpha = i % 2 === 1 ? LEAN : Math.PI - LEAN;
    const distance = before.r + r;
    // Where the contact point sits on the previous gear, measured from its tooth, decides how this
    // one must be turned so that a gap faces that tooth.
    const arc = before.r * (alpha - before.rot);
    const gap = alpha + Math.PI + arc / r;
    const rot = gap + Math.PI / teeth;
    gears.push({
      group,
      teeth,
      r,
      x: before.x + distance * Math.cos(alpha),
      y: before.y + distance * Math.sin(alpha),
      rot,
      turn: before.turn === 1 ? -1 : 1,
    });
  });

  const outer = (gear: Gear) => gear.r + MODULE;
  const left = Math.min(...gears.map((g) => g.x - outer(g)));
  const top = Math.min(...gears.map((g) => g.y - outer(g)));
  const width = Math.max(...gears.map((g) => g.x + outer(g))) - left;
  const height = Math.max(...gears.map((g) => g.y + outer(g))) - top;

  return (
    <div className='gears' role='group' aria-label={label}>
      <ul
        className='gears__board'
        style={{ ['--w' as string]: width.toFixed(2), ['--h' as string]: height.toFixed(2) } as CSSProperties}
      >
        {gears.map((gear) => {
          const size = outer(gear) * 2;
          const view = `${-outer(gear)} ${-outer(gear)} ${size} ${size}`;
          const { d, root, tip, middle } = metal(gear.teeth, gear.r);
          const plate = root - RIM;
          const from = (gear.rot * 180) / Math.PI;
          const id = `gear-${gear.group.id}`;
          const style = {
            ['--size' as string]: size.toFixed(2),
            ['--disc' as string]: plate.toFixed(2),
            ['--x' as string]: (gear.x - outer(gear) - left).toFixed(2),
            ['--y' as string]: (gear.y - outer(gear) - top).toFixed(2),
            ['--from' as string]: `${from.toFixed(2)}deg`,
            ['--to' as string]: `${(from + 360 * gear.turn).toFixed(2)}deg`,
            ['--turn-time' as string]: `${(gear.teeth * SECONDS_PER_TOOTH).toFixed(1)}s`,
          } as CSSProperties;
          return (
            <li key={gear.group.id} className={gear.group.core ? 'gear gear--core' : 'gear'} style={style}>
              <svg className='gear__layer' viewBox={view} aria-hidden='true'>
                <defs>
                  <radialGradient id={`${id}-shadow`}>
                    <stop offset='70%' className='gear__shade' stopOpacity='0.3' />
                    <stop offset='100%' className='gear__shade' stopOpacity='0' />
                  </radialGradient>
                </defs>
                <circle cx='0.05' cy='0.2' r={tip + 0.35} fill={`url(#${id}-shadow)`} />
              </svg>
              <svg className='gear__layer gear__teeth' viewBox={view} aria-hidden='true'>
                <defs>
                  <radialGradient id={`${id}-metal`} r={tip} gradientUnits='userSpaceOnUse'>
                    <stop offset='0%' className='gear__metal-in' />
                    <stop offset='62%' className='gear__metal-mid' />
                    <stop offset='100%' className='gear__metal-out' />
                  </radialGradient>
                </defs>
                <path d={d} fillRule='evenodd' fill={`url(#${id}-metal)`} className='gear__body' />
                <circle r={root - 0.1} className='gear__ticks' />
                <circle cy={-middle} r='0.3' className='gear__jewel' />
                <circle cx='-0.08' cy={-middle - 0.08} r='0.1' className='gear__jewel-glint' />
              </svg>
              <svg className='gear__layer' viewBox={view} aria-hidden='true'>
                <defs>
                  <linearGradient id={`${id}-sheen`} x1='0' y1='0' x2='1' y2='1'>
                    <stop offset='0%' stopColor='#fff' stopOpacity='0.55' />
                    <stop offset='45%' stopColor='#fff' stopOpacity='0' />
                    <stop offset='100%' stopColor='#2a0b3a' stopOpacity='0.2' />
                  </linearGradient>
                </defs>
                <circle r={root + 0.05} fill={`url(#${id}-sheen)`} />
                <circle r={plate} className='gear__plate' />
                <circle r={plate - 0.14} className='gear__plate-ring' />
              </svg>
              <div className='gear__text'>
                <h3 className='gear__title'>{gear.group.label}</h3>
                <ul className='gear__list'>
                  {gear.group.items.map((item) => (
                    <li key={item.label} className={item.core ? 'stack__core' : undefined}>
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
