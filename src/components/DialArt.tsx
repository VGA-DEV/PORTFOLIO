import { rayHit, tonneauOutline } from '@/lib/watch/smooth';

/**
 * Flat front elevation of the tonneau watch, drawn in SVG. It is the LCP element
 * and the complete visual on phones, with reduced data, or without WebGL. Hands
 * read the CSS custom properties the WatchStage keeps in sync with the real time.
 */

const CX = 200;
const CY = 280;
const UNIT = 130;

const OUTLINE = tonneauOutline(120);

const toPoints = (scale: number) =>
  OUTLINE.map(([x, y]) => `${(CX + x * scale * UNIT).toFixed(1)},${(CY - y * scale * UNIT).toFixed(1)}`).join(' ');

const at = (degrees: number, scale: number): [number, number] => {
  const [x, y] = rayHit(OUTLINE, degrees, scale);
  return [CX + x * UNIT, CY - y * UNIT];
};

const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

const RAYS = Array.from({ length: 36 }, (_, i) => {
  const a0 = (i / 36) * Math.PI * 2;
  const a1 = a0 + Math.PI / 36;
  const far = 330;
  return `${CX},${CY} ${(CX + Math.sin(a0) * far).toFixed(1)},${(CY - Math.cos(a0) * far).toFixed(1)} ${(CX + Math.sin(a1) * far).toFixed(1)},${(CY - Math.cos(a1) * far).toFixed(1)}`;
});

const MINUTES = Array.from({ length: 60 }, (_, m) => {
  const [x0, y0] = at(m * 6, 0.71);
  const [x1, y1] = at(m * 6, 0.775);
  return { m, x0, y0, x1, y1 };
});

const LUGS = [-1, 1].flatMap((sx) =>
  [-1, 1].map((sy) => ({
    key: `${sx}${sy}`,
    x: CX + sx * 0.56 * UNIT - 0.17 * UNIT,
    y: CY - sy * 1.46 * UNIT - 0.27 * UNIT,
  })),
);

export function DialArt() {
  return (
    <svg
      className='dial'
      viewBox='0 0 400 560'
      width='400'
      height='560'
      focusable='false'
      aria-hidden='true'
    >
      <defs>
        <clipPath id='dial-clip'>
          <polygon points={toPoints(0.84)} />
        </clipPath>
        <linearGradient id='gold' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0' stopColor='#f6dca0' />
          <stop offset='0.45' stopColor='#d9a444' />
          <stop offset='1' stopColor='#8a5e1a' />
        </linearGradient>
        <linearGradient id='gold-deep' x1='1' y1='0' x2='0' y2='1'>
          <stop offset='0' stopColor='#c68a2c' />
          <stop offset='1' stopColor='#6a4510' />
        </linearGradient>
        <linearGradient id='leather' x1='0' y1='0' x2='1' y2='0'>
          <stop offset='0' stopColor='#3a1060' />
          <stop offset='0.5' stopColor='#2a0b48' />
          <stop offset='1' stopColor='#1b0630' />
        </linearGradient>
        <radialGradient id='lacquer' cx='0.5' cy='0.45' r='0.7'>
          <stop offset='0' stopColor='#e8eafa' />
          <stop offset='0.6' stopColor='#cdd1f0' />
          <stop offset='1' stopColor='#a3a8d6' />
        </radialGradient>
      </defs>

      <path d='M163 0H237L231 154H169Z' fill='url(#leather)' />
      <path d='M169 406H231L237 560H163Z' fill='url(#leather)' />
      <g stroke='#d6bd8a' strokeWidth='1' strokeDasharray='4 3.5' strokeOpacity='0.8' fill='none'>
        <path d='M176 0L180 150M224 0L220 150M180 410L176 560M220 410L224 560' />
      </g>

      {LUGS.map((lug) => (
        <rect
          key={lug.key}
          x={lug.x}
          y={lug.y}
          width={0.34 * UNIT}
          height={0.54 * UNIT}
          rx='9'
          fill='url(#gold-deep)'
        />
      ))}
      <rect x={CX + 0.97 * UNIT - 2} y={CY - 0.32 * UNIT - 15} width='17' height='30' rx='4' fill='url(#gold-deep)' />

      <polygon points={toPoints(1)} fill='url(#gold-deep)' />
      <polygon points={toPoints(0.985)} fill='url(#gold)' />
      <polygon points={toPoints(0.865)} fill='#8a5e1a' />
      <polygon points={toPoints(0.84)} fill='url(#lacquer)' />

      <g clipPath='url(#dial-clip)'>
        <g fill='#ffffff' fillOpacity='0.14'>
          {RAYS.filter((_, i) => i % 2 === 0).map((points) => (
            <polygon key={points} points={points} />
          ))}
        </g>
        <g fill='#340440' fillOpacity='0.07'>
          {RAYS.filter((_, i) => i % 2 === 1).map((points) => (
            <polygon key={points} points={points} />
          ))}
        </g>
      </g>

      <g fill='none' stroke='#340440' strokeOpacity='0.85'>
        <polygon points={toPoints(0.775)} strokeWidth='1.1' />
        <polygon points={toPoints(0.71)} strokeWidth='1.1' />
        {MINUTES.map((tick) => (
          <line
            key={tick.m}
            x1={tick.x0.toFixed(1)}
            y1={tick.y0.toFixed(1)}
            x2={tick.x1.toFixed(1)}
            y2={tick.y1.toFixed(1)}
            strokeWidth={tick.m % 5 === 0 ? 2 : 0.8}
          />
        ))}
      </g>

      <g
        fill='#340440'
        textAnchor='middle'
        dominantBaseline='central'
        fontSize='25'
        fontWeight='600'
        style={{ fontFamily: 'var(--font-sans-stack)' }}
      >
        {ROMAN.map((numeral, h) => {
          const [x, y] = at(h * 30, 0.6);
          return (
            <text key={numeral} x={x.toFixed(1)} y={y.toFixed(1)}>
              {numeral}
            </text>
          );
        })}
      </g>

      <g className='dial__hand dial__hand--hour'>
        <polygon points={`${CX - 7},${CY} ${CX},${CY - 0.6 * UNIT} ${CX + 7},${CY} ${CX},${CY + 14}`} fill='#1c2278' />
      </g>
      <g className='dial__hand dial__hand--minute'>
        <polygon points={`${CX - 4.5},${CY} ${CX},${CY - 0.96 * UNIT} ${CX + 4.5},${CY} ${CX},${CY + 18}`} fill='#242c8c' />
      </g>
      <g className='dial__hand dial__hand--second'>
        <polygon points={`${CX - 1.6},${CY} ${CX},${CY - 0.92 * UNIT} ${CX + 1.6},${CY} ${CX},${CY + 24}`} fill='#e08a76' />
        <circle cx={CX} cy={CY + 26} r='7' fill='#e08a76' />
      </g>
      <circle cx={CX} cy={CY} r='5.5' fill='#d9a444' />
      <circle cx={CX} cy={CY} r='1.8' fill='#340440' />

      <polygon
        points={`${CX - 70},${CY - 170} ${CX - 25},${CY - 170} ${CX - 130},${CY + 60} ${CX - 150},${CY + 40}`}
        fill='#ffffff'
        fillOpacity='0.14'
        clipPath='url(#dial-clip)'
      />
    </svg>
  );
}
