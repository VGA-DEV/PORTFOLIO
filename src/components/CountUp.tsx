'use client';

import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { formatMetric } from '@/lib/metric-format';

const DURATION_MS = 1300;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * A figure that counts from its old value to its new one when its section arrives. The page ships
 * with the final value, so without script (or with reduced motion, where the sweep is off) that is
 * what is shown; the count only runs while the section choreography is on.
 */
export function CountUp({ from, to, unit, locale }: { from: number; to: number; unit: string; locale: Locale }) {
  const [value, setValue] = useState(to);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const section = ref.current?.closest<HTMLElement>('[data-watch-section]');
    if (!section) return;
    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      if (document.documentElement.dataset.sweep !== 'on') {
        setValue(to);
        return;
      }
      if (!section.dataset.shown) {
        setValue(from);
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / DURATION_MS, 1);
        setValue(from + (to - from) * easeOut(progress));
        if (progress < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const observer = new MutationObserver(sync);
    observer.observe(section, { attributes: true, attributeFilter: ['data-shown'] });
    // The sweep switches itself on in its own effect: read it once that has run.
    const first = requestAnimationFrame(sync);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(first);
      cancelAnimationFrame(raf);
    };
  }, [from, to]);

  return <span ref={ref}>{formatMetric(locale, unit)(value)}</span>;
}
