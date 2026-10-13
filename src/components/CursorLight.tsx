'use client';

import { useEffect, useRef } from 'react';

/**
 * A very soft champagne halo that follows the mouse over the dark sections (the hero and the case
 * back), above the watch and below the text. It only shows while the page is on a dark section
 * (`html[data-tone='stage']`) and never on touch or with reduced motion. It trails the pointer a
 * little instead of sticking to it.
 */
export function CursorLight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    const loop = () => {
      x += (targetX - x) * 0.14;
      y += (targetY - y) * 0.14;
      node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      raf = Math.abs(targetX - x) + Math.abs(targetY - y) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      if (!node.dataset.live) {
        x = targetX = event.clientX;
        y = targetY = event.clientY;
        node.dataset.live = 'true';
      }
      targetX = event.clientX;
      targetY = event.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onLeave = () => delete node.dataset.live;
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ref} className='cursor-light' aria-hidden='true' />;
}
