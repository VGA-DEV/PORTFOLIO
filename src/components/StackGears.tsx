import type { CSSProperties } from 'react';

type Group = {
  id: string;
  label: string;
  items: { label: string; core: boolean }[];
  /** The group belongs to the base the profile is built on (it has a core item). */
  core: boolean;
};

/** Teeth per group. The pitch is the same for every gear, so more teeth means a bigger gear. */
const TEETH: Record<string, number> = { backend: 26, frontend: 32, architecture: 28, devops: 22 };
const DEFAULT_TEETH = 26;
/** Gear module: pitch diameter per tooth, in layout units (`u`, one rem on wide screens). */
const MODULE = 0.5;
/** Seconds each tooth takes to pass the contact point: slow enough to be a background movement. */
const SECONDS_PER_TOOTH = 2.4;
/** The chain runs down the column, leaning right and left in turn (screen angles, y down). */
const LEAN = (30 * Math.PI) / 180;

type Gear = {
  group: Group;
  teeth: number;
  r: number;
  x: number;
  y: number;
  rot: number;
  turn: 1 | -1;
};

/** The outline of a gear with trapezoid teeth, centred on (0, 0). */
function outline(teeth: number, pitch: number) {
  const root = pitch - 1.25 * MODULE;
  const tip = pitch + MODULE;
  const step = (Math.PI * 2) / teeth;
  const point = (radius: number, angle: number) =>
    `${(radius * Math.cos(angle)).toFixed(3)},${(radius * Math.sin(angle)).toFixed(3)}`;
  const parts: string[] = [];
  for (let k = 0; k < teeth; k += 1) {
    const centre = k * step;
    parts.push(
      point(root, centre - 0.3 * step),
      point(tip, centre - 0.14 * step),
      point(tip, centre + 0.14 * step),
      point(root, centre + 0.3 * step),
    );
  }
  return `M${parts.join('L')}Z`;
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
          const from = (gear.rot * 180) / Math.PI;
          const style = {
            ['--size' as string]: size.toFixed(2),
            ['--x' as string]: (gear.x - outer(gear) - left).toFixed(2),
            ['--y' as string]: (gear.y - outer(gear) - top).toFixed(2),
            ['--from' as string]: `${from.toFixed(2)}deg`,
            ['--to' as string]: `${(from + 360 * gear.turn).toFixed(2)}deg`,
            ['--turn-time' as string]: `${(gear.teeth * SECONDS_PER_TOOTH).toFixed(1)}s`,
          } as CSSProperties;
          return (
            <li key={gear.group.id} className={gear.group.core ? 'gear gear--core' : 'gear'} style={style}>
              <svg
                className='gear__teeth'
                viewBox={`${-outer(gear)} ${-outer(gear)} ${size} ${size}`}
                aria-hidden='true'
              >
                <path d={outline(gear.teeth, gear.r)} />
                <circle r={gear.r - 1.25 * MODULE - 0.35} />
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
