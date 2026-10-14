/** Where the part being described sits on screen, and the middle of the watch. */
export type AnchorInfo = {
  x: number;
  y: number;
  centreX: number;
  /** The crown of the watch on screen, in pixels, so a real button can sit over it. */
  crown: { x: number; y: number; radius: number };
  /** Rough box of the watch case on screen, in pixels, for keeping notes clear of it. */
  model: { x: number; y: number; halfW: number; halfH: number };
  /** The miniature on show, if any, as a box in pixels: notes keep clear of it too. */
  prop: { x: number; y: number; halfW: number; halfH: number } | null;
  /** Continuous position along the page, 0 = hero. */
  position: number;
};

export type WatchScene = {
  /** Turn the crown, in radians; the visitor winds it by dragging. */
  spinCrown: (radians: number) => void;
  /** Continuous position along the page: 0 = hero, 1 = projects, and so on. */
  setPosition: (value: number) => void;
  setRunning: (running: boolean) => void;
  /** 0 or 1: the visitor is pointing at a piece of the content, and the miniature on screen livens up. */
  setExcite: (value: number) => void;
  /** Pixels at the bottom of the canvas hidden by the footer: the scene is framed in the rest, without resizing the canvas. */
  setBottomInset: (pixels: number) => void;
  resize: () => void;
  dispose: () => void;
};

export type WatchSceneOptions = {
  canvas: HTMLCanvasElement;
  /** Render a single still frame instead of animating. */
  still: boolean;
  /** Black {VGA_DEV} logo painted on the dial and the case back. */
  logoUrl: string;
  /** Per section: +1 puts the watch on the right of the screen, -1 on the left. */
  sides: readonly number[];
  /** Called after every rendered frame with where the highlighted part is on screen. */
  onAnchor?: (anchor: AnchorInfo) => void;
  /**
   * Whether the page is in its two-column layout (text on one side, the watch on the other).
   * Otherwise the text fills the width and the watch is fitted to a stage measured from the screen.
   */
  isWide?: () => boolean;
};
