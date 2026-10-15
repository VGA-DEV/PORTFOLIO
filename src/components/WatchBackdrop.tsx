'use client';

import { useEffect, useRef, useState } from 'react';
import { CrownControl } from '@/components/CrownControl';
import { clamp01, lerp } from '@/lib/math';
import { NARROW_QUERY, REDUCED_QUERY } from '@/lib/media';
import { arrivedAt, setMove, setMoveLive, stillAt } from '@/lib/watch/move';
import { chooseCrownGoal, crownButtonSize, fitCrown } from '@/lib/watch/placement/crown';
import { deviceIsTooWeak } from '@/lib/watch/placement/device';
import { bindExcite } from '@/lib/watch/placement/excite';
import { calloutPath, chooseNoteSpot, noteWidth, rollLook, type NoteSpot } from '@/lib/watch/placement/note';
import { noteStateAt, watchPosition, type MoveState, type NoteState } from '@/lib/watch/placement/progress';
import { scanText } from '@/lib/watch/placement/scan';
import { squareAround, type Point, type Rect } from '@/lib/watch/placement/space';
import type { AnchorInfo, WatchScene } from '@/lib/watch/scene';

type WatchBackdropProps = {
  /** Black {VGA_DEV} logo for the dial and the case back. */
  logoUrl: string;
  /** One short text per page section: why that part of the watch tells that section. */
  notes: readonly string[];
  /** Accessible name of the crown control, and the hint shown beside it until it is used. */
  crown: { label: string; hint: string };
};

/** Notes and the crown re-think where to sit this often, in milliseconds. */
const RETHINK_MS = 140;

/**
 * A full-screen canvas fixed behind the page content. Its scene is the watch, which
 * moves to the piece each section is about as the page scrolls. A note, tied to that
 * piece by a line, explains why; it looks for free background to sit on, away from the
 * text and from the watch. The crown of the 3D watch is the page control; when the
 * watch puts it under the text, the control steps aside and stays tied to the crown.
 *
 * This component only wires the page to the scene. The rules (where a note sits, where the crown
 * control sits, how far along the watch is) live in `lib/watch/placement/`, the scene in `lib/watch/scene/`.
 */
export function WatchBackdrop({ logoUrl, notes, crown }: WatchBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef(logoUrl);
  const calloutRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLParagraphElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const tetherRef = useRef<SVGLineElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const crownRef = useRef<HTMLButtonElement>(null);
  const sceneHandle = useRef<WatchScene | null>(null);
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
    let sectionEls: HTMLElement[] = [];
    let look = rollLook();
    let noteState: NoteState | null = null;

    let text: Rect[] = [];
    let lastScan = -1e9;
    /** Root font size in px; on large screens the text scales, and the note's width with it. */
    let remPx = 16;
    let measured = { key: '', w: 0, h: 0 };
    let target: NoteSpot = { x: 0, y: 0, key: '' };
    let shown: Point | null = null;
    let crownGoal: Point | null = null;
    let crownShown: Point | null = null;
    let crownSize = 52;

    /** Move the real button over the 3D crown, or just beside it when the text covers it. */
    const placeCrown = (a: AnchorInfo, rethink: boolean, noteRect: Rect | null) => {
      const button = crownRef.current;
      if (!button) return;
      const size = crownButtonSize(a.crown.radius);
      const viewport = { w: window.innerWidth, h: window.innerHeight };
      const at = fitCrown(a.crown, size, viewport);
      if (rethink) crownGoal = chooseCrownGoal({ previous: crownGoal, at, size, viewport, text, noteRect });

      const goal = crownGoal ?? at;
      crownShown = crownShown
        ? { x: lerp(crownShown.x, goal.x, 0.3), y: lerp(crownShown.y, goal.y, 0.3) }
        : goal;
      crownSize = size;
      const p = crownShown;
      button.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`;
      button.style.width = button.style.height = `${size.toFixed(1)}px`;
      button.dataset.ready = 'true';
      // Where there is no room for the watch beside the text (one column: phones and touch tablets) the watch is
      // a background behind the text, the hero included, so there is no crown to turn: the control and its hint
      // are never shown there (they would only sit over the text).
      const behind = narrow.matches;
      button.dataset.behind = behind ? 'true' : 'false';
      // The hint sits to the right of the crown, or under it when the edge of the screen is too close (and then
      // pulled to that edge, so its text, about 180 px wide, is not cut off).
      const hintHalf = 95;
      button.dataset.hint =
        p.x + size / 2 + 170 <= viewport.w
          ? 'right'
          : p.x + hintHalf > viewport.w
            ? 'below-end'
            : p.x - hintHalf < 0
              ? 'below-start'
              : 'below';

      // A thin thread ties the stepped-aside control back to the crown it belongs to.
      const tether = tetherRef.current;
      if (tether) {
        const far = !behind && Math.hypot(p.x - a.crown.x, p.y - a.crown.y) > size * 0.8;
        tether.style.opacity = far ? '1' : '0';
        tether.setAttribute('x1', p.x.toFixed(1));
        tether.setAttribute('y1', p.y.toFixed(1));
        tether.setAttribute('x2', a.crown.x.toFixed(1));
        tether.setAttribute('y2', a.crown.y.toFixed(1));
      }
    };

    /** Called after every frame the scene draws: place the note, tie it to the part, and move the crown control. */
    const placeCallout = (a: AnchorInfo) => {
      const callout = calloutRef.current;
      const box = boxRef.current;
      const line = lineRef.current;
      const dot = dotRef.current;
      if (!callout || !box || !line || !dot) return;
      const now = performance.now();
      const rethink = now - lastScan > RETHINK_MS;
      if (rethink) {
        text = scanText(!narrow.matches);
        remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        lastScan = now;
      }

      setMove(a.position);
      const nearest = noteState ? noteState.index : Math.round(a.position);
      if (nearest !== indexRef.current) {
        indexRef.current = nearest;
        setIndex(nearest);
        const el = sectionEls[nearest];
        const light = !!el && !el.classList.contains('hero') && !el.classList.contains('section--stage');
        callout.dataset.tone = light ? 'paper' : 'stage';
        // The page knows whether it is on a dark section, for the soft light that follows the mouse.
        root.dataset.tone = light ? 'paper' : 'stage';
        if (crownRef.current) crownRef.current.dataset.tone = light ? 'paper' : 'stage';
        measured = { key: '', w: 0, h: 0 };
        look = rollLook();
        target = { x: target.x, y: target.y, key: '' };
      }
      // The note comes in only once the watch has moved on to its piece, like the content.
      const noteIn = noteState ? noteState.inn * arrivedAt(nearest) * stillAt(nearest) : 1;
      const settle = noteState ? (1 - noteState.out) * noteIn : clamp01(1.6 - Math.abs(a.position - nearest) * 4);
      const vw = window.innerWidth;
      const phone = narrow.matches;
      const w = noteWidth({
        phone,
        viewportW: vw,
        remPx,
        text,
        watchOnRight: sectionEls[nearest]?.dataset.side !== 'right',
      });

      const key = `${nearest}|${Math.round(w)}`;
      if (measured.key !== key) {
        callout.style.setProperty('--box-w', `${w.toFixed(0)}px`);
        measured = { key, w, h: box.offsetHeight };
      }
      // The text changes after the index does, so the height is read again on every think.
      if (rethink) measured.h = box.offsetHeight;
      const h = measured.h;

      if (rethink || target.key === '') {
        // The footer is an opaque band over the canvas: when it has scrolled into view, the notes stay above it.
        const footerTop = document.querySelector('.site-footer')?.getBoundingClientRect().top ?? Infinity;
        target = chooseNoteSpot({
          anchor: a,
          look,
          text,
          crownRect: crownShown ? squareAround(crownShown, crownSize) : null,
          w,
          h,
          current: target,
          viewport: { w: vw, h: Math.min(window.innerHeight, footerTop) },
          phone,
        });
      }
      shown = shown && Math.abs(shown.x - target.x) + Math.abs(shown.y - target.y) < 1200
        ? { x: lerp(shown.x, target.x, 0.18), y: lerp(shown.y, target.y, 0.18) }
        : { x: target.x, y: target.y };

      const noteRect: Rect = { l: shown.x, t: shown.y, r: shown.x + w, b: shown.y + h };
      const { d, edge } = calloutPath(a, noteRect, look);

      callout.dataset.edge = edge;
      callout.style.setProperty('--box-x', `${noteRect.l.toFixed(1)}px`);
      callout.style.setProperty('--box-y', `${noteRect.t.toFixed(1)}px`);
      callout.style.setProperty('--settle', settle.toFixed(3));
      callout.style.setProperty('--shift', `${(noteState ? -34 * noteState.out + 46 * (1 - noteIn) : 0).toFixed(1)}px`);
      line.setAttribute('d', d);
      dot.setAttribute('cx', a.x.toFixed(1));
      dot.setAttribute('cy', a.y.toFixed(1));

      placeCrown(a, rethink, noteRect);
      callout.dataset.hidden = narrow.matches ? 'true' : 'false';
    };

    const stop = () => {
      window.clearTimeout(startTimer);
      teardown?.();
      teardown = null;
      sceneHandle.current = null;
      setMoveLive(false);
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
      const footer = document.querySelector<HTMLElement>('.site-footer');
      sectionEls = sections;
      const gaps = Array.from(document.querySelectorAll<HTMLElement>('[data-gap]'));
      const moveState: MoveState[] = [];
      // Text on the left puts the watch on the right, and the other way round.
      const sides = sections.map((el) => (el.dataset.side === 'right' ? -1 : 1));

      try {
        scene = await sceneModule.createWatchScene({
          canvas,
          still: false,
          logoUrl: logoRef.current,
          sides,
          isWide: () => !narrow.matches,
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
      root.dataset.tone = 'stage'; // The page starts on the dark hero.
      setMoveLive(true);
      const cleanups: (() => void)[] = [];
      const current = scene;

      let frame = 0;
      const update = () => {
        frame = 0;
        const viewport = window.innerHeight;
        // The footer is an opaque band over the canvas. As it comes into view the scene is framed in the
        // space above it (without resizing the canvas, which would make the watch flicker), so the watch and
        // its miniature are not cut off.
        const footerTop = footer ? footer.getBoundingClientRect().top : viewport;
        current.setBottomInset(Math.max(viewport - footerTop, 0));
        const position = watchPosition(sections, gaps, viewport, moveState);
        current.setPosition(position);
        noteState = noteStateAt(gaps, viewport);
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
          root.style.setProperty('--watch-opacity', lerp(1, 0.25, clamp01(position * 1.6)).toFixed(3));
        } else {
          root.style.removeProperty('--watch-opacity');
        }
      };
      const onScroll = () => {
        if (!frame) frame = requestAnimationFrame(update);
      };
      update();
      window.addEventListener('scroll', onScroll, { passive: true });
      const onResize = () => {
        moveState.length = 0;
        onScroll();
      };
      window.addEventListener('resize', onResize, { passive: true });
      cleanups.push(() => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
        cancelAnimationFrame(frame);
      });

      cleanups.push(bindExcite(current, root));

      const sync = () => current.setRunning(!document.hidden);
      document.addEventListener('visibilitychange', sync);
      sync();
      cleanups.push(() => document.removeEventListener('visibilitychange', sync));

      const resizeObserver = new ResizeObserver(() => {
        measured = { key: '', w: 0, h: 0 };
        target = { x: 0, y: 0, key: '' };
        current.resize();
      });
      resizeObserver.observe(canvas.parentElement ?? canvas);
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
      <div className='callout' ref={calloutRef} aria-hidden='true' data-tone='stage' data-edge='top' data-empty={note ? undefined : 'true'}>
        <svg className='callout__line' aria-hidden='true' focusable='false'>
          <path ref={lineRef} pathLength='1' />
          <circle ref={dotRef} r='3.5' />
        </svg>
        <p className='callout__box' ref={boxRef}>
          {note}
        </p>
      </div>
      <svg className='crown-tether' aria-hidden='true' focusable='false'>
        <line ref={tetherRef} />
      </svg>
      <CrownControl buttonRef={crownRef} sceneRef={sceneHandle} label={crown.label} hint={crown.hint} />
    </>
  );
}
