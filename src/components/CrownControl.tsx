'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { WatchScene } from '@/lib/watch/scene';

type CrownControlProps = {
  /** The button itself: `WatchBackdrop` moves it over the 3D crown and reads its state. */
  buttonRef: RefObject<HTMLButtonElement | null>;
  /** The scene whose crown turns with the drag, once it exists. */
  sceneRef: RefObject<WatchScene | null>;
  label: string;
  hint: string;
};

/** Below this much travel a press is a tap, not a drag, in pixels. */
const TAP_SLOP = 4;

/**
 * The page control, laid over the crown of the 3D watch. Dragging it winds the crown and scrolls the page;
 * a tap moves to the next section; the arrow keys scroll. It is positioned from outside (`WatchBackdrop`).
 */
export function CrownControl({ buttonRef, sceneRef, label, hint }: CrownControlProps) {
  const drag = useRef({ active: false, moved: 0, lastY: 0, over: 0 });

  // If the pointer lock is released some other way (Escape), the drag ends with it.
  useEffect(() => {
    const onLockChange = () => {
      if (document.pointerLockElement) return;
      drag.current.active = false;
      if (buttonRef.current) delete buttonRef.current.dataset.held;
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, [buttonRef]);

  const goToNext = () => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-watch-section]'));
    const line = window.innerHeight * 0.4;
    const next = sections.find((section) => section.getBoundingClientRect().top > line);
    if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    sceneRef.current?.spinCrown(Math.PI * 2);
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
    <button
      type='button'
      className='crown-control'
      ref={buttonRef}
      aria-label={label}
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
        if (drag.current.moved > TAP_SLOP) {
          if (event.pointerType === 'mouse' && !locked && !document.pointerLockElement) {
            try {
              void Promise.resolve(event.currentTarget.requestPointerLock()).catch(() => undefined);
            } catch {
              // Without pointer lock the drag still works up to the edge of the screen.
            }
          }
          wind(dy);
          sceneRef.current?.spinCrown(dy * 0.05);
        }
      }}
      onPointerUp={(event) => {
        const wasTap = drag.current.active && drag.current.moved <= TAP_SLOP;
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
          sceneRef.current?.spinCrown(down ? 0.8 : -0.8);
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
        {hint}
      </span>
    </button>
  );
}
