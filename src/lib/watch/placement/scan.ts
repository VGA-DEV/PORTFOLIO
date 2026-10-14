import type { Rect } from './space';

/**
 * The safe areas notes and the crown keep out of: on wide screens, the column each
 * section's content sits in, whole, however its lines happen to wrap; on a phone,
 * where the text fills the width, the line boxes themselves.
 */
export function scanText(wide: boolean): Rect[] {
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
