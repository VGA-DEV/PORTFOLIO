'use client';

import { useEffect, useRef } from 'react';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
/** How long one sweep takes, in seconds, whatever the speed of the scroll. */
const DURATION = 1.1;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * The section backgrounds, fixed behind the page. Reaching the next section, its
 * background is swept in like a clock hand going round, from six o'clock, taking its
 * own time. The layers are fixed, so nothing here changes the length of the page;
 * without script, or with reduced motion, each section keeps its own plain background.
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
      const dark = el.classList.contains('hero') || el.classList.contains('section--stage');
      layer.dataset.tone = dark ? 'stage' : el.classList.contains('section--mist') ? 'mist' : 'paper';
      layer.dataset.side = el.dataset.side === 'right' ? 'right' : 'left';
      layer.dataset.state = i === 0 ? 'full' : 'hidden';
      if (i === 0) layer.dataset.hero = 'true';
      for (const name of ['sweep__fill', 'sweep__edge']) {
        const part = document.createElement('div');
        part.className = name;
        layer.appendChild(part);
      }
      root.appendChild(layer);
      return layer;
    });
    html.dataset.sweep = 'on';

    // 0 = not swept in yet, 1 = fully swept in; each layer glides toward its target.
    const shown: number[] = nodes.map((_, i) => (i === 0 ? 1 : 0));
    const goal: number[] = nodes.map((_, i) => (i === 0 ? 1 : 0));
    let frame = 0;
    let lastTime = 0;

    const paint = (i: number) => {
      const angle = Math.round(easeInOut(shown[i]) * 3600) / 10;
      nodes[i].style.setProperty('--sweep', `${angle}deg`);
      nodes[i].dataset.state = angle <= 0 ? 'hidden' : angle >= 360 ? 'full' : 'sweeping';
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      let moving = false;
      for (let i = 1; i < nodes.length; i++) {
        if (shown[i] === goal[i]) continue;
        const step = dt / DURATION;
        shown[i] = shown[i] < goal[i] ? Math.min(shown[i] + step, goal[i]) : Math.max(shown[i] - step, goal[i]);
        paint(i);
        if (shown[i] !== goal[i]) moving = true;
      }
      if (moving) frame = requestAnimationFrame(tick);
    };

    const aim = (instant: boolean) => {
      const viewport = window.innerHeight;
      for (let i = 1; i < sections.length; i++) {
        const top = sections[i].getBoundingClientRect().top;
        // A little slack either side, so hovering around the line does not flip it.
        if (top < viewport * 0.6) goal[i] = 1;
        else if (top > viewport * 0.72) goal[i] = 0;
      }
      // Only the layer on top is ever seen moving: the ones under it settle at once,
      // so a quick scroll through several sections never piles animations up.
      const topLayer = goal.lastIndexOf(1);
      let movingAbove = -1;
      for (let i = nodes.length - 1; i > topLayer; i--) {
        if (shown[i] > 0) {
          movingAbove = i;
          break;
        }
      }
      for (let i = 1; i < nodes.length; i++) {
        const lead = i === topLayer || i === movingAbove;
        if (instant || !lead) {
          if (i < topLayer) shown[i] = 1;
          else if (i !== movingAbove && i !== topLayer) shown[i] = 0;
          else shown[i] = goal[i];
          paint(i);
        }
      }
      if (!instant && !frame) {
        lastTime = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };

    aim(true);
    const onScroll = () => aim(false);
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
