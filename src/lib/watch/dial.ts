import { rayHit, type Vec2 } from './smooth';

/** Dial half-extents in scene units: the dial plate is the outline scaled by 0.84. */
export const DIAL_SCALE = 0.84;
export const DIAL_HALF_X = DIAL_SCALE * 1;
export const DIAL_HALF_Y = DIAL_SCALE * 1.35;

const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

/**
 * Silvered-lavender sunburst dial with a railway minute track and Roman
 * numerals, painted to a canvas so the text uses the site's real typeface.
 */
export function makeDialCanvas(outline: readonly Vec2[], fontFamily: string) {
  const width = 1024;
  const pxPerUnit = width / 2 / DIAL_HALF_X;
  const height = Math.round(DIAL_HALF_Y * 2 * pxPerUnit);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

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
  const outer = 0.775;
  const inner = 0.71;
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
    const [x, y] = rayHit(outline, h * 30, 0.6);
    const [X, Y] = px(x, y);
    ctx.fillText(numeral, X, Y);
  });

  // Signature, small and quiet, under the XII.
  ctx.font = `600 30px ${fontFamily}`;
  ctx.fillStyle = 'rgba(52,4,64,0.75)';
  const [sx, sy] = px(0, 0.36);
  ctx.fillText('V G A · D E V', sx, sy);

  return canvas;
}

/**
 * Engraving mask for the case back: white is polished metal, black is cut.
 * Guilloché rings around a plate of engraved lines of text.
 */
export function makeEngravingCanvas(
  outline: readonly Vec2[],
  fontFamily: string,
  lines: readonly string[],
) {
  const halfX = 0.985;
  const halfY = 0.985 * 1.35;
  const width = 1024;
  const pxPerUnit = width / 2 / halfX;
  const height = Math.round(halfY * 2 * pxPerUnit);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
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

  // Clear plate for the text, with a cut border.
  trace(0.6);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 5;
  trace(0.62);
  ctx.stroke();
  trace(0.585);
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const sizes = [76, 60, 46, 42];
  const ys = [-0.62, -0.2, 0.18, 0.62];
  lines.forEach((line, i) => {
    ctx.font = `600 ${sizes[i] ?? 34}px ${fontFamily}`;
    ctx.fillText(line, cx, cy + (ys[i] ?? 0) * pxPerUnit * 0.62 * 1.35);
  });

  return canvas;
}
