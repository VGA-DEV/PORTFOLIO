/**
 * Static exploded drawing of the watch for devices that do not run the 3D scene
 * (phones, tablets, no WebGL). Four slabs on one axis: crystal, dial, movement, case.
 */

const CX = 200;
const SQUASH = 0.42;

const octagon = (cy: number, radius: number) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
    return `${(CX + Math.cos(a) * radius).toFixed(1)},${(cy - Math.sin(a) * radius * SQUASH).toFixed(1)}`;
  }).join(' ');

function Slab({
  cy,
  radius,
  depth,
  top,
  side,
  stroke,
  children,
}: {
  cy: number;
  radius: number;
  depth: number;
  top: string;
  side: string;
  stroke?: string;
  children?: React.ReactNode;
}) {
  return (
    <g>
      <polygon points={octagon(cy + depth, radius)} fill={side} />
      <polygon points={octagon(cy, radius)} fill={top} stroke={stroke} strokeWidth='1.2' />
      {children}
    </g>
  );
}

export function ExplodedArt() {
  return (
    <svg
      className='exploded'
      viewBox='0 0 400 440'
      width='400'
      height='440'
      aria-hidden='true'
      focusable='false'
    >
      <line x1={CX} y1='10' x2={CX} y2='430' stroke='#d6bd8a' strokeOpacity='0.55' strokeDasharray='3 6' />

      <Slab cy={70} radius={150} depth={5} top='#c7ccf1' side='#8e94c8' stroke='#f3f4fc'>
        <polygon points={octagon(70, 150)} fill='#c7ccf1' fillOpacity='0.3' />
        <path d={`M${CX - 90} 82L${CX - 20} 52`} stroke='#ffffff' strokeOpacity='0.7' strokeWidth='3' />
      </Slab>

      <Slab cy={150} radius={140} depth={7} top='#340440' side='#1a0225' stroke='#d6bd8a'>
        <polygon points={octagon(150, 96)} fill='none' stroke='#d6bd8a' strokeOpacity='0.7' />
        <polygon points={octagon(150, 38)} fill='#1a0225' stroke='#d6bd8a' strokeOpacity='0.8' />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={CX + Math.sin(a) * 108}
              y1={150 - Math.cos(a) * 108 * SQUASH}
              x2={CX + Math.sin(a) * 124}
              y2={150 - Math.cos(a) * 124 * SQUASH}
              stroke='#d6bd8a'
              strokeWidth='3'
            />
          );
        })}
      </Slab>

      <Slab cy={240} radius={132} depth={9} top='#2a0b40' side='#12041d'>
        <ellipse cx={CX - 44} cy='240' rx='42' ry='17' fill='none' stroke='#c7ccf1' strokeWidth='6' strokeDasharray='4 3.2' />
        <ellipse cx={CX + 52} cy='244' rx='30' ry='12' fill='none' stroke='#a21dff' strokeWidth='5' strokeDasharray='3.4 3' />
        <ellipse cx={CX + 4} cy='234' rx='22' ry='9' fill='none' stroke='#d6bd8a' strokeWidth='3' />
      </Slab>

      <Slab cy={336} radius={150} depth={18} top='#d6bd8a' side='#8f7a50' stroke='#f1e2bd'>
        <polygon points={octagon(336, 112)} fill='#6c5a38' />
        <polygon points={octagon(336, 94)} fill='#b69d68' />
      </Slab>
    </svg>
  );
}
