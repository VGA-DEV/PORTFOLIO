'use client';

import { useEffect, useRef, useState } from 'react';
import type { AnchorInfo, WatchScene } from '@/lib/watch/scene';

type WatchBackdropProps = {
  /** Black {VGA_DEV} logo for the dial and the case back. */
  logoUrl: string;
  /** One short text per page section: why that part of the watch tells that section. */
  notes: readonly string[];
  /** Accessible name of the crown control, and the hint shown beside it until it is used. */
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
 * A full-screen canvas fixed behind the page content. Its scene is the watch, which
 * moves to the piece each section is about as the page scrolls. A text callout, tied
 * to that piece by a bent line, explains why. The crown of the 3D watch is the page
 * control. On phones the watch sits fainter behind the text.
 */
export function WatchBackdrop({ logoUrl, notes, crown }: WatchBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef(logoUrl);
  const calloutRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLParagraphElement>(null);
  const lineRef = useRef<SVGPolylineElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const crownRef = useRef<HTMLButtonElement>(null);
  const sceneHandle = useRef<WatchScene | null>(null);
  const drag = useRef({ active: false, moved: 0, lastY: 0 });
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
    let sectionEls: HTMLElement[] = [];
    let measured = { key: '', height: 0 };

    /** Keep the real button exactly over the 3D crown. */
    const placeCrown = (c: AnchorInfo['crown']) => {
      const button = crownRef.current;
      if (!button) return;
      const size = Math.max(c.radius * 3.4, 64);
      const x = Math.min(Math.max(c.x, size / 2), window.innerWidth - size / 2);
      const y = Math.min(Math.max(c.y, 76 + size / 2), window.innerHeight - size / 2);
      button.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      button.style.width = button.style.height = `${size.toFixed(1)}px`;
      button.dataset.ready = 'true';
    };

    /**
     * Tie the text to the part: a dot on the part, a diagonal down to a knee, then a
     * rule that runs outward along the top of the text, like a note on a technical drawing.
     */
    const placeCallout = (a: AnchorInfo) => {
      placeCrown(a.crown);
      const callout = calloutRef.current;
      const text = boxRef.current;
      const line = lineRef.current;
      const dot = dotRef.current;
      if (!callout || !text || !line || !dot) return;

      const nearest = Math.round(a.position);
      if (nearest !== indexRef.current) {
        indexRef.current = nearest;
        setIndex(nearest);
        const el = sectionEls[nearest];
        callout.dataset.tone = el && el.classList.contains('section--paper') ? 'paper' : 'stage';
      }
      // Visible only while the watch rests on a piece, not during the jump between two.
      const settle = clamp01(1.6 - Math.abs(a.position - nearest) * 4);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const phone = narrow.matches;
      const margin = 14;
      // On wide screens the note stays on the watch's side, clear of the text column.
      let lo = margin;
      let hi = vw - margin;
      if (!phone) {
        if ((sides[nearest] ?? 1) > 0) lo = vw * 0.58;
        else hi = vw * 0.42;
      }
      const width = Math.min(phone ? 21 * 16 : 24 * 16, hi - lo);

      // Measure the text only when its width or words change, not every frame.
      const key = `${nearest}|${Math.round(width)}`;
      if (measured.key !== key) {
        callout.style.setProperty('--box-w', `${width.toFixed(0)}px`);
        measured = { key, height: text.offsetHeight };
      }
      const top = phone ? vh - measured.height - 18 : Math.min(vh * 0.72, vh - measured.height - 24);
      const drop = Math.max(top - a.y, 40);
      // The line leaves the part at 60 degrees and turns 120 at the knee, to run
      // along the top of the note the other way.
      const run = drop / Math.tan(Math.PI / 3);
      let along = a.x - run + width <= hi ? 1 : -1;
      if (along < 0 && a.x + run - width < lo) along = 1;
      const kneeX =
        along > 0
          ? Math.min(Math.max(a.x - run, lo), hi - width)
          : Math.max(Math.min(a.x + run, hi), lo + width);
      const farX = kneeX + along * width;

      callout.style.setProperty('--box-x', `${Math.min(kneeX, farX).toFixed(1)}px`);
      callout.style.setProperty('--box-y', `${top.toFixed(1)}px`);
      callout.style.setProperty('--settle', settle.toFixed(3));
      line.setAttribute(
        'points',
        `${a.x.toFixed(1)},${a.y.toFixed(1)} ${kneeX.toFixed(1)},${top.toFixed(1)} ${farX.toFixed(1)},${top.toFixed(1)}`,
      );
      dot.setAttribute('cx', a.x.toFixed(1));
      dot.setAttribute('cy', a.y.toFixed(1));
    };

    const stop = () => {
      window.clearTimeout(startTimer);
      teardown?.();
      teardown = null;
      sceneHandle.current = null;
      if (crownRef.current) delete crownRef.current.dataset.ready;
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
      sectionEls = sections;
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
      sceneHandle.current = scene;
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
        // The crown on the watch turns with the page.
        const y = window.scrollY;
        current.spinCrown((y - lastScrollY) * 0.006);
        lastScrollY = y;
        const button = crownRef.current;
        if (button) {
          const max = document.documentElement.scrollHeight - viewport;
          button.style.setProperty('--progress', clamp01(max > 0 ? y / max : 0).toFixed(4));
          button.style.setProperty('--turn', `${(y * 0.3).toFixed(1)}deg`);
          if (y > 240) button.dataset.used = 'true';
        }
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

      const resizeObserver = new ResizeObserver(() => {
        measured = { key: '', height: 0 };
        current.resize();
      });
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

  // Winding the crown: dragging it scrolls the page, a tap moves to the next section.
  const goToNext = () => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-watch-section]'));
    const line = window.innerHeight * 0.4;
    const next = sections.find((section) => section.getBoundingClientRect().top > line);
    if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    sceneHandle.current?.spinCrown(Math.PI * 2);
  };

  return (
    <>
      <div className='watch-bg' aria-hidden='true'>
        <canvas className='watch-bg__canvas' ref={canvasRef} />
      </div>
      <div className='callout' ref={calloutRef} data-tone='stage' data-empty={note ? undefined : 'true'}>
        <svg className='callout__line' aria-hidden='true' focusable='false'>
          <polyline ref={lineRef} pathLength='1' />
          <circle ref={dotRef} r='3.5' />
        </svg>
        <p className='callout__box' ref={boxRef}>
          {note}
        </p>
      </div>
      <button
        type='button'
        className='crown-control'
        ref={crownRef}
        aria-label={crown.label}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { active: true, moved: 0, lastY: event.clientY };
          event.currentTarget.dataset.held = 'true';
        }}
        onPointerMove={(event) => {
          if (!drag.current.active) return;
          const dy = event.clientY - drag.current.lastY;
          drag.current.lastY = event.clientY;
          drag.current.moved += Math.abs(dy);
          if (drag.current.moved > 4) {
            window.scrollBy({ top: dy * 2.4, behavior: 'instant' });
            sceneHandle.current?.spinCrown(dy * 0.05);
          }
        }}
        onPointerUp={(event) => {
          const wasTap = drag.current.active && drag.current.moved <= 4;
          drag.current.active = false;
          delete event.currentTarget.dataset.held;
          if (wasTap) goToNext();
        }}
        onPointerCancel={(event) => {
          drag.current.active = false;
          delete event.currentTarget.dataset.held;
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const down = event.key === 'ArrowDown';
            window.scrollBy({ top: (down ? 1 : -1) * window.innerHeight * 0.6, behavior: 'smooth' });
            sceneHandle.current?.spinCrown(down ? 0.8 : -0.8);
          }
        }}
        onClick={(event) => {
          // Keyboard activation only: pointer taps are handled on release.
          if (event.detail === 0) goToNext();
        }}
      >
        <svg className='crown-control__progress' viewBox='0 0 100 100' aria-hidden='true' focusable='false'>
          <circle className='crown-control__track' cx='50' cy='50' r='46' />
          <circle className='crown-control__fill' cx='50' cy='50' r='46' pathLength='1' />
        </svg>
        <span className='crown-control__ticks' aria-hidden='true' />
        <span className='crown-control__hint' aria-hidden='true'>
          {crown.hint}
        </span>
      </button>
    </>
  );
}
