'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The «?» beside a figure's label and the sentence it opens. On a mouse the label answers to hover, but a
 * touch screen has no hover (and some browsers never focus a button on tap), so the button also toggles
 * the sentence: a tap opens it, another tap anywhere else, or Escape, closes it.
 */
export function ScoreHelp({ label, tipId, text }: { label: string; tipId: string; text: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={box} className='score__helpbox'>
      <button
        type='button'
        className='score__help'
        aria-label={label}
        aria-describedby={tipId}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      <span id={tipId} role='tooltip' className='score__tip'>
        {text}
      </span>
    </span>
  );
}
