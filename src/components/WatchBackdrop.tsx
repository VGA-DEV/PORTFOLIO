'use client';

import { useEffect, useRef } from 'react';
import type { CrownPosition, WatchScene } from '@/lib/watch/scene';

type WatchBackdropProps = {
  /** Black {VGA_DEV} logo for the dial and the case back. */
  logoUrl: string;
  /** Accessible name of the crown control, and the hint shown beside it in the hero. */
  crown: { label: string; hint: string };
};

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
/** Below this width the page is a single column and the watch sits behind the text. */
const NARROW_QUERY = '(max-width: 61.99rem)';

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Navigator3D = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

/** Skip the 3D on data saver or on clearly weak devices; the flat watch stays. */
function deviceIsTooWeak() {
  const nav = navigator as Navigator3D;
  if (nav.connection?.saveData) return true;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return true;
  if (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4) return true;
  return false;
}

/**
 * A full-screen canvas fixed behind the page content. Its scene is the watch,
 * which travels round the screen to the piece each section is about as the page
 * scrolls. On phones it sits fainter behind the text.
 */
export function WatchBackdrop({ logoUrl, crown }: WatchBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const crownRef = useRef<HTMLButtonElement>(null);
  const sceneHandle = useRef<WatchScene | null>(null);
  const logoRef = useRef(logoUrl);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const root = document.documentElement;

    const reduced = window.matchMedia(REDUCED_QUERY);
    const narrow = window.matchMedia(NARROW_QUERY);

    let alive = true;
    let startTimer = 0;
    let scene: WatchScene | null = null;
    let teardown: (() => void) | null = null;

    /** Keep the real button exactly over the 3D crown. */
    const placeCrown = (p: CrownPosition) => {
      const button = crownRef.current;
      if (!button) return;
      const x = Math.min(Math.max(p.x, 28), window.innerWidth - 28);
      const y = Math.min(Math.max(p.y, 80), window.innerHeight - 28);
      button.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      button.style.width = button.style.height = `${(p.radius * 2).toFixed(1)}px`;
      button.dataset.ready = 'true';
    };

    const stop = () => {
      sceneHandle.current = null;
      if (crownRef.current) delete crownRef.current.dataset.ready;
      window.clearTimeout(startTimer);
      teardown?.();
      teardown = null;
      scene?.dispose();
      scene = null;
      delete root.dataset.watch;
      root.style.removeProperty('--watch-opacity');
    };

    const start = async () => {
      let sceneModule: typeof import('@/lib/watch/scene');
      try {
        sceneModule = await import('@/lib/watch/scene');
      } catch {
        root.dataset.watch = 'flat';
        return;
      }
      if (!alive || scene) return;

      const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-watch-section]'));
      // Text on the left puts the watch on the right, and the other way round.
      const sides = sections.map((el) => (el.dataset.side === 'right' ? -1 : 1));

      // Phones: the hero watch takes the place of the flat one under the hero text.
      const spacer = document.querySelector<HTMLElement>('.hero__watch');
      let heroAnchor = 0.64;
      if (spacer) {
        const rect = spacer.getBoundingClientRect();
        const centre = rect.top + window.scrollY + rect.height / 2;
        heroAnchor = Math.min(Math.max(centre / window.innerHeight, 0.4), 0.8);
      }

      try {
        scene = await sceneModule.createWatchScene({
          canvas,
          still: false,
          logoUrl: logoRef.current,
          sides,
          heroAnchor,
          onCrown: placeCrown,
        });
      } catch {
        root.dataset.watch = 'flat'; // No WebGL2: the flat watch is the whole visual.
        return;
      }
      if (!alive) {
        scene.dispose();
        scene = null;
        return;
      }
      root.dataset.watch = '3d';
      sceneHandle.current = scene;
      const cleanups: (() => void)[] = [];
      const current = scene;

      let frame = 0;
      const update = () => {
        frame = 0;
        const viewport = window.innerHeight;
        // Each boundary between two sections is crossed while the next section's
        // top travels from 80% to 30% of the viewport height.
        let position = 0;
        for (let i = 1; i < sections.length; i++) {
          const top = sections[i].getBoundingClientRect().top;
          position += clamp01((viewport * 0.8 - top) / (viewport * 0.5));
        }
        current.setPosition(position);
        // Behind single-column text the watch is fainter, except in the hero.
        if (narrow.matches) {
          root.style.setProperty('--watch-opacity', lerp(1, 0.38, clamp01(position * 1.6)).toFixed(3));
        } else {
          root.style.removeProperty('--watch-opacity');
        }
      };
      const onScroll = () => {
        if (!frame) frame = requestAnimationFrame(update);
      };
      update();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      cleanups.push(() => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        cancelAnimationFrame(frame);
      });

      const sync = () => current.setRunning(!document.hidden);
      document.addEventListener('visibilitychange', sync);
      sync();
      cleanups.push(() => document.removeEventListener('visibilitychange', sync));

      const resizeObserver = new ResizeObserver(() => current.resize());
      resizeObserver.observe(canvas);
      cleanups.push(() => resizeObserver.disconnect());

      teardown = () => cleanups.forEach((fn) => fn());
    };

    // The flat watch is shown only when the 3D cannot run on this device.
    const schedule = () => {
      if (!alive || scene) return;
      if (reduced.matches || deviceIsTooWeak()) {
        root.dataset.watch = 'flat';
        return;
      }
      window.clearTimeout(startTimer);
      startTimer = window.setTimeout(() => void start(), 150);
    };

    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });

    return () => {
      alive = false;
      window.removeEventListener('load', schedule);
      stop();
    };
  }, []);

  // Winding the crown: dragging it scrolls the page, a tap moves to the next section.
  const drag = useRef({ active: false, moved: 0, lastY: 0 });

  const goToNext = () => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-watch-section]'));
    const line = window.innerHeight * 0.4;
    const next = sections.find((section) => section.getBoundingClientRect().top > line);
    if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    sceneHandle.current?.spinCrown(Math.PI * 2);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { active: true, moved: 0, lastY: event.clientY };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return;
    const dy = event.clientY - drag.current.lastY;
    drag.current.lastY = event.clientY;
    drag.current.moved += Math.abs(dy);
    if (drag.current.moved > 4) {
      window.scrollBy({ top: dy * 2.4, behavior: 'instant' });
      sceneHandle.current?.spinCrown(dy * 0.05);
    }
  };
  const onPointerUp = () => {
    const wasTap = drag.current.active && drag.current.moved <= 4;
    drag.current.active = false;
    if (wasTap) goToNext();
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      window.scrollBy({ top: (event.key === 'ArrowDown' ? 1 : -1) * window.innerHeight * 0.6, behavior: 'smooth' });
      sceneHandle.current?.spinCrown(event.key === 'ArrowDown' ? 0.8 : -0.8);
    }
  };

  return (
    <>
      <div className='watch-bg' aria-hidden='true'>
        <canvas className='watch-bg__canvas' ref={canvasRef} />
      </div>
      <button
        type='button'
        className='crown-control'
        ref={crownRef}
        aria-label={crown.label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current.active = false;
        }}
        onKeyDown={onKeyDown}
        onClick={(event) => {
          // Keyboard activation only: pointer taps are handled on release.
          if (event.detail === 0) goToNext();
        }}
      >
        <span className='crown-control__ring' aria-hidden='true' />
        <span className='crown-control__hint' aria-hidden='true'>
          {crown.hint}
        </span>
      </button>
    </>
  );
}
