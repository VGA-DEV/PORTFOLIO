'use client';

import { useEffect, useRef } from 'react';
import type { WatchScene } from '@/lib/watch/scene';

type WatchBackdropProps = {
  /** Black {VGA_DEV} logo for the dial and the case back. */
  logoUrl: string;
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
export function WatchBackdrop({ logoUrl }: WatchBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    const triggers: (() => void)[] = [];

    const stop = () => {
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
        scene = sceneModule.createWatchScene({
          canvas,
          still: false,
          logoUrl: logoRef.current,
          sides,
          heroAnchor,
        });
      } catch {
        return; // No WebGL2: the flat SVG watch stays as the complete visual.
      }
      root.dataset.watch = '3d';
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

    // Never compete with the first paint. Desktop: right after the load event.
    // Phones: on the first touch or scroll, or after a few seconds, so the flat
    // watch (the LCP) is never slowed down.
    const schedule = () => {
      if (!alive || reduced.matches || deviceIsTooWeak() || scene) return;
      window.clearTimeout(startTimer);
      if (!narrow.matches) {
        startTimer = window.setTimeout(() => void start(), 600);
        return;
      }
      const go = () => {
        triggers.splice(0).forEach((fn) => fn());
        window.clearTimeout(startTimer);
        void start();
      };
      for (const type of ['scroll', 'touchstart', 'pointerdown'] as const) {
        window.addEventListener(type, go, { once: true, passive: true });
        triggers.push(() => window.removeEventListener(type, go));
      }
      startTimer = window.setTimeout(go, 4000);
    };

    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });

    return () => {
      alive = false;
      window.removeEventListener('load', schedule);
      triggers.splice(0).forEach((fn) => fn());
      stop();
    };
  }, []);

  return (
    <div className='watch-bg' aria-hidden='true'>
      <canvas className='watch-bg__canvas' ref={canvasRef} />
    </div>
  );
}
