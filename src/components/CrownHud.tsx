'use client';

import { useEffect, useRef } from 'react';

type CrownHudProps = {
  /** Accessible name of the control. */
  label: string;
  /** Short hint shown beside the crown on arrival. */
  hint: string;
};

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/**
 * The crown of the watch whose glass is the browser window: it sits on the right
 * edge of the screen, its knurling turns with the scroll, and a scale of marks
 * along the edge shows which section you are in. Drag it to wind the page, tap it
 * (or press Enter) to go to the next section.
 */
export function CrownHud({ label, hint }: CrownHudProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: 0, lastY: 0 });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-watch-section]'));
    const marks = Array.from(root.querySelectorAll<HTMLElement>('.crown-hud__mark'));
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      root.style.setProperty('--turn', `${(y * 0.35).toFixed(1)}px`);

      // The section we are in, and how far through the whole page we are.
      const line = window.innerHeight * 0.5;
      let active = 0;
      sections.forEach((section, i) => {
        if (section.getBoundingClientRect().top <= line) active = i;
      });
      marks.forEach((mark, i) => mark.classList.toggle('is-active', i === active));
      const max = document.documentElement.scrollHeight - window.innerHeight;
      root.style.setProperty('--progress', clamp01(max > 0 ? y / max : 0).toFixed(4));
      // Once the visitor has started scrolling, the invitation to pull stops.
      if (y > 240) root.dataset.used = 'true';
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
    };
  }, []);

  const goToNext = () => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-watch-section]'));
    const line = window.innerHeight * 0.4;
    const next = sections.find((section) => section.getBoundingClientRect().top > line);
    if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const markCount = 6;

  return (
    <div className='crown-hud' ref={rootRef}>
      <ol className='crown-hud__scale' aria-hidden='true'>
        {Array.from({ length: markCount }, (_, i) => (
          <li key={i} className='crown-hud__mark' />
        ))}
      </ol>
      <button
        type='button'
        className='crown-hud__crown'
        aria-label={label}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { active: true, moved: 0, lastY: event.clientY };
          rootRef.current?.classList.add('is-held');
        }}
        onPointerMove={(event) => {
          if (!drag.current.active) return;
          const dy = event.clientY - drag.current.lastY;
          drag.current.lastY = event.clientY;
          drag.current.moved += Math.abs(dy);
          if (drag.current.moved > 4) window.scrollBy({ top: dy * 2.6, behavior: 'instant' });
        }}
        onPointerUp={() => {
          const wasTap = drag.current.active && drag.current.moved <= 4;
          drag.current.active = false;
          rootRef.current?.classList.remove('is-held');
          if (wasTap) goToNext();
        }}
        onPointerCancel={() => {
          drag.current.active = false;
          rootRef.current?.classList.remove('is-held');
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            window.scrollBy({
              top: (event.key === 'ArrowDown' ? 1 : -1) * window.innerHeight * 0.6,
              behavior: 'smooth',
            });
          }
        }}
        onClick={(event) => {
          // Keyboard activation only: pointer taps are handled on release.
          if (event.detail === 0) goToNext();
        }}
      >
        <span className='crown-hud__stem' aria-hidden='true' />
        <span className='crown-hud__grip' aria-hidden='true' />
        <span className='crown-hud__hint' aria-hidden='true'>
          {hint}
        </span>
      </button>
    </div>
  );
}
