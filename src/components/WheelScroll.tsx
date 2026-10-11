'use client';

import { useEffect } from 'react';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Makes moving from one section to the next feel like a wheel turning instead of
 * a page sliding up. Each section's content swings along an arc around a pivot far
 * below the screen, upright while it fills the view and tilting as it enters or
 * leaves. The scroll itself stays native: this only adds a transform.
 */
export function WheelScroll() {
  useEffect(() => {
    const reduced = window.matchMedia(REDUCED_QUERY);
    if (reduced.matches) return;

    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-watch-section]'));
    const targets = sections
      .map((section) => ({ section, content: section.querySelector<HTMLElement>('.container') }))
      .filter((entry): entry is { section: HTMLElement; content: HTMLElement } => entry.content !== null);

    let frame = 0;

    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      // A gentler swing on narrow screens, where text is wide.
      const gain = window.innerWidth < 992 ? 0.5 : 1;

      for (const { section, content } of targets) {
        const rect = section.getBoundingClientRect();
        const entering = rect.top - vh * 0.3; // > 0 while the section is still below its place
        const leaving = rect.bottom - vh * 0.7; // < 0 once its end has passed the reading line

        let distance = 0;
        if (entering > 0 && leaving < 0) distance = (entering + leaving) / 2;
        else if (entering > 0) distance = entering;
        else if (leaving < 0) distance = leaving;

        const angle = Math.max(Math.min((distance / (vh * 1.4)) * gain, 0.5), -0.5);
        if (Math.abs(angle) < 0.0008) {
          content.style.transform = '';
          content.style.transformOrigin = '';
          content.style.opacity = '';
          continue;
        }
        const pivotY = vh * 1.3 - (rect.top + content.offsetTop);
        content.style.transformOrigin = `50% ${pivotY.toFixed(1)}px`;
        content.style.transform = `rotate(${angle.toFixed(4)}rad)`;
        content.style.opacity = String(1 - Math.min(Math.abs(angle) * 1.1, 0.7));
      }
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
      for (const { content } of targets) {
        content.style.transform = '';
        content.style.transformOrigin = '';
        content.style.opacity = '';
      }
    };
  }, []);

  return null;
}
