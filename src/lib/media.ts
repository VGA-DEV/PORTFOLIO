/**
 * The media queries the page's scripts read, in one place so that they agree with each other and with
 * the stylesheets in `styles/` (which repeat the same widths as `62rem`).
 */

export const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/** The two-column layout: text beside the watch, each section meant to fit one screen. */
export const WIDE_QUERY = '(min-width: 62rem) and (pointer: fine)';

/** Anything but the two-column layout: the page is one column and the watch sits behind the text. */
export const NARROW_QUERY = `not all and ${WIDE_QUERY}`;

/** A touch screen as the main pointer. */
export const COARSE_QUERY = '(pointer: coarse)';

export const prefersReducedMotion = () => window.matchMedia(REDUCED_QUERY).matches;
