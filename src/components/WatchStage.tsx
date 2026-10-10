'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { WatchScene } from '@/lib/watch/scene';

type WatchStageProps = {
  /** One caption per page section; an empty string shows none. */
  captions: readonly string[];
  /** Lines engraved on the case back. */
  engraving: readonly string[];
  children: ReactNode;
};

/** 3D only on large screens with a precise pointer, WebGL2 and no data saver. */
const ENHANCE_QUERY = '(min-width: 62rem) and (pointer: fine)';
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

export function WatchStage({ captions, engraving, children }: WatchStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [caption, setCaption] = useState(0);

  // Local time drives the SVG hands; the 3D scene reads the clock itself.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const tick = () => {
      const now = new Date();
      const seconds = now.getSeconds();
      const minutes = now.getMinutes() + seconds / 60;
      const hours = (now.getHours() % 12) + minutes / 60;
      stage.style.setProperty('--hour-angle', `${hours * 30}deg`);
      stage.style.setProperty('--minute-angle', `${minutes * 6}deg`);
      stage.style.setProperty('--second-angle', `${seconds * 6}deg`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Progressive enhancement: the WebGL scene, created and torn down with the viewport.
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

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
      delete stage.dataset.mode;
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

      try {
        scene = sceneModule.createWatchScene({
          canvas,
          still: reduced.matches,
          engraving,
        });
      } catch {
        return; // No WebGL2: the SVG stays as the complete visual.
      }
      stage.dataset.mode = '3d';
      const cleanups: (() => void)[] = [];
      const current = scene;

      if (!reduced.matches) {
        const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-watch-section]'));
        let frame = 0;
        const update = () => {
          frame = 0;
          const viewport = window.innerHeight;
          // Each boundary between two sections is crossed as the next one's top
          // travels from 80% to 30% of the viewport height.
          let position = 0;
          for (let i = 1; i < sections.length; i++) {
            const top = sections[i].getBoundingClientRect().top;
            position += clamp01((viewport * 0.8 - top) / (viewport * 0.5));
          }
          current.setPosition(position);
          const index = Math.round(position);
          setCaption((prev) => (prev === index ? prev : index));
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

        let visible = true;
        const sync = () => current.setRunning(visible && !document.hidden);
        const observer = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          sync();
        });
        observer.observe(stage);
        document.addEventListener('visibilitychange', sync);
        sync();
        cleanups.push(() => {
          observer.disconnect();
          document.removeEventListener('visibilitychange', sync);
        });
      }

      const resizeObserver = new ResizeObserver(() => current.resize());
      if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
      cleanups.push(() => resizeObserver.disconnect());

      teardown = () => cleanups.forEach((fn) => fn());
    };

    // Never compete with the first paint: wait for the load event, then a short beat.
    const schedule = () => {
      if (!alive || !enhance.matches || connection?.saveData || scene) return;
      window.clearTimeout(startTimer);
      startTimer = window.setTimeout(() => void start(), 600);
    };

    const onViewportChange = () => {
      if (enhance.matches) schedule();
      else {
        stop();
        setCaption(0);
      }
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
  }, [engraving]);

  const label = captions[caption] ?? '';

  return (
    <div className='watch' ref={stageRef}>
      <div className='watch__figure' aria-hidden='true'>
        {children}
        <canvas className='watch__canvas' ref={canvasRef} />
        {label ? (
          <p className='watch__caption' key={caption}>
            {label}
          </p>
        ) : null}
      </div>
    </div>
  );
}
