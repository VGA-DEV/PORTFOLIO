'use client';

import { useEffect, useRef } from 'react';

const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

const TICKS = Array.from({ length: 60 }, (_, m) => {
  const a = (m / 60) * Math.PI * 2;
  const long = m % 5 === 0;
  const r0 = long ? 0.7 : 0.74;
  return { m, long, x0: Math.sin(a) * r0, y0: -Math.cos(a) * r0, x1: Math.sin(a) * 0.78, y1: -Math.cos(a) * 0.78 };
});

/**
 * A giant watch dial fixed behind the page, mostly off screen. It turns slowly with
 * the scroll, so the page seems to be wound along a mechanism. It is fixed, so it
 * never changes the length of the page.
 */
export function DialBackdrop() {
  const turnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = turnRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      el.style.transform = `rotate(${(window.scrollY * 0.045).toFixed(2)}deg)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className='dial-bg' aria-hidden='true'>
      <div className='dial-bg__turn' ref={turnRef}>
        <svg viewBox='-1 -1 2 2' focusable='false'>
          <circle r='0.98' className='dial-bg__ring' />
          <circle r='0.64' className='dial-bg__ring' />
          {TICKS.map((t) => (
            <line
              key={t.m}
              x1={t.x0.toFixed(4)}
              y1={t.y0.toFixed(4)}
              x2={t.x1.toFixed(4)}
              y2={t.y1.toFixed(4)}
              className={t.long ? 'dial-bg__tick dial-bg__tick--long' : 'dial-bg__tick'}
            />
          ))}
          {ROMAN.map((label, i) => {
            const a = (i / 12) * 360;
            return (
              <text
                key={label}
                className='dial-bg__numeral'
                transform={`rotate(${a}) translate(0 -0.88)`}
                textAnchor='middle'
                dominantBaseline='central'
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
