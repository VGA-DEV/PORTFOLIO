'use client';

import { useEffect, useRef } from 'react';
import type { WatchScene } from '@/lib/watch/scene';

type WatchBackdropProps = {
  /** Lines engraved on the case back. */
  engraving: readonly string[];
  /** Black {VGA_DEV} logo for the dial and the case back. */
  logoUrl: string;
};

/** 3D only on large screens with a precise pointer, WebGL2 and no data saver. */
const ENHANCE_QUERY = '(min-width: 62rem) and (pointer: fine)';
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/**
 * A full-screen canvas fixed behind the page content. Its scene is the watch,
 * which moves between the pieces each section is about as the page scrolls.
 */
export function WatchBackdrop({ engraving, logoUrl }: WatchBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engravingRef = useRef(engraving);
  const logoRef = useRef(logoUrl);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const root = document.documentElement;

    const enhance = window.matchMedia(ENHANCE_QUERY);
    const reduced = window.matchMedia(REDUCED_QUERY);
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;

    let alive = true;
    let startTimer = 0;
    let scene: WatchScene | null = null;
    let teardown: (() => void) | null = null;

    const stop = () => {
      window.clearTimeout(startTimer);
      teardown?.();
      teardown = null;
      scene?.dispose();
      scene = null;
      delete root.dataset.watch;
    };

    const start = async () => {
      let sceneModule: typeof import('@/lib/watch/scene');
      try {
        sceneModule = await import('@/lib/watch/scene');
      } catch {
        return;
      }
      // The viewport may have changed while the chunk was loading.
      if (!alive || !enhance.matches || scene) return;

      const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-watch-section]'));
      // Text on the left puts the watch on the right, and the other way round.
      const sides = sections.map((el) => (el.dataset.side === 'right' ? -1 : 1));

      try {
        scene = sceneModule.createWatchScene({
          canvas,
          still: false,
          engraving: engravingRef.current,
          logoUrl: logoRef.current,
          sides,
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

    // Never compete with the first paint: wait for the load event, then a short beat.
    const schedule = () => {
      if (!alive || !enhance.matches || reduced.matches || connection?.saveData || scene) return;
      window.clearTimeout(startTimer);
      startTimer = window.setTimeout(() => void start(), 600);
    };

    const onViewportChange = () => {
      if (enhance.matches) schedule();
      else stop();
    };

    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    enhance.addEventListener('change', onViewportChange);

    return () => {
      alive = false;
      window.removeEventListener('load', schedule);
      enhance.removeEventListener('change', onViewportChange);
      stop();
    };
  }, []);

  return (
    <div className='watch-bg' aria-hidden='true'>
      <canvas className='watch-bg__canvas' ref={canvasRef} />
    </div>
  );
}
