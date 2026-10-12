'use client';

import { useEffect, useRef, useState } from 'react';
import { MOVE_AT, MOVE_BACK_AT, SWAP_AT, arriveProgress, dwellProgress, leaveProgress } from '@/lib/transition';
import { arrivedAt, setMove, setMoveLive, stillAt } from '@/lib/watch/move';
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
/** Anything but the two-column layout (text beside the watch): the page is one column and the watch sits behind the text. */
const NARROW_QUERY = 'not all and (min-width: 62rem) and (pointer: fine)';
/** Notes and the crown re-think where to sit this often, in milliseconds. */
const RETHINK_MS = 140;
const HEADER = 84;
const MARGIN = 14;

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Every time the watch settles on a section the note draws a fresh look: where it likes to sit and how its line bends. */
const rollLook = () => ({
  /** Which side of the watch the note likes to sit on, as an angle round it. */
  phi: Math.random() * Math.PI * 2,
  hookAngle: ((35 + Math.random() * 45) * Math.PI) / 180,
  sideAngle: ((25 + Math.random() * 35) * Math.PI) / 180,
  curved: Math.random() < 0.4,
  bow: Math.random() < 0.5 ? 1 : -1,
});

type Rect = { l: number; t: number; r: number; b: number };

const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

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
 * The safe areas notes and the crown keep out of: on wide screens, the column each
 * section's content sits in, whole, however its lines happen to wrap; on a phone,
 * where the text fills the width, the line boxes themselves.
 */
function scanText(wide: boolean): Rect[] {
  const vh = window.innerHeight;
  const out: Rect[] = [];
  if (wide) {
    const pad = 14;
    document.querySelectorAll<HTMLElement>('[data-watch-section] :is(.section__body, .hero__text)').forEach((el) => {
      if (el.closest<HTMLElement>('.pin')?.style.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.bottom > 0 && r.top < vh) {
        out.push({ l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad });
      }
    });
    return out;
  }
  const pad = 6;
  const range = document.createRange();
  document
    .querySelectorAll<HTMLElement>('[data-watch-section] :is(h1, h2, h3, p, li, dt, dd)')
    .forEach((el) => {
      const box = el.getBoundingClientRect();
      if (box.bottom < 0 || box.top > vh) return;
      range.selectNodeContents(el);
      for (const r of range.getClientRects()) {
        if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh) {
          out.push({ l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad });
        }
      }
    });
  return out;
}

/**
 * A full-screen canvas fixed behind the page content. Its scene is the watch, which
 * moves to the piece each section is about as the page scrolls. A note, tied to that
 * piece by a line, explains why; it looks for free background to sit on, away from the
 * text and from the watch. The crown of the 3D watch is the page control; when the
 * watch puts it under the text, the control steps aside and stays tied to the crown.
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
  const drag = useRef({ active: false, moved: 0, lastY: 0, over: 0 });
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
    /** Which note is up, and how far in or out it is, read from the scroll through the dwells. */
    let noteState: { index: number; out: number; inn: number } | null = null;

    let text: Rect[] = [];
    let lastScan = -1e9;
    let measured = { key: '', w: 0, h: 0 };
    let target = { x: 0, y: 0, key: '' };
    let shown: { x: number; y: number } | null = null;
    let crownGoal: { x: number; y: number } | null = null;
    let crownShown: { x: number; y: number } | null = null;
    let crownSize = 52;

    /** How bad a place is for a note: overlap with text, the watch and the crown, and distance. */
    const boxCost = (box: Rect, a: AnchorInfo, crownRect: Rect | null) => {
      const model: Rect = {
        l: a.model.x - a.model.halfW,
        r: a.model.x + a.model.halfW,
        t: a.model.y - a.model.halfH,
        b: a.model.y + a.model.halfH,
      };
      let cost = overlap(box, model) * 1.6;
      // Over the text is worse than over the watch: it hides what is being read.
      for (const r of text) cost += overlap(box, r) * 5;
      if (crownRect) cost += overlap(box, crownRect) * 3;
      const dx = (box.l + box.r) / 2 - a.x;
      const dy = (box.t + box.b) / 2 - a.y;
      // Stay close to the watch, on the side this look prefers.
      const gapX = Math.max(0, box.l - model.r, model.l - box.r);
      const gapY = Math.max(0, box.t - model.b, model.t - box.b);
      const wx = (box.l + box.r) / 2 - (a.model.x + Math.cos(look.phi) * (a.model.halfW + (box.r - box.l) / 2 + 20));
      const wy = (box.t + box.b) / 2 - (a.model.y + Math.sin(look.phi) * (a.model.halfH + (box.b - box.t) / 2 + 20));
      return cost + Math.hypot(dx, dy) * 6 + Math.hypot(gapX, gapY) * 45 + Math.hypot(wx, wy) * 22;
    };

    /** Look for the freest background around, and keep the choice unless a clearly better one appears. */
    const thinkNote = (a: AnchorInfo, w: number, h: number, crownRect: Rect | null) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (narrow.matches) {
        target = { x: (vw - w) / 2, y: vh - h - 18, key: 'phone' };
        return;
      }
      let best = { x: target.x, y: target.y, cost: Infinity, key: target.key };
      const xs = 8;
      const ys = 9;
      for (let i = 0; i <= xs; i++) {
        for (let j = 0; j <= ys; j++) {
          const x = MARGIN + ((vw - 2 * MARGIN - w) * i) / xs;
          const y = HEADER + ((vh - HEADER - MARGIN - h) * j) / ys;
          const cost = boxCost({ l: x, t: y, r: x + w, b: y + h }, a, crownRect);
          if (cost < best.cost) best = { x, y, cost, key: `${i}:${j}` };
        }
      }
      const current = boxCost({ l: target.x, t: target.y, r: target.x + w, b: target.y + h }, a, crownRect);
      if (target.key === '' || best.cost < current * 0.7 - 500) target = { x: best.x, y: best.y, key: best.key };
    };

    /** Move the real button over the 3D crown, or just beside it when the text covers it. */
    const placeCrown = (a: AnchorInfo, rethink: boolean, boxRect: Rect | null) => {
      const button = crownRef.current;
      if (!button) return;
      const size = Math.max(a.crown.radius * 2.6, 52);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const fit = (x: number, y: number) => ({
        x: Math.min(Math.max(x, size / 2 + 4), vw - size / 2 - 4),
        y: Math.min(Math.max(y, HEADER + size / 2), vh - size / 2 - 4),
      });
      const at = fit(a.crown.x, a.crown.y);
      const rectAt = (p: { x: number; y: number }): Rect => ({
        l: p.x - size / 2,
        r: p.x + size / 2,
        t: p.y - size / 2,
        b: p.y + size / 2,
      });
      const spotCost = (p: { x: number; y: number }) => {
        const rect = rectAt(p);
        let cost = 0;
        for (const r of text) cost += overlap(rect, r);
        if (boxRect) cost += overlap(rect, boxRect) * 3;
        return cost;
      };

      if (rethink) {
        const free = size * size * 0.02;
        const reach = size * 3;
        const stillGood =
          crownGoal !== null &&
          Math.hypot(crownGoal.x - at.x, crownGoal.y - at.y) < reach &&
          spotCost(crownGoal) <= free;
        if (spotCost(at) <= free) {
          crownGoal = null;
        } else if (!stillGood) {
          let best = { p: at, cost: Infinity };
          for (const radius of [size * 0.9, size * 1.5, size * 2.2, size * 3, size * 4]) {
            for (let k = 0; k < 20; k++) {
              const angle = (k / 20) * Math.PI * 2;
              const p = fit(at.x + Math.cos(angle) * radius, at.y + Math.sin(angle) * radius);
              const cost = spotCost(p) * 4 + Math.hypot(p.x - at.x, p.y - at.y) * 12;
              if (cost < best.cost) best = { p, cost };
            }
          }
          crownGoal = best.p;
        }
      }

      const goal = crownGoal ?? at;
      crownShown = crownShown
        ? { x: lerp(crownShown.x, goal.x, 0.3), y: lerp(crownShown.y, goal.y, 0.3) }
        : goal;
      crownSize = size;
      const p = crownShown;
      button.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`;
      button.style.width = button.style.height = `${size.toFixed(1)}px`;
      button.dataset.ready = 'true';

      // A thin thread ties the stepped-aside control back to the crown it belongs to.
      const tether = tetherRef.current;
      if (tether) {
        const far = Math.hypot(p.x - a.crown.x, p.y - a.crown.y) > size * 0.8;
        tether.style.opacity = far ? '1' : '0';
        tether.setAttribute('x1', p.x.toFixed(1));
        tether.setAttribute('y1', p.y.toFixed(1));
        tether.setAttribute('x2', a.crown.x.toFixed(1));
        tether.setAttribute('y2', a.crown.y.toFixed(1));
      }
    };

    /**
     * Tie the note to the part. Above or below it the line leaves the part at 60 degrees
     * and turns at the knee to run along the note's edge; to one side it leaves at 45
     * degrees and meets the note's edge, which then carries the rule.
     */
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
      // On wide screens the note takes the free strip beside the content column, however narrow.
      let free = vw - 2 * MARGIN;
      if (!phone && text.length > 0) {
        const textLeft = Math.min(...text.map((r) => r.l));
        const textRight = Math.max(...text.map((r) => r.r));
        const watchRight = sectionEls[nearest]?.dataset.side !== 'right';
        const beside = watchRight ? textLeft - 2 * MARGIN : vw - textRight - 2 * MARGIN;
        if (beside > 0) free = Math.min(free, Math.max(beside, 200));
      }
      const w = Math.min(phone ? 20 * 16 : 22 * 16, free);

      const key = `${nearest}|${Math.round(w)}`;
      if (measured.key !== key) {
        callout.style.setProperty('--box-w', `${w.toFixed(0)}px`);
        measured = { key, w, h: box.offsetHeight };
      }
      const h = measured.h;

      const crownRect: Rect | null = crownShown
        ? {
            l: crownShown.x - crownSize / 2,
            r: crownShown.x + crownSize / 2,
            t: crownShown.y - crownSize / 2,
            b: crownShown.y + crownSize / 2,
          }
        : null;
      if (rethink || target.key === '') thinkNote(a, w, h, crownRect);
      shown = shown && Math.abs(shown.x - target.x) + Math.abs(shown.y - target.y) < 1200
        ? { x: lerp(shown.x, target.x, 0.18), y: lerp(shown.y, target.y, 0.18) }
        : { x: target.x, y: target.y };

      const L = shown.x;
      const T = shown.y;
      const R = L + w;
      const B = T + h;
      const bcx = (L + R) / 2;
      const bcy = (T + B) / 2;
      const f = (n: number) => n.toFixed(1);
      // The first leg of the line is straight, or bows a little to one side.
      const leg = (x1: number, y1: number, x2: number, y2: number) => {
        if (!look.curved) return `L${f(x2)},${f(y2)}`;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const bow = Math.hypot(x2 - x1, y2 - y1) * 0.22 * look.bow;
        const nx = -(y2 - y1) / (Math.hypot(x2 - x1, y2 - y1) || 1);
        const ny = (x2 - x1) / (Math.hypot(x2 - x1, y2 - y1) || 1);
        return `Q${f(mx + nx * bow)},${f(my + ny * bow)} ${f(x2)},${f(y2)}`;
      };
      let d: string;
      let edge: 'top' | 'bottom' | 'left' | 'right';

      if (bcx - w / 2 > a.x + 24 || bcx + w / 2 < a.x - 24) {
        const dirx = bcx > a.x ? 1 : -1;
        const edgeX = dirx > 0 ? L : R;
        const attachY = T + 14;
        const dy = attachY - a.y;
        let kneeX = a.x + dirx * (Math.abs(dy) / Math.tan(look.sideAngle));
        if (dirx * (edgeX - kneeX) < 10) kneeX = edgeX - dirx * 10;
        d = `M${f(a.x)},${f(a.y)} ${leg(a.x, a.y, kneeX, attachY)} L${f(edgeX)},${f(attachY)} L${f(edgeX)},${f(B)}`;
        edge = dirx > 0 ? 'left' : 'right';
      } else {
        const below = bcy > a.y;
        const edgeY = below ? T : B;
        const dy = Math.max(Math.abs(edgeY - a.y), 24);
        const angleTo = (end: number) => Math.atan2(dy, Math.max(Math.abs(a.x - end), 1));
        const kneeAtLeft = Math.abs(angleTo(L) - look.hookAngle) < Math.abs(angleTo(R) - look.hookAngle);
        const kneeX = kneeAtLeft ? L : R;
        const farX = kneeAtLeft ? R : L;
        d = `M${f(a.x)},${f(a.y)} ${leg(a.x, a.y, kneeX, edgeY)} L${f(farX)},${f(edgeY)}`;
        edge = below ? 'top' : 'bottom';
      }

      callout.dataset.edge = edge;
      callout.style.setProperty('--box-x', `${f(L)}px`);
      callout.style.setProperty('--box-y', `${f(T)}px`);
      callout.style.setProperty('--settle', settle.toFixed(3));
      callout.style.setProperty('--shift', `${(noteState ? -34 * noteState.out + 46 * (1 - noteIn) : 0).toFixed(1)}px`);
      line.setAttribute('d', d);
      dot.setAttribute('cx', f(a.x));
      dot.setAttribute('cy', f(a.y));

      placeCrown(a, rethink, { l: L, t: T, r: R, b: B });
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
      sectionEls = sections;
      const gaps = Array.from(document.querySelectorAll<HTMLElement>('[data-gap]'));
      const moveState: { moved: boolean; passed: boolean; ready: boolean; last: number }[] = [];
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
      setMoveLive(true);
      const cleanups: (() => void)[] = [];
      const current = scene;

      let frame = 0;
      const update = () => {
        frame = 0;
        const viewport = window.innerHeight;
        // Each move to the next section is triggered in the second half of the dwell that ends the section before it.
        // The watch sets off at one point going down and goes back at another going up, so
        // that on the way up it returns just as the next section's content has left.
        let position = 0;
        for (let i = 1; i < sections.length; i++) {
          const gap = gaps[i - 1];
          const progress = gap ? dwellProgress(gap, viewport) : -1;
          if (progress >= 0) {
            const state = moveState[i] ?? { moved: false, passed: false, ready: false, last: progress };
            moveState[i] = state;
            if (!state.ready || Math.abs(progress - state.last) > 0.3) {
              // First reading, or a jump (a link, or a resize that moved everything): take the
              // state that matches where we are, as if we had got here by scrolling.
              const up = state.ready && progress < state.last;
              state.moved = progress > (up ? MOVE_BACK_AT : MOVE_AT);
              state.passed = progress > 0.6;
              state.ready = true;
            } else if (progress < MOVE_AT) {
              state.moved = false;
              state.passed = false;
            } else if (progress > 0.6) {
              state.moved = true;
              state.passed = true;
            } else if (state.passed && progress < MOVE_BACK_AT) {
              state.moved = false;
              state.passed = false;
            } else if (!state.moved && !state.passed && progress > state.last) {
              state.moved = true;
            }
            state.last = progress;
            position += state.moved ? 1 : 0;
          } else {
            const top = sections[i].getBoundingClientRect().top;
            position += clamp01((viewport * 0.8 - top) / (viewport * 0.5));
          }
        }
        current.setPosition(position);
        // The note moves like the content does: it leaves as the last piece of the section,
        // and arrives as the last piece of the next one, so the two feel the same.
        const progress = gaps.map((gap) => dwellProgress(gap, viewport));
        if (progress.every((p) => p >= 0)) {
          const index = progress.filter((p) => p > SWAP_AT).length;
          const own = progress[index] ?? 0;
          const before = index > 0 ? progress[index - 1] : 1;
          const out = leaveProgress(own, 1);
          const inn = arriveProgress(before, 1);
          noteState = { index, out, inn };
        } else {
          noteState = null;
        }
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

  // If the lock is released some other way (Escape), the drag ends with it.
  useEffect(() => {
    const onLockChange = () => {
      if (document.pointerLockElement) return;
      drag.current.active = false;
      if (crownRef.current) delete crownRef.current.dataset.held;
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
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

  /** Winding past either end of the page carries on round to the other end, like a crown does. */
  const wind = (dy: number) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const before = window.scrollY;
    window.scrollBy({ top: dy * 2.4, behavior: 'instant' });
    const moved = Math.abs(window.scrollY - before) > 0.5;
    const state = drag.current;
    state.over = moved ? 0 : state.over + dy;
    if (Math.abs(state.over) > 140) {
      const forward = state.over > 0;
      state.over = 0;
      window.scrollTo({ top: forward ? 0 : max, behavior: 'smooth' });
    }
  };

  return (
    <>
      <div className='watch-bg' aria-hidden='true'>
        <canvas className='watch-bg__canvas' ref={canvasRef} />
      </div>
      <div className='callout' ref={calloutRef} data-tone='stage' data-edge='top' data-empty={note ? undefined : 'true'}>
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
      <button
        type='button'
        className='crown-control'
        ref={crownRef}
        aria-label={crown.label}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { active: true, moved: 0, lastY: event.clientY, over: 0 };
          event.currentTarget.dataset.held = 'true';
        }}
        onPointerMove={(event) => {
          if (!drag.current.active) return;
          // With the pointer locked the cursor can no longer reach the edge of the screen,
          // so the crown keeps turning however far the mouse travels.
          const locked = document.pointerLockElement === event.currentTarget;
          const dy = locked ? event.movementY : event.clientY - drag.current.lastY;
          drag.current.lastY = event.clientY;
          drag.current.moved += Math.abs(dy);
          if (drag.current.moved > 4) {
            if (event.pointerType === 'mouse' && !locked && !document.pointerLockElement) {
              try {
                void Promise.resolve(event.currentTarget.requestPointerLock()).catch(() => undefined);
              } catch {
                // Without pointer lock the drag still works up to the edge of the screen.
              }
            }
            wind(dy);
            sceneHandle.current?.spinCrown(dy * 0.05);
          }
        }}
        onPointerUp={(event) => {
          const wasTap = drag.current.active && drag.current.moved <= 4;
          drag.current.active = false;
          delete event.currentTarget.dataset.held;
          if (document.pointerLockElement === event.currentTarget) document.exitPointerLock();
          if (wasTap) goToNext();
        }}
        onPointerCancel={(event) => {
          drag.current.active = false;
          delete event.currentTarget.dataset.held;
          if (document.pointerLockElement === event.currentTarget) document.exitPointerLock();
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
