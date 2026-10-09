'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { WatchScene, WatchTime } from '@/lib/watch/scene';

type WatchStageProps = {
  madridLabel: string;
  dublinLabel: string;
  children: ReactNode;
};

const ZONES = { madrid: 'Europe/Madrid', dublin: 'Europe/Dublin' } as const;

/** 3D only on large screens with a precise pointer, WebGL2 and no data saver. */
const ENHANCE_QUERY = '(min-width: 62rem) and (pointer: fine)';
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const STILL_PROGRESS = 0.55;

function zoneTime(timeZone: string, now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { hour, minute };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function WatchStage({ madridLabel, dublinLabel, children }: WatchStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<WatchScene | null>(null);
  const timeRef = useRef<WatchTime | null>(null);
  const [readout, setReadout] = useState<{ madrid: string; dublin: string } | null>(null);

  // Real time in both zones: drives the SVG hands, the 3D hands and the readout.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const tick = () => {
      const now = new Date();
      const madrid = zoneTime(ZONES.madrid, now);
      const dublin = zoneTime(ZONES.dublin, now);
      const hourAngle = (h: number, m: number) => ((h % 12) + m / 60) * 30;
      stage.style.setProperty('--madrid-hour', `${hourAngle(madrid.hour, madrid.minute)}deg`);
      stage.style.setProperty('--madrid-minute', `${madrid.minute * 6}deg`);
      stage.style.setProperty('--dublin-hour', `${hourAngle(dublin.hour, madrid.minute)}deg`);
      setReadout({
        madrid: `${pad(madrid.hour)}:${pad(madrid.minute)}`,
        dublin: `${pad(dublin.hour)}:${pad(dublin.minute)}`,
      });
      const time: WatchTime = {
        madridHour: madrid.hour,
        madridMinute: madrid.minute,
        dublinHour: dublin.hour,
      };
      timeRef.current = time;
      sceneRef.current?.setTime(time);
    };

    tick();
    const id = window.setInterval(tick, 10_000);
    return () => window.clearInterval(id);
  }, []);

  // Progressive enhancement: the WebGL scene.
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const enhance = window.matchMedia(ENHANCE_QUERY);
    const reduced = window.matchMedia(REDUCED_QUERY);
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (!enhance.matches || connection?.saveData) return;

    const hero = stage.closest<HTMLElement>('[data-hero]');
    let cancelled = false;
    let scene: WatchScene | null = null;
    let cleanup: (() => void) | null = null;
    let idleHandle = 0;

    const start = async () => {
      let sceneModule: typeof import('@/lib/watch/scene');
      try {
        sceneModule = await import('@/lib/watch/scene');
      } catch {
        return;
      }
      if (cancelled) return;

      try {
        scene = sceneModule.createWatchScene({
          canvas,
          still: reduced.matches,
          stillProgress: STILL_PROGRESS,
        });
      } catch {
        return; // No WebGL2: the SVG stays as the complete visual.
      }
      sceneRef.current = scene;
      if (timeRef.current) scene.setTime(timeRef.current);
      stage.dataset.mode = '3d';

      const cleanups: (() => void)[] = [];

      if (reduced.matches) {
        hero?.style.setProperty('--explode', '1');
      } else if (hero) {
        let frame = 0;
        const update = () => {
          frame = 0;
          const rect = hero.getBoundingClientRect();
          const runway = rect.height - window.innerHeight;
          const p = runway > 0 ? Math.min(Math.max(-rect.top / runway, 0), 1) : 0;
          scene?.setProgress(p);
          hero.style.setProperty('--explode', p.toFixed(3));
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
        const sync = () => scene?.setRunning(visible && !document.hidden);
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

      const resizeObserver = new ResizeObserver(() => scene?.resize());
      if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
      cleanups.push(() => resizeObserver.disconnect());

      cleanup = () => cleanups.forEach((fn) => fn());
    };

    // Never compete with the first paint: wait for the load event, then a short beat.
    const schedule = () => {
      if (cancelled) return;
      idleHandle = window.setTimeout(() => void start(), 600);
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', schedule);
      window.clearTimeout(idleHandle);
      cleanup?.();
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div className='watch' ref={stageRef}>
      <div className='watch__figure' aria-hidden='true'>
        {children}
        <canvas className='watch__canvas' ref={canvasRef} />
      </div>
      <p className='watch__zones'>
        <span>
          {madridLabel} <time>{readout?.madrid ?? '--:--'}</time>
        </span>
        <span>
          {dublinLabel} <time>{readout?.dublin ?? '--:--'}</time>
        </span>
      </p>
    </div>
  );
}
