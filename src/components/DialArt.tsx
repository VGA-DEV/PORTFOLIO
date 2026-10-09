/**
 * Flat front elevation of the watch, drawn in SVG. It is the LCP element and the
 * complete visual on phones, with reduced data, or without WebGL. Hands read the
 * CSS custom properties the WatchStage keeps in sync with the real time.
 */

const CX = 200;
const CY = 260;
const SCALE = 111.8;
/** The shader measures rings by apothem; SVG polygons by circumradius. */
const K = 1 / Math.cos(Math.PI / 8);

const octagon = (radius: number, cx = CX, cy = CY) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
    return `${(cx + Math.cos(a) * radius).toFixed(2)},${(cy - Math.sin(a) * radius).toFixed(2)}`;
  }).join(' ');

const polar = (radius: number, angle: number) => ({
  x: CX + Math.sin(angle) * radius,
  y: CY - Math.cos(angle) * radius,
});

const RAYS = Array.from({ length: 12 }, (_, i) => {
  const a0 = (i / 12) * Math.PI * 2;
  const a1 = a0 + Math.PI / 12;
  const p0 = polar(190, a0);
  const p1 = polar(190, a1);
  return `${CX},${CY} ${p0.x.toFixed(2)},${p0.y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
});

const MINUTE_TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2;
  const outer = polar(0.9 * 1.18 * SCALE, a);
  const inner = polar(0.8 * 1.18 * SCALE, a);
  return { id: i, x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, hour: i % 5 === 0 };
});

const hourBatons = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  rotate: i * 30,
}));

export function DialArt() {
  const dial = 1.18 * SCALE;
  return (
    <svg
      className='dial'
      viewBox='0 0 400 520'
      width='400'
      height='520'
      focusable='false'
      aria-hidden='true'
    >
      <defs>
        <clipPath id='dial-clip'>
          <polygon points={octagon(dial)} />
        </clipPath>
        <linearGradient id='dial-gold' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0' stopColor='#f1e2bd' />
          <stop offset='0.5' stopColor='#d6bd8a' />
          <stop offset='1' stopColor='#8f7a50' />
        </linearGradient>
        <linearGradient id='dial-gold-deep' x1='1' y1='0' x2='0' y2='1'>
          <stop offset='0' stopColor='#b69d68' />
          <stop offset='1' stopColor='#6c5a38' />
        </linearGradient>
      </defs>

      <rect x={CX - 55} y='0' width='110' height='112' fill='#2c0d4c' />
      <rect x={CX - 55} y='408' width='110' height='112' fill='#2c0d4c' />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => (
          <rect
            key={`${sx}${sy}`}
            x={CX + sx * 61 - 9}
            y={CY + sy * 168 - 19}
            width='18'
            height='38'
            fill='url(#dial-gold-deep)'
          />
        )),
      )}
      <rect x={CX + 1.5 * SCALE - 4} y={CY - 0.35 * SCALE - 15} width='18' height='30' fill='url(#dial-gold-deep)' />

      <polygon points={octagon(1.5 * SCALE)} fill='url(#dial-gold-deep)' />
      <polygon points={octagon(1.52 * SCALE - 2)} fill='url(#dial-gold)' />
      <polygon points={octagon(1.22 * SCALE)} fill='#d6bd8a' />
      <polygon points={octagon(1.1 * SCALE)} fill='#340440' />

      <g clipPath='url(#dial-clip)'>
        <rect x='0' y='0' width='400' height='520' fill='#340440' />
        <g fill='#5c1a80' fillOpacity='0.85'>
          {RAYS.map((points) => (
            <polygon key={points} points={points} />
          ))}
        </g>
        <polygon points={octagon(0.43 * dial * K)} fill='#1a0225' fillOpacity='0.7' />
      </g>

      <g>
        <polygon points={octagon(0.4 * SCALE * K, CX, CY + 0.28 * SCALE)} fill='#1a0225' />
        <circle cx={CX - 0.4 * SCALE} cy={CY + 0.2 * SCALE} r='33' fill='none' stroke='#c7ccf1' strokeWidth='7' strokeDasharray='4.2 3.4' />
        <circle cx={CX - 0.4 * SCALE} cy={CY + 0.2 * SCALE} r='24' fill='none' stroke='#c7ccf1' strokeWidth='1.5' />
        <circle cx={CX + 0.42 * SCALE} cy={CY + 0.24 * SCALE} r='24' fill='none' stroke='#a21dff' strokeWidth='6' strokeDasharray='3.6 3' />
        <circle cx={CX} cy={CY + 0.28 * SCALE} r='26' fill='none' stroke='#d6bd8a' strokeWidth='3' />
        <path d={`M${CX - 29} ${CY + 0.28 * SCALE}H${CX + 29}M${CX} ${CY + 0.28 * SCALE - 29}V${CY + 0.28 * SCALE + 29}`} stroke='#d6bd8a' strokeWidth='1.6' />
        <polygon points={octagon(0.43 * SCALE * K, CX, CY + 0.28 * SCALE)} fill='none' stroke='#d6bd8a' strokeWidth='1.2' />
      </g>
      <g fill='none' stroke='#d6bd8a'>
        <polygon points={octagon(0.9 * dial * K)} strokeWidth='1.2' />
        <polygon points={octagon(0.8 * dial * K)} strokeWidth='0.8' strokeOpacity='0.7' />
        <polygon points={octagon(0.47 * dial * K)} strokeWidth='1' strokeOpacity='0.8' />
      </g>

      <g stroke='#d6bd8a' strokeLinecap='butt'>
        {MINUTE_TICKS.filter((tick) => !tick.hour).map((tick) => (
          <line
            key={tick.id}
            x1={tick.x1.toFixed(2)}
            y1={tick.y1.toFixed(2)}
            x2={tick.x2.toFixed(2)}
            y2={tick.y2.toFixed(2)}
            strokeWidth='0.9'
            strokeOpacity='0.8'
          />
        ))}
      </g>
      {hourBatons.map((baton) => (
        <rect
          key={baton.id}
          x={CX - 3.2}
          y={CY - 0.78 * dial}
          width='6.4'
          height='22'
          fill='#d6bd8a'
          transform={`rotate(${baton.rotate} ${CX} ${CY})`}
        />
      ))}

      <g className='dial__hand dial__hand--dublin'>
        <polygon
          points={`${CX - 3.5},${CY} ${CX},${CY - 0.8 * dial} ${CX + 3.5},${CY} ${CX},${CY + 11}`}
          fill='#c7ccf1'
        />
      </g>
      <g className='dial__hand dial__hand--hour'>
        <polygon
          points={`${CX - 6.5},${CY} ${CX},${CY - 0.62 * dial} ${CX + 6.5},${CY} ${CX},${CY + 13}`}
          fill='#d6bd8a'
        />
      </g>
      <g className='dial__hand dial__hand--minute'>
        <polygon
          points={`${CX - 4.3},${CY} ${CX},${CY - 0.98 * dial} ${CX + 4.3},${CY} ${CX},${CY + 17}`}
          fill='#e6d3a6'
        />
      </g>
      <circle cx={CX} cy={CY} r='5' fill='#d6bd8a' />
      <circle cx={CX} cy={CY} r='1.8' fill='#340440' />

      <polygon
        points={`${CX - 60},${CY - 160} ${CX - 20},${CY - 160} ${CX - 140},${CY + 40} ${CX - 160},${CY + 20}`}
        fill='#ffffff'
        fillOpacity='0.07'
        clipPath='url(#dial-clip)'
      />
    </svg>
  );
}
