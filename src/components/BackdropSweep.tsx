'use client';

import { useEffect, useRef } from 'react';
import { dwellProgress } from '@/lib/transition';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * The section backgrounds, fixed behind the page. While a section is held in place
 * for its scroll dwell, the next background is swept in like a clock hand going round,
 * from six o'clock, as far as the scroll has gone: this is where the extra length of
 * the section is felt. The layers are fixed, so nothing here changes the length of the
 * page; without script, or with reduced motion, each section keeps its own plain background.
 */
export function BackdropSweep() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia(REDUCED_QUERY).matches) return;
    const html = document.documentElement;
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-watch-section]'));
    const pins = Array.from(document.querySelectorAll<HTMLElement>('.pin'));

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

    const dwells = Array.from(document.querySelectorAll<HTMLElement>('[data-gap]'));
    const last: number[] = nodes.map(() => -1);
    let frame = 0;

    // The sweep follows the scroll through the dwell of the section before.
    const update = () => {
      frame = 0;
      const viewport = window.innerHeight;
      // The held content gives way as the watch arrives, so the new piece never sits on old text.
      dwells.forEach((dwell, k) => {
        const p = dwellProgress(dwell, viewport);
        const t = Math.min(Math.max((p - 0.4) / 0.3, 0), 1);
        const opacity = p < 0 ? 1 : 1 - t * t * (3 - 2 * t);
        const pin = pins[k];
        if (!pin) return;
        pin.style.opacity = opacity >= 0.999 ? '' : opacity.toFixed(3);
        pin.style.pointerEvents = opacity < 0.1 ? 'none' : '';
      });
      for (let i = 1; i < nodes.length; i++) {
        const dwell = dwells[i - 1];
        let progress = dwell ? dwellProgress(dwell, viewport) : -1;
        if (progress < 0) progress = sections[i].getBoundingClientRect().top < viewport * 0.6 ? 1 : 0;
        const angle = Math.round(progress * 3600) / 10;
        if (angle === last[i]) continue;
        last[i] = angle;
        nodes[i].style.setProperty('--sweep', `${angle}deg`);
        nodes[i].dataset.state = angle <= 0 ? 'hidden' : angle >= 360 ? 'full' : 'sweeping';
      }
    };

    // A section's content is held when its bottom reaches the bottom of the screen,
    // whether it is shorter than the screen or taller.
    const setPins = () => {
      const viewport = window.innerHeight;
      pins.forEach((pin) => {
        pin.style.top = `${Math.round(viewport - pin.offsetHeight)}px`;
      });
    };
    setPins();
    const resizeObserver = new ResizeObserver(setPins);
    pins.forEach((pin) => resizeObserver.observe(pin));

    update();
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('resize', setPins, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('resize', setPins);
      resizeObserver.disconnect();
      pins.forEach((pin) => {
        pin.style.removeProperty('top');
        pin.style.removeProperty('opacity');
        pin.style.removeProperty('pointer-events');
      });
      cancelAnimationFrame(frame);
      nodes.forEach((node) => node.remove());
      delete html.dataset.sweep;
    };
  }, []);

  return <div className='sweep' ref={rootRef} aria-hidden='true' />;
}
