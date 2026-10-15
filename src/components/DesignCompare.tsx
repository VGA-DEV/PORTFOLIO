'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

type Pair = {
  id: string;
  label: string;
  note: string;
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
};

type Labels = {
  before: string;
  after: string;
  pairsLabel: string;
  slider: string;
  sliderValue: string;
};

const START = 50;
const STEP = 5;
const BIG_STEP = 20;

const clamp = (value: number) => Math.min(100, Math.max(0, value));

/**
 * The design comparer: one pair of equivalent sections at a time, the first version on the left and the
 * current one on the right, with a handle that moves the dividing line. Only one comparer is visible at
 * once; a row of buttons picks the section. The handle is a slider (arrow keys, Home, End, Page Up and
 * Down) and can also be dragged. On phones, and with reduced motion, the stylesheet shows both captures
 * stacked, each with its caption, and hides the handle; without script the same stacked view is used.
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
  const stage = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pair = pairs[active];

  const moveTo = (clientX: number) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    setPosition(clamp(((clientX - box.left) / box.width) * 100));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveTo(event.clientX);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) moveTo(event.clientX);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowLeft: position - STEP,
      ArrowDown: position - STEP,
      ArrowRight: position + STEP,
      ArrowUp: position + STEP,
      PageDown: position - BIG_STEP,
      PageUp: position + BIG_STEP,
      Home: 0,
      End: 100,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    setPosition(clamp(keys[event.key]));
  };

  const pick = (index: number) => {
    setActive(index);
    setPosition(START);
  };

  const rounded = Math.round(position);

  return (
    <div className='compare'>
      <div className='compare__pairs' role='group' aria-label={labels.pairsLabel}>
        {pairs.map((item, index) => (
          <button
            key={item.id}
            type='button'
            className='compare__pair'
            aria-pressed={index === active}
            onClick={() => pick(index)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        ref={stage}
        className='compare__stage'
        style={{ ['--ratio' as string]: `${width} / ${height}`, ['--pos' as string]: `${position}%` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <figure className='compare__shot compare__shot--after'>
          {/* eslint-disable-next-line @next/next/no-img-element -- static export; the images are cut by scripts/crop-evolution.mjs */}
          <img src={pair.afterSrc} alt={pair.afterAlt} width={width} height={height} draggable={false} />
          <figcaption className='compare__tag compare__tag--after'>{labels.after}</figcaption>
        </figure>
        <figure className='compare__shot compare__shot--before'>
          {/* eslint-disable-next-line @next/next/no-img-element -- static export; the images are cut by scripts/crop-evolution.mjs */}
          <img src={pair.beforeSrc} alt={pair.beforeAlt} width={width} height={height} draggable={false} />
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
          <span className='compare__grip' aria-hidden='true' />
        </div>
      </div>

      <p className='compare__note'>{pair.note}</p>
    </div>
  );
}
