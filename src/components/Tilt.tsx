'use client';

import { useRef, type PointerEvent, type ReactNode } from 'react';

/** The most a card leans, in degrees, towards the pointer. */
const LEAN_Y = 5;
const LEAN_X = 4;

/**
 * A card that leans a few degrees towards the mouse, with a soft sheen that follows it. Mouse only and
 * never with reduced motion; touch and keyboard see the plain card. It is its own wrapper, so it never
 * touches the transform the section choreography puts on the row that contains it.
 */
export function Tilt({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const lean = (event: PointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node || event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = node.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    node.style.setProperty('--ry', `${((x - 0.5) * 2 * LEAN_Y).toFixed(2)}deg`);
    node.style.setProperty('--rx', `${((0.5 - y) * 2 * LEAN_X).toFixed(2)}deg`);
    node.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    node.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
  };

  const rest = () => {
    const node = ref.current;
    if (!node) return;
    for (const name of ['--rx', '--ry', '--mx', '--my']) node.style.removeProperty(name);
  };

  return (
    <div ref={ref} className={`tilt ${className ?? ''}`} onPointerMove={lean} onPointerLeave={rest}>
      {children}
    </div>
  );
}
