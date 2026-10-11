'use client';

import { useEffect, useRef } from 'react';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/**
 * The section backgrounds, fixed behind the page. Moving to the next section, its
 * background is swept in like a clock hand going round, from six o'clock. The layers
 * are fixed, so nothing here changes the length of the page; without script, or with
 * reduced motion, each section keeps its own plain background.
 */
export function BackdropSweep() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia(REDUCED_QUERY).matches) return;
    const html = document.documentElement;
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-watch-section]'));

    // One layer per section, read from the page itself so the two never disagree.
    const nodes = sections.map((el, i) => {
      const layer = document.createElement('div');
      layer.className = 'sweep__layer';
      layer.dataset.tone = el.classList.contains('section--paper') ? 'paper' : 'stage';
      layer.dataset.side = el.dataset.side === 'right' ? 'right' : 'left';
      layer.dataset.state = i === 0 ? 'full' : 'hidden';
      if (i === 0) layer.dataset.hero = 'true';
      layer.innerHTML = '<div class="sweep__fill"></div><div class="sweep__edge"></div>';
      root.appendChild(layer);
      return layer;
    });
    html.dataset.sweep = 'on';
    const last: number[] = nodes.map(() => -1);
    let frame = 0;

    const update = () => {
      frame = 0;
      const viewport = window.innerHeight;
      // Section i is swept in while its top travels from 80% to 30% of the screen.
      nodes.forEach((node, i) => {
        if (i === 0) return;
        const top = sections[i].getBoundingClientRect().top;
        const progress = clamp01((viewport * 0.8 - top) / (viewport * 0.5));
        const angle = Math.round(progress * 3600) / 10;
        if (angle === last[i]) return;
        last[i] = angle;
        node.style.setProperty('--sweep', `${angle}deg`);
        node.dataset.state = angle <= 0 ? 'hidden' : angle >= 360 ? 'full' : 'sweeping';
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
      nodes.forEach((node) => node.remove());
      delete html.dataset.sweep;
    };
  }, []);

  return <div className='sweep' ref={rootRef} aria-hidden='true' />;
}
