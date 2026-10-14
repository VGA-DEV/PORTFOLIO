export type Rgb = readonly [number, number, number];

/** Palette, kept in step with styles/base.css. */
export const COLORS = {
  gold: [1.0, 0.72, 0.3],
  rhodium: [0.78, 0.8, 0.88],
  lavender: [0.78, 0.8, 0.945],
  violet: [0.5, 0.2, 0.85],
  bluedSteel: [0.1, 0.14, 0.5],
  roseGold: [0.95, 0.55, 0.46],
  leather: [0.085, 0.022, 0.15],
} as const;

/** How a surface looks. `mode` picks the shader: 0 metal, 1 leather, 2 dial, 3 sapphire glass, 4 engraved case back. */
export type Material = {
  mode: 0 | 1 | 2 | 3 | 4;
  albedo: Rgb;
  f0: Rgb;
  rough: number;
  transparent?: boolean;
  sprocket?: number;
};

export const gold = (rough: number): Material => ({ mode: 0, albedo: COLORS.gold, f0: COLORS.gold, rough });
export const steel = (color: Rgb, rough: number): Material => ({ mode: 0, albedo: color, f0: color, rough });
