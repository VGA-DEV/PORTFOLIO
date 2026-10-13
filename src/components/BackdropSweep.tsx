'use client';

import { useEffect, useRef } from 'react';
import { arriveProgress, dwellProgress, leaveProgress } from '@/lib/transition';
import { arrivedAt, leftFrom, stillAt, subscribeMove } from '@/lib/watch/move';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
/** The two-column layout: text beside the watch, each section meant to fit one screen. */
const WIDE_QUERY = '(min-width: 62rem) and (pointer: fine)';
/** A section is scaled down to fit the screen, but never below this, so it stays readable. */
const MIN_FIT = 0.8;

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
    const heldPins = new Set<HTMLElement>();
    let headerHeight = 0;
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

      // The content changes row by row, so there is always something on screen: each row
      // of the section that is going rises and fades, and a little later the same row of
      // the next one arrives in its place.
      pins.forEach((pin, k) => {
        const own = progress[k] ?? -1;
        const before = k > 0 ? (progress[k - 1] ?? -1) : 1;
        const list = items[k];
        const n = list.length;
        const gate = arrivedAt(k);
        const leftGate = leftFrom(k);
        const present = stillAt(k);
        list.forEach((el, idx) => {
          const r = n > 1 ? idx / (n - 1) : 0;
          // Held at a third gone until the watch has set off, so the screen is never emptied.
          const held = own < 0 ? 0 : Math.min(leaveProgress(own, r), 0.35 + 0.65 * leftGate);
          // And never over a watch that is still on the next piece (scrolling back up).
          const out = Math.max(held, 1 - present);
          // The content of a section comes in only once the watch has moved on to its piece.
          const inn = (before < 0 ? 1 : arriveProgress(before, r)) * gate;
          const shown = (1 - out) * inn;
          setStyle(el, shown, -34 * out + 46 * (1 - inn));
          // Each piece is marked once it is fully in, and unmarked once it has mostly gone (the margin
          // between the two keeps it from flickering). The page's small animations (lines that draw, bars
          // that fill, figures that count) start and reset on this mark, each piece on its own, so they
          // begin the moment their piece arrives and not when the whole section has.
          if (k > 0) {
            // Only on a real change: writing the same value still counts as a mutation for any observer.
            if (shown >= 0.98) {
              if (!el.dataset.in) el.dataset.in = 'true';
            } else if (shown < 0.35 && el.dataset.in) {
              delete el.dataset.in;
            }
          }
        });
        // The next section waits where it will end up, instead of coming up the screen with
        // the scroll, so its rows land exactly over the ones that leave. It is held with
        // `position: fixed`, which the scroll never moves, so there is nothing to keep up with
        // and the text cannot shake; at the end of the dwell it takes its place in the flow.
        const container = pin.querySelector<HTMLElement>(':scope > .container');
        const waiting =
          k > 0 &&
          !!container &&
          !!dwells[k - 1] &&
          before >= 0.4 &&
          dwells[k - 1].getBoundingClientRect().bottom - viewport > 0.5;
        if (container && waiting !== heldPins.has(pin)) {
          if (waiting) {
            const offset = container.offsetTop;
            pin.style.height = `${pin.offsetHeight}px`;
            container.style.position = 'fixed';
            container.style.top = `${headerHeight + offset}px`;
            container.style.left = '0';
            container.style.right = '0';
            heldPins.add(pin);
          } else {
            pin.style.removeProperty('height');
            container.style.removeProperty('position');
            container.style.removeProperty('top');
            container.style.removeProperty('left');
            container.style.removeProperty('right');
            heldPins.delete(pin);
          }
        }
        // Out of sight, and out of reach, until it starts to arrive and once it has gone.
        const visible = !(k > 0 && before >= 0 && before < 0.4) && !(own >= 0.53);
        if (lastVisible.get(pin) !== visible) {
          lastVisible.set(pin, visible);
          pin.style.visibility = visible ? 'visible' : 'hidden';
        }
      });
    };

    // A section's content is held when it reaches the top of the page (or, if it is taller
    // than the screen, when its bottom reaches the bottom of the screen). The next section
    // is pulled up so that it is in place just as the dwell ends.
    /** Put every held section back in the flow, so that nothing measured earlier outlives a resize. */
    const releaseHeld = () => {
      heldPins.forEach((pin) => {
        pin.style.removeProperty('height');
        const container = pin.querySelector<HTMLElement>(':scope > .container');
        container?.removeAttribute('style');
      });
      heldPins.clear();
    };
    let lastSize = '';
    const setPins = () => {
      const size = `${window.innerWidth}x${window.innerHeight}`;
      if (size !== lastSize) {
        lastSize = size;
        releaseHeld();
      }
      const viewport = window.innerHeight;
      const header = document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 0;
      headerHeight = header;
      const wide = window.matchMedia(WIDE_QUERY).matches;
      pins.forEach((pin) => {
        // On the wide layout a section must show all of its content while it changes, so one
        // taller than the screen is scaled down to fit (never below MIN_FIT).
        const body = pin.querySelector<HTMLElement>('.section__body');
        if (body) {
          body.style.removeProperty('zoom');
          if (wide) {
            const style = getComputedStyle(pin);
            const room = viewport - header - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
            const fit = Math.min(1, Math.max(room / body.getBoundingClientRect().height, MIN_FIT));
            if (fit < 0.999) body.style.setProperty('zoom', fit.toFixed(3));
          }
        }
        // Every section fills at least the screen below the header, whatever the layout, so the
        // next one, pulled up by exactly that much, never starts its own dwell inside this one's.
        pin.style.minHeight = `${Math.max(viewport - header, 0)}px`;
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
    const unsubscribe = subscribeMove(onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('resize', setPins);
      unsubscribe();
      resizeObserver.disconnect();
      cancelAnimationFrame(frame);
      pins.forEach((pin) => {
        pin.style.removeProperty('top');
        pin.style.removeProperty('visibility');
        pin.style.removeProperty('transform');
        pin.style.removeProperty('height');
        pin.style.removeProperty('min-height');
        pin.querySelector<HTMLElement>('.section__body')?.style.removeProperty('zoom');
        pin.querySelector<HTMLElement>(':scope > .container')?.removeAttribute('style');
      });
      items.flat().forEach((el) => {
        el.style.removeProperty('opacity');
        el.style.removeProperty('transform');
      });
      html.style.removeProperty('--overlap');
      html.style.removeProperty('scroll-padding-top');
      nodes.forEach((node) => node.remove());
      items.flat().forEach((el) => delete el.dataset.in);
      delete html.dataset.sweep;
    };
  }, []);

  return <div className='sweep' ref={rootRef} aria-hidden='true' />;
}
