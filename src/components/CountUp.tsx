'use client';

import { useEffect, useRef } from 'react';
import type { Locale } from '@/i18n/config';
import { formatMetric } from '@/lib/metric-format';

const DURATION_MS = 1700;
const STAGGER_MS = 90;
/** Gentle: quick at first, then it settles into the figure without a sudden stop. */
const ease = (t: number) => 1 - (1 - t) ** 2.4;

/**
 * A figure that counts up from zero to its value when its block arrives. The page ships with the
 * final value, so without script (or with reduced motion, where the sweep is off) that is what is
 * shown. The text is written straight to the node on each frame, not through React state, so the
 * count stays smooth; the neighbouring figures start a beat apart, left to right and top to bottom.
 */
export function CountUp({
  to,
  unit,
  locale,
  order = 0,
}: {
  to: number;
  unit: string;
  locale: Locale;
  order?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    const card = node?.closest<HTMLElement>('.stepper__layer--numbers');
    if (!node || !card) return;
    const format = formatMetric(locale, unit);
    let raf = 0;
    let timer = 0;
    /** Whether the block was already in on the last read: the count restarts only when it comes in again. */
    let wasIn: boolean | null = null;
    const sync = () => {
      if (document.documentElement.dataset.sweep !== 'on') {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        node.textContent = format(to);
        return;
      }
      const isIn = !!card.dataset.in;
      if (isIn === wasIn) return;
      wasIn = isIn;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      node.textContent = format(0);
      if (!isIn) return;
      timer = window.setTimeout(() => {
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / DURATION_MS, 1);
          node.textContent = format(to * ease(progress));
          if (progress < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }, 250 + order * STAGGER_MS);
    };
    const observer = new MutationObserver(sync);
    observer.observe(card, { attributes: true, attributeFilter: ['data-in'] });
    // The sweep switches itself on in its own effect: read it once that has run.
    const first = requestAnimationFrame(sync);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(first);
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [to, unit, locale, order]);

  // The animated text passes through 0 on its way up, so assistive technology reads the real value instead.
  const final = formatMetric(locale, unit)(to);
  return (
    <>
      <span className='sr-only'>{final}</span>
      <span ref={ref} aria-hidden='true' suppressHydrationWarning>
        {final}
      </span>
    </>
  );
}
