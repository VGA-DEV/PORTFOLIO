'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { WIDE_QUERY } from '@/lib/media';
import { arriveProgress, leadProgress, leaveProgress } from '@/lib/transition';

/** The step is the scroll through the lead that ends the section: past this, the numbers are the ones in view. */
const NUMBERS_IN = 0.6;
const NUMBERS_OUT = 0.5;
/** How briskly the swap follows the scroll (a critically damped spring): a fast flick of the wheel, or a
    jank in the page, glides in about half a second instead of showing up in a single frame. */
const OMEGA = 9;

/**
 * Evolution says two things, the design (the comparer) and the numbers (the versions and their scores), and
 * they do not fit one screen. They share the section: on the wide layout, with the sweep on, the section stays
 * where it is while the visitor scrolls through its lead, and the design leaves piece by piece, rising and
 * fading, and the numbers arrive in the same place, piece by piece, the way the rows of a section change when
 * the watch moves on. The heading, the background and the watch do not change. Everything follows the scroll,
 * so stopping halfway leaves it halfway, and going back up brings the design back.
 *
 * Anywhere else (one column, reduced motion, no script) the two are shown one after the other.
 */
export function EvolutionStepper({
  numbersTitle,
  design,
  numbers,
}: {
  numbersTitle: string;
  design: ReactNode;
  numbers: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const designLayer = useRef<HTMLDivElement>(null);
  const numbersLayer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    const out = designLayer.current;
    const inn = numbersLayer.current;
    const lead = node?.closest('section')?.querySelector<HTMLElement>('[data-lead]');
    if (!node || !out || !inn) return;

    const wide = window.matchMedia(WIDE_QUERY);
    const outItems = Array.from(out.querySelectorAll<HTMLElement>('[data-step-item]'));
    const inItems = Array.from(inn.querySelectorAll<HTMLElement>('[data-step-item]'));
    const last = new Map<HTMLElement, string>();
    let frame = 0;
    let observer: IntersectionObserver | null = null;

    /** `keep`: the numbers wait hidden by the stylesheet, so once in they are given an explicit opacity, never cleared. */
    const set = (el: HTMLElement, opacity: number, shift: number, keep = false) => {
      const settled = opacity >= 0.999 && Math.abs(shift) < 0.5;
      const value = settled && !keep ? '' : `${opacity.toFixed(3)}|${shift.toFixed(1)}`;
      if (last.get(el) === value) return;
      last.set(el, value);
      el.style.opacity = value === '' ? '' : opacity.toFixed(3);
      el.style.transform = value === '' ? '' : `translate3d(0, ${shift.toFixed(1)}px, 0)`;
    };

    const clear = () => {
      for (const el of [...outItems, ...inItems]) {
        el.style.opacity = '';
        el.style.transform = '';
      }
      last.clear();
      delete node.dataset.view;
    };

    /** The step as the scroll has set it, and as it is shown: the second follows the first on a spring. */
    let target = 0;
    let shown = 0;
    let velocity = 0;
    let raf = 0;
    let lastTime = 0;

    const draw = (s: number) => {
      outItems.forEach((el, i) => {
        const r = outItems.length > 1 ? i / (outItems.length - 1) : 0;
        const gone = leaveProgress(s, r);
        set(el, 1 - gone, -34 * gone);
      });
      inItems.forEach((el, i) => {
        const r = inItems.length > 1 ? i / (inItems.length - 1) : 0;
        const here = arriveProgress(s, r);
        set(el, here, 46 * (1 - here), true);
      });
      const view = s > NUMBERS_OUT ? 'numbers' : 'design';
      if (node.dataset.view !== view) node.dataset.view = view;
      // The figures count up each time the numbers come in.
      if (s > NUMBERS_IN) inn.dataset.in = 'true';
      else if (s < NUMBERS_OUT) delete inn.dataset.in;
    };

    const follow = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      for (let left = dt; left > 0; left -= 1 / 120) {
        const h = Math.min(left, 1 / 120);
        velocity += (OMEGA * OMEGA * (target - shown) - 2 * OMEGA * velocity) * h;
        shown += velocity * h;
      }
      if (Math.abs(target - shown) < 0.0005 && Math.abs(velocity) < 0.002) {
        shown = target;
        velocity = 0;
        raf = 0;
      } else {
        raf = requestAnimationFrame(follow);
      }
      draw(shown);
    };

    /** Read the scroll; `snap` puts the step straight there (on arrival, or when the layout changes). */
    const update = (snap = false) => {
      frame = 0;
      const active = document.documentElement.dataset.sweep === 'on' && wide.matches && !!lead;
      if (!active || !lead) return;
      const s = leadProgress(lead, window.innerHeight);
      if (s < 0) return;
      target = s;
      if (snap) {
        cancelAnimationFrame(raf);
        raf = 0;
        shown = s;
        velocity = 0;
        draw(s);
      } else if (!raf) {
        lastTime = performance.now();
        raf = requestAnimationFrame(follow);
      }
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => update());
    };

    // Where the step is not driven by the scroll, the figures count when their block comes into view.
    const watchBlock = () => {
      observer?.disconnect();
      observer = null;
      if (document.documentElement.dataset.sweep !== 'on' || wide.matches) {
        delete inn.dataset.in;
        return;
      }
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) inn.dataset.in = 'true';
          else delete inn.dataset.in;
        },
        { threshold: 0.4 },
      );
      observer.observe(inn);
    };

    const refresh = () => {
      clear();
      watchBlock();
      update(true);
    };

    // The sweep switches itself on in its own effect: read it once that has run.
    const first = requestAnimationFrame(refresh);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    wide.addEventListener('change', refresh);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      wide.removeEventListener('change', refresh);
      observer?.disconnect();
    };
  }, []);

  return (
    <div ref={root} className='stepper'>
      <div ref={designLayer} className='stepper__layer stepper__layer--design'>
        {design}
      </div>
      <div ref={numbersLayer} className='stepper__layer stepper__layer--numbers'>
        <h3 className='stepper__label'>{numbersTitle}</h3>
        {numbers}
      </div>
    </div>
  );
}
