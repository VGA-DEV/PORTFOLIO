'use client';

import { useEffect, useRef } from 'react';
import { dwellProgress } from '@/lib/transition';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);
const smooth = (t: number) => t * t * (3 - 2 * t);

/** The pieces of a section that come and go one after another: its heading, intro and each card or row. */
function revealItems(pin: HTMLElement): HTMLElement[] {
  const body = pin.querySelector<HTMLElement>('.section__body, .hero__text');
  if (!body) return [];
  const items: HTMLElement[] = [];
  for (const child of Array.from(body.children) as HTMLElement[]) {
    const isList = /^(OL|UL)$/.test(child.tagName) || child.classList.contains('stack');
    const inner = Array.from(child.children) as HTMLElement[];
    if (isList && inner.length > 1) items.push(...inner);
    else items.push(child);
  }
  return items;
}

/**
 * The section backgrounds, fixed behind the page, and the choreography of a change of
 * section, all driven by the scroll through the dwell that ends each section:
 *   1. the content leaves piece by piece, rising and fading;
 *   2. at the same time the next background is swept in like a clock hand going round;
 *   3. as the sweep is about to end, the next section's content appears and slides
 *      quickly into its place.
 * While this happens the content that is leaving is held in place, so the extra scroll
 * is not seen as a gap. Everything is fixed or transformed, so nothing here changes the
 * page's length; without script, or with reduced motion, each section keeps its own
 * plain background and nothing is held.
 */
export function BackdropSweep() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia(REDUCED_QUERY).matches) return;
    const html = document.documentElement;
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-watch-section]'));
    const pins = Array.from(document.querySelectorAll<HTMLElement>('.pin'));
    const dwells = Array.from(document.querySelectorAll<HTMLElement>('[data-gap]'));
    const items = pins.map(revealItems);

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

    const lastAngle: number[] = nodes.map(() => -1);
    const lastStyle = new Map<HTMLElement, string>();
    const lastVisible = new Map<HTMLElement, boolean>();
    let frame = 0;

    const setStyle = (el: HTMLElement, opacity: number, shift: number) => {
      const value = opacity >= 0.999 && Math.abs(shift) < 0.5 ? '' : `${opacity.toFixed(3)}|${shift.toFixed(1)}`;
      if (lastStyle.get(el) === value) return;
      lastStyle.set(el, value);
      if (value === '') {
        el.style.opacity = '';
        el.style.transform = '';
      } else {
        el.style.opacity = opacity.toFixed(3);
        el.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
      }
    };

    const update = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const progress = dwells.map((dwell) => dwellProgress(dwell, viewport));

      // The sweep: the next background goes round as far as the scroll has gone.
      for (let i = 1; i < nodes.length; i++) {
        let p = progress[i - 1] ?? -1;
        if (p < 0) p = sections[i].getBoundingClientRect().top < viewport * 0.6 ? 1 : 0;
        const angle = Math.round(p * 3600) / 10;
        if (angle === lastAngle[i]) continue;
        lastAngle[i] = angle;
        nodes[i].style.setProperty('--sweep', `${angle}deg`);
        nodes[i].dataset.state = angle <= 0 ? 'hidden' : angle >= 360 ? 'full' : 'sweeping';
      }

      // The content: leaving during the section's own dwell, arriving at the end of the one before.
      pins.forEach((pin, k) => {
        const own = progress[k] ?? -1;
        const before = k > 0 ? (progress[k - 1] ?? -1) : 1;
        const list = items[k];
        const n = list.length;
        list.forEach((el, idx) => {
          const r = n > 1 ? idx / (n - 1) : 0;
          // Leaving: top to bottom, each piece rising and fading, over the first part of the dwell.
          const out = own < 0 ? 0 : smooth(clamp01((own - (0.02 + 0.28 * r)) / 0.28));
          // Arriving: top to bottom, each piece sliding up into place, over the last part of the one before.
          const inn = before < 0 ? 1 : smooth(clamp01((before - (0.66 + 0.14 * r)) / 0.12));
          setStyle(el, (1 - out) * inn, -34 * out + 46 * (1 - inn));
        });
        // Out of sight, and out of reach, while it has not arrived or has left.
        const visible = !(k > 0 && before >= 0 && before < 0.66) && !(own >= 0.6);
        if (lastVisible.get(pin) !== visible) {
          lastVisible.set(pin, visible);
          pin.style.visibility = visible ? 'visible' : 'hidden';
        }
      });
    };

    // A section's content is held when it reaches the top of the page (or, if it is taller
    // than the screen, when its bottom reaches the bottom of the screen). The next section
    // is pulled up so that it is in place just as the dwell ends.
    const setPins = () => {
      const viewport = window.innerHeight;
      const header = document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 0;
      pins.forEach((pin) => {
        pin.style.top = `${Math.round(Math.min(viewport - pin.offsetHeight, header))}px`;
      });
      html.style.setProperty('--overlap', `${viewport - header}px`);
      // Links to a section land with it exactly where the end of the dwell puts it.
      html.style.scrollPaddingTop = `${header}px`;
      update();
    };
    setPins();
    const resizeObserver = new ResizeObserver(setPins);
    pins.forEach((pin) => resizeObserver.observe(pin));

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
      cancelAnimationFrame(frame);
      pins.forEach((pin) => {
        pin.style.removeProperty('top');
        pin.style.removeProperty('visibility');
      });
      items.flat().forEach((el) => {
        el.style.removeProperty('opacity');
        el.style.removeProperty('transform');
      });
      html.style.removeProperty('--overlap');
      html.style.removeProperty('scroll-padding-top');
      nodes.forEach((node) => node.remove());
      delete html.dataset.sweep;
    };
  }, []);

  return <div className='sweep' ref={rootRef} aria-hidden='true' />;
}
