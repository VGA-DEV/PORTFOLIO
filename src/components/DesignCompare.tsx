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
  const [position, setPosition] = useState(START);
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const shown = useRef(START);
  const goal = useRef(START);
  const frame = useRef(0);
  const pair = pairs[active];

  const glide = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const tick = () => {
      const next = shown.current + (goal.current - shown.current) * GLIDE;
      shown.current = Math.abs(goal.current - next) < 0.05 ? goal.current : next;
      setPosition(shown.current);
      if (shown.current !== goal.current) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, []);

  /** The divider starts at the first version and glides to the middle. */
  const wipe = useCallback(() => {
    shown.current = 100;
    goal.current = START;
    glide();
  }, [glide]);

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

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = at(event.clientX);
    if (target === null) return;
    setDragging(true);
    setTouched(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    cancelAnimationFrame(frame.current);
    shown.current = goal.current = target;
    setPosition(target);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const target = at(event.clientX);
    if (target === null) return;
    if (dragging) {
      shown.current = goal.current = target;
      setPosition(target);
    } else if (event.pointerType === 'mouse') {
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
      ArrowDown: now - STEP,
      ArrowRight: now + STEP,
      ArrowUp: now + STEP,
      PageDown: now - BIG_STEP,
      PageUp: now + BIG_STEP,
      Home: 0,
      End: 100,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    setTouched(true);
    goal.current = clamp(keys[event.key]);
    glide();
  };

  const pick = (index: number) => {
    if (index === active) return;
    setActive(index);
    wipe();
  };

  const rounded = Math.round(position);

  return (
    <div ref={root} className='compare'>
      <div className='compare__legend' data-step-item aria-hidden='true' data-lean={position >= 50 ? 'before' : 'after'}>
        <span>{labels.before}</span>
        <span>{labels.after}</span>
      </div>

      <div
        ref={stage}
        className='compare__stage'
        data-step-item
        data-dragging={dragging ? 'true' : undefined}
        data-touched={touched ? 'true' : undefined}
        style={{ ['--ratio' as string]: `${width} / ${height}`, ['--pos' as string]: `${position}%` }}
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
          className='compare__handle'
          role='slider'
          tabIndex={0}
          aria-label={labels.slider}
          aria-orientation='horizontal'
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rounded}
          aria-valuetext={labels.sliderValue.replace('{value}', String(rounded))}
          onKeyDown={onKeyDown}
        >
          <span className='compare__grip' aria-hidden='true'>
            <i className='compare__arrow compare__arrow--left' />
            <i className='compare__arrow compare__arrow--right' />
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
