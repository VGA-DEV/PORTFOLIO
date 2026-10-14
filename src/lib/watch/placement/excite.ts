import type { WatchScene } from '../scene';

/**
 * Pointing at (or focusing) a piece of content marked `data-excite` makes the miniature beside it
 * livelier. Returns the function that removes the listeners.
 */
export function bindExcite(scene: Pick<WatchScene, 'setExcite'>, root: HTMLElement) {
  const exciteBy = (target: EventTarget | null) => {
    const piece = target instanceof Element ? target.closest('[data-excite]') : null;
    scene.setExcite(piece ? 1 : 0);
  };
  const onOver = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') exciteBy(event.target);
  };
  const onFocusIn = (event: FocusEvent) => exciteBy(event.target);
  const onRest = () => scene.setExcite(0);
  document.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onRest);
  root.addEventListener('pointerleave', onRest);
  return () => {
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('focusin', onFocusIn);
    document.removeEventListener('focusout', onRest);
    root.removeEventListener('pointerleave', onRest);
  };
}
