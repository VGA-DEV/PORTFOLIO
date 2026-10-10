'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * The flat watch in the hero: the whole visual on phones and tablets, and the
 * placeholder until the 3D scene takes over. It shows the visitor's local time.
 */
export function HeroWatch({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const tick = () => {
      const now = new Date();
      const seconds = now.getSeconds();
      const minutes = now.getMinutes() + seconds / 60;
      const hours = (now.getHours() % 12) + minutes / 60;
      root.style.setProperty('--hour-angle', `${hours * 30}deg`);
      root.style.setProperty('--minute-angle', `${minutes * 6}deg`);
      root.style.setProperty('--second-angle', `${seconds * 6}deg`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className='hero__watch' ref={ref}>
      <div className='watch__figure' aria-hidden='true'>
        {children}
      </div>
    </div>
  );
}
