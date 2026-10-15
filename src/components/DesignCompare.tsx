'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

type Pair = {
  id: string;
  label: string;
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  thumbSrc: string;
};

type Labels = {
  before: string;
  after: string;
  pairsLabel: string;
  slider: string;
  sliderValue: string;
};

/** The size the thumbnails are cut at (scripts/crop-evolution.mjs). */
const THUMB_WIDTH = 360;
const THUMB_HEIGHT = 213;

const START = 50;
const STEP = 5;
const BIG_STEP = 20;
/** How much of the way to the goal the divider covers each frame: it glides and settles, never jumps. */
const GLIDE = 0.18;

const clamp = (value: number) => Math.min(100, Math.max(0, value));

/**
 * The design comparer: one pair of equivalent sections at a time, the first version on the left and the
 * current one on the right, with a divider that can be moved. A row of thumbnails under it, each half the
 * first version and half the current one, picks the section.
 *
 * The divider glides. It follows the mouse as it moves over the pictures, can be dragged (mouse or finger),
 * and answers the arrow keys, Home, End and Page Up and Down as a slider. When the section arrives, and
 * each time another pair is picked, the first version is wiped away to the middle, so the change reads as
 * a before and an after. On phones, and with reduced motion, the stylesheet shows both captures stacked,
 * each with its caption, and hides the divider; without script the same stacked view is used.
 *
 * The divider's position is never React state: it is written straight to the DOM (a CSS variable on the
 * stage and the slider's ARIA values) on every frame, so moving it costs no re-render, and nothing else on
 * the page, the scroll-driven swap with the numbers included, has to wait for it.
 */
export function DesignCompare({
  pairs,
  width,
  height,
  labels,
}: {
  pairs: Pair[];
  width: number;
  height: number;
  labels: Labels;
}) {
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const legend = useRef<HTMLDivElement>(null);
  const shown = useRef(START);
  const goal = useRef(START);
  const frame = useRef(0);
  const dragging = useRef(false);
  const pair = pairs[active];

  /** Put the divider at `value`: the line, the slider's values and which version the legend leans to. */
  const apply = useCallback(
    (value: number) => {
      const rounded = Math.round(value);
      stage.current?.style.setProperty('--pos', `${value.toFixed(2)}%`);
      const slider = handle.current;
      if (slider && slider.getAttribute('aria-valuenow') !== String(rounded)) {
        slider.setAttribute('aria-valuenow', String(rounded));
        slider.setAttribute('aria-valuetext', labels.sliderValue.replace('{value}', String(rounded)));
      }
      if (legend.current) legend.current.dataset.lean = value >= 50 ? 'before' : 'after';
    },
    [labels.sliderValue],
  );

  const glide = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const tick = () => {
      const next = shown.current + (goal.current - shown.current) * GLIDE;
      shown.current = Math.abs(goal.current - next) < 0.05 ? goal.current : next;
      apply(shown.current);
      if (shown.current !== goal.current) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [apply]);

  /** The divider starts at the first version and glides to the middle. */
  const wipe = useCallback(() => {
    shown.current = 100;
    goal.current = START;
    apply(100);
    glide();
  }, [apply, glide]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // When the section has arrived (the sweep marks the step `data-in`), the first version is wiped away.
  useEffect(() => {
    const step = root.current?.closest<HTMLElement>('.stepper');
    if (!step) return;
    let wasIn = !!step.dataset.in;
    const observer = new MutationObserver(() => {
      const isIn = !!step.dataset.in;
      if (isIn && !wasIn) wipe();
      wasIn = isIn;
    });
    observer.observe(step, { attributes: true, attributeFilter: ['data-in'] });
    return () => observer.disconnect();
  }, [wipe]);

  const at = (clientX: number) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    return clamp(((clientX - box.left) / box.width) * 100);
  };

  const touch = () => {
    if (stage.current) stage.current.dataset.touched = 'true';
  };

  const setDragging = (value: boolean) => {
    dragging.current = value;
    if (!stage.current) return;
    if (value) stage.current.dataset.dragging = 'true';
    else delete stage.current.dataset.dragging;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = at(event.clientX);
    if (target === null) return;
    setDragging(true);
    touch();
    // The browser would scroll the page to the element it focuses; the swap with the numbers depends on the
    // scroll position, so the handle takes the focus without moving the page.
    event.preventDefault();
    handle.current?.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    cancelAnimationFrame(frame.current);
    shown.current = goal.current = target;
    apply(target);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const target = at(event.clientX);
    if (target === null) return;
    if (dragging.current) {
      shown.current = goal.current = target;
      apply(target);
    } else if (event.pointerType === 'mouse' && Math.abs(target - goal.current) > 0.2) {
      // Over the pictures with no button down, the divider follows the mouse, a little behind it.
      goal.current = target;
      glide();
    }
  };

  const release = () => setDragging(false);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const now = goal.current;
    const keys: Record<string, number> = {
      ArrowLeft: now - STEP,
      ArrowRight: now + STEP,
      PageDown: now - BIG_STEP,
      PageUp: now + BIG_STEP,
      Home: 0,
      End: 100,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    touch();
    goal.current = clamp(keys[event.key]);
    glide();
  };

  const pick = (index: number) => {
    if (index === active) return;
    setActive(index);
    wipe();
  };

  return (
    <div ref={root} className='compare'>
      <div ref={legend} className='compare__legend' data-step-item aria-hidden='true' data-lean='before'>
        <span>{labels.before}</span>
        <span>{labels.after}</span>
      </div>

      <div
        ref={stage}
        className='compare__stage'
        data-step-item
        style={{ ['--ratio' as string]: `${width} / ${height}`, ['--pos' as string]: `${START}%` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <figure className='compare__shot compare__shot--after'>
          {/* eslint-disable-next-line @next/next/no-img-element -- static export; the images are cut by scripts/crop-evolution.mjs */}
          <img key={pair.afterSrc} src={pair.afterSrc} alt={pair.afterAlt} width={width} height={height} draggable={false} />
          <figcaption className='compare__tag compare__tag--after'>{labels.after}</figcaption>
        </figure>
        <figure className='compare__shot compare__shot--before'>
          {/* eslint-disable-next-line @next/next/no-img-element -- static export; the images are cut by scripts/crop-evolution.mjs */}
          <img key={pair.beforeSrc} src={pair.beforeSrc} alt={pair.beforeAlt} width={width} height={height} draggable={false} />
          <figcaption className='compare__tag compare__tag--before'>{labels.before}</figcaption>
        </figure>
        <div
          ref={handle}
          className='compare__handle'
          role='slider'
          tabIndex={0}
          aria-label={labels.slider}
          aria-orientation='horizontal'
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={START}
          aria-valuetext={labels.sliderValue.replace('{value}', String(START))}
          onKeyDown={onKeyDown}
        >
          <span className='compare__grip' aria-hidden='true'>
            {/* Drawn symmetric about the centre of its own box, so the arrows sit exactly on the diamond's axis. */}
            <svg className='compare__arrows' viewBox='0 0 16 16' focusable='false'>
              <path d='M6.4 5.2 6.4 10.8 3.4 8Z M9.6 5.2 9.6 10.8 12.6 8Z' />
            </svg>
          </span>
        </div>
      </div>

      <div className='compare__thumbs' data-step-item role='group' aria-label={labels.pairsLabel}>
        {pairs.map((item, index) => (
          <button
            key={item.id}
            type='button'
            className='compare__thumb'
            aria-pressed={index === active}
            onClick={() => pick(index)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static export; cut by scripts/crop-evolution.mjs */}
            <img src={item.thumbSrc} alt='' width={THUMB_WIDTH} height={THUMB_HEIGHT} loading='lazy' draggable={false} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
