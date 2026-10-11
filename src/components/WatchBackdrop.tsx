'use client';

import { useEffect, useRef, useState } from 'react';
import type { AnchorInfo, WatchScene } from '@/lib/watch/scene';

type WatchBackdropProps = {
  /** Black {VGA_DEV} logo for the dial and the case back. */
  logoUrl: string;
  /** One short text per page section: why that part of the watch tells that section. */
  notes: readonly string[];
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
 * A full-screen canvas fixed behind the page content. Its scene is the watch, which
 * moves to the piece each section is about as the page scrolls. A text callout, tied
 * to that piece by a line, explains why. On phones the watch sits fainter behind the text.
 */
export function WatchBackdrop({ logoUrl, notes }: WatchBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef(logoUrl);
  const calloutRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLParagraphElement>(null);
  const lineRef = useRef<SVGPolylineElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);

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
    let lastScrollY = window.scrollY;
    let sides: number[] = [];

    /** Tie the text box to the part: a dot on the part, a line down to the box. */
    const placeCallout = (a: AnchorInfo) => {
      const callout = calloutRef.current;
      const box = boxRef.current;
      const line = lineRef.current;
      const dot = dotRef.current;
      if (!callout || !box || !line || !dot) return;

      const nearest = Math.round(a.position);
      if (nearest !== indexRef.current) {
        indexRef.current = nearest;
        setIndex(nearest);
      }
      // Visible only while the watch rests on a piece, not during the jump between two.
      const settle = clamp01(1.6 - Math.abs(a.position - nearest) * 4);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const boxWidth = box.offsetWidth || 320;
      // Wide screens: the box stays on the watch's side, clear of the text column.
      let low = boxWidth / 2 + 14;
      let high = vw - boxWidth / 2 - 14;
      if (!narrow.matches) {
        if ((sides[nearest] ?? 1) > 0) low = Math.max(low, vw * 0.58 + boxWidth / 2);
        else high = Math.min(high, vw * 0.42 - boxWidth / 2);
      }
      const boxX = Math.min(Math.max(a.centreX, low), Math.max(low, high));
      // Phones: a compact strip at the foot of the screen, so it covers as little text as possible.
      const boxY = narrow.matches ? vh - (box.offsetHeight || 80) - 18 : vh * 0.78;

      callout.style.setProperty('--box-x', `${boxX.toFixed(1)}px`);
      callout.style.setProperty('--box-y', `${boxY.toFixed(1)}px`);
      callout.style.setProperty('--settle', settle.toFixed(3));
      line.setAttribute('points', `${a.x.toFixed(1)},${a.y.toFixed(1)} ${boxX.toFixed(1)},${boxY.toFixed(1)}`);
      dot.setAttribute('cx', a.x.toFixed(1));
      dot.setAttribute('cy', a.y.toFixed(1));
    };

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
        root.dataset.watch = 'flat';
        return;
      }
      if (!alive || scene) return;

      const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-watch-section]'));
      // Text on the left puts the watch on the right, and the other way round.
      sides = sections.map((el) => (el.dataset.side === 'right' ? -1 : 1));

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
          onAnchor: placeCallout,
        });
      } catch {
        root.dataset.watch = 'flat'; // No WebGL2: the flat SVG watch is the whole visual.
        return;
      }
      if (!alive) {
        scene.dispose();
        scene = null;
        return;
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
        // The crown on the watch turns with the page, like the one on the screen's edge.
        const y = window.scrollY;
        current.spinCrown((y - lastScrollY) * 0.006);
        lastScrollY = y;
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

  const note = notes[index] ?? '';

  return (
    <>
      <div className='watch-bg' aria-hidden='true'>
        <canvas className='watch-bg__canvas' ref={canvasRef} />
      </div>
      <div className='callout' ref={calloutRef} data-empty={note ? undefined : 'true'}>
        <svg className='callout__line' aria-hidden='true' focusable='false'>
          <polyline ref={lineRef} pathLength='1' />
          <circle ref={dotRef} r='4' />
        </svg>
        <p className='callout__box' ref={boxRef}>
          {note}
        </p>
      </div>
    </>
  );
}
