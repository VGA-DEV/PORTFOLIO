import { CASE, rayHit, type Vec2 } from './smooth';

/** Dial half-extents in scene units: the dial plate is the outline scaled by 0.9. */
export const DIAL_SCALE = 0.9;
export const DIAL_HALF_X = DIAL_SCALE * CASE.a;
export const DIAL_HALF_Y = DIAL_SCALE * CASE.b;
/** The engraved case back is the outline scaled by 0.985. */
export const BACK_SCALE = 0.985;
export const BACK_HALF_X = BACK_SCALE * CASE.a;
export const BACK_HALF_Y = BACK_SCALE * CASE.b;

const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

/** Draw the black {VGA_DEV} logo centred at (x, y), `width` pixels wide. */
function drawLogo(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  alpha = 1,
) {
  if (!logo || !logo.naturalWidth) return;
  const height = (width * logo.naturalHeight) / logo.naturalWidth;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(logo, x - width / 2, y - height / 2, width, height);
  ctx.restore();
}

/** Shrink a line of text until it fits `maxWidth`. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  size: number,
  maxWidth: number,
  weight = 600,
) {
  let current = size;
  ctx.font = `${weight} ${current}px ${fontFamily}`;
  while (ctx.measureText(text).width > maxWidth && current > 12) {
    current -= 2;
    ctx.font = `${weight} ${current}px ${fontFamily}`;
  }
}

export function createDialCanvas() {
  const width = 1024;
  const pxPerUnit = width / 2 / DIAL_HALF_X;
  const height = Math.round(DIAL_HALF_Y * 2 * pxPerUnit);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Silvered-lavender sunburst dial with a railway minute track, Roman numerals and
 * the logo, painted to a canvas so the text uses the site's real typeface.
 */
export function paintDial(
  canvas: HTMLCanvasElement,
  outline: readonly Vec2[],
  fontFamily: string,
  logo: HTMLImageElement | null,
) {
  const { width, height } = canvas;
  const pxPerUnit = width / 2 / DIAL_HALF_X;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cx = width / 2;
  const cy = height / 2;
  const px = (x: number, y: number): [number, number] => [cx + x * pxPerUnit, cy - y * pxPerUnit];

  // Base lacquer: pale at the centre, deeper toward the edges.
  const base = ctx.createRadialGradient(cx, cy, 40, cx, cy, height * 0.62);
  base.addColorStop(0, '#e4e6f8');
  base.addColorStop(0.55, '#cbcfef');
  base.addColorStop(1, '#a3a8d6');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Sunburst: alternating hair-thin wedges from the centre.
  for (let k = 0; k < 720; k++) {
    const a0 = (k / 720) * Math.PI * 2;
    const a1 = ((k + 1) / 720) * Math.PI * 2;
    const tone = 0.5 + 0.5 * Math.sin(k * 0.9) * Math.sin(k * 0.13);
    ctx.fillStyle = k % 2 ? `rgba(255,255,255,${0.12 + 0.14 * tone})` : `rgba(52,4,64,${0.07 + 0.08 * tone})`;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * 2000, cy + Math.sin(a0) * 2000);
    ctx.lineTo(cx + Math.cos(a1) * 2000, cy + Math.sin(a1) * 2000);
    ctx.closePath();
    ctx.fill();
  }

  // Railway minute track.
  const outer = 0.83;
  const inner = 0.765;
  ctx.strokeStyle = 'rgba(52,4,64,0.85)';
  ctx.lineWidth = 3;
  for (const s of [outer, inner]) {
    ctx.beginPath();
    outline.forEach(([x, y], i) => {
      const [X, Y] = px(x * s, y * s);
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    });
    ctx.closePath();
    ctx.stroke();
  }
  for (let m = 0; m < 60; m++) {
    const [x0, y0] = rayHit(outline, m * 6, inner);
    const [x1, y1] = rayHit(outline, m * 6, outer);
    const [X0, Y0] = px(x0, y0);
    const [X1, Y1] = px(x1, y1);
    ctx.lineWidth = m % 5 === 0 ? 5 : 2;
    ctx.beginPath();
    ctx.moveTo(X0, Y0);
    ctx.lineTo(X1, Y1);
    ctx.stroke();
  }

  // Roman numerals.
  ctx.fillStyle = '#340440';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 84px ${fontFamily}`;
  ROMAN.forEach((numeral, h) => {
    const [x, y] = rayHit(outline, h * 30, 0.64);
    const [X, Y] = px(x, y);
    ctx.fillText(numeral, X, Y);
  });

  // The logo, in the lower half, opposite the 12.
  const [lx, ly] = px(0, -0.33);
  drawLogo(ctx, logo, lx, ly, 0.5 * pxPerUnit, 0.9);
}

export function createEngravingCanvas() {
  const width = 1024;
  const pxPerUnit = width / 2 / BACK_HALF_X;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(BACK_HALF_Y * 2 * pxPerUnit);
  return canvas;
}

/**
 * Engraving mask for the case back: white is polished metal, black is cut.
 * Guilloché rings around a clear plate holding the logo and two lines of text,
 * all kept inside the plate.
 */
export function paintEngraving(
  canvas: HTMLCanvasElement,
  outline: readonly Vec2[],
  fontFamily: string,
  lines: readonly string[],
  logo: HTMLImageElement | null,
) {
  const { width, height } = canvas;
  const pxPerUnit = width / 2 / BACK_HALF_X;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cx = width / 2;
  const cy = height / 2;

  const trace = (scale: number) => {
    ctx.beginPath();
    outline.forEach(([x, y], i) => {
      const X = cx + x * scale * pxPerUnit;
      const Y = cy - y * scale * pxPerUnit;
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    });
    ctx.closePath();
  };

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Guilloché: fine concentric tonneau lines.
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2;
  for (let s = 0.96; s > 0.1; s -= 0.028) {
    trace(s);
    ctx.stroke();
  }

  // Clear plate with a cut border.
  const plate = 0.66;
  trace(plate);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 5;
  trace(plate + 0.02);
  ctx.stroke();
  trace(plate - 0.025);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Everything sits on the centre line and inside the plate's width.
  const maxWidth = 2 * (plate - 0.1) * pxPerUnit * (1 - CASE.taper * 0.2);
  drawLogo(ctx, logo, cx, cy - 0.3 * pxPerUnit, Math.min(0.78 * pxPerUnit, maxWidth));

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const rows = [0.08, 0.3];
  lines.slice(0, 2).forEach((line, i) => {
    fitText(ctx, line, fontFamily, i === 0 ? 70 : 52, maxWidth);
    ctx.fillText(line, cx, cy + rows[i] * pxPerUnit);
  });
}
