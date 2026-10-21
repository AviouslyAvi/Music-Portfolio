// Pure helpers for the plugin face's drawings. No React, no canvas: the same
// inputs always give the same numbers, so the terrain and waveforms never flicker.

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The plugin's bloom curve: gain(t) = t^e with e = (2 * bloom)^2. bloom 0 is a plain ramp. */
export function bloomExponent(bloom: number): number {
  return bloom <= 0 ? 1 : Math.max(0.12, (2 * bloom) ** 2);
}

export type Shape = { bloom: number; size: number; diffusion: number; stretch: number };

/**
 * Terrain heights, rows (far to near = start of the swell to the hit) by columns
 * (low to high frequency), each 0..1. `phase` slides the spectral peaks while previewing.
 */
export function terrainGrid(seedKey: string, rows: number, cols: number, p: Shape, phase = 0): number[][] {
  const rnd = mulberry32(hashSeed(seedKey));
  const peaks = Array.from({ length: 5 }, () => ({
    x: 0.04 + rnd() * 0.45,
    w: 0.04 + rnd() * 0.06,
    a: 0.35 + rnd() * 0.65,
  }));
  const noise = Array.from({ length: rows }, () => Array.from({ length: cols }, () => rnd()));
  const e = bloomExponent(p.bloom);
  const wide = 0.6 + p.diffusion * 1.4;
  const tilt = 3.4 - 1.6 * clamp01(p.size);
  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const t = rows > 1 ? r / (rows - 1) : 1;
    const env = t ** e;
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      const x = cols > 1 ? c / (cols - 1) : 0;
      let s = Math.exp(-x * tilt) * 0.55;
      peaks.forEach((pk, k) => {
        const cx = pk.x / Math.max(0.5, p.stretch) ** 0.3 + 0.03 * Math.sin(phase + k * 1.7 + r * 0.25);
        s += pk.a * Math.exp(-(((x - cx) / (pk.w * wide)) ** 2));
      });
      s += (noise[r][c] - 0.5) * 0.16 * (1.2 - p.diffusion * 0.8);
      row.push((1 - Math.exp(-Math.max(0, s) * 1.5)) * env); // soft knee: peaks never clip into a plateau
    }
    grid.push(row);
  }
  return grid;
}

/** Source clip envelope: a hit that decays, with a little life in it. 0..1 over x in 0..1. */
export function sourceEnvelope(x: number, seedKey: string): number {
  const r = mulberry32(hashSeed(`${seedKey}:src`));
  const hit = 0.05 + r() * 0.1;
  const tail = 3 + r() * 3;
  if (x < hit) return clamp01(x / hit) * 0.9;
  return clamp01(0.95 * Math.exp(-(x - hit) * tail) + 0.12 * Math.sin(x * 40 + r() * 6) ** 2 * (1 - x));
}

/** Render envelope: the reversed swell, t^e up to the bar line, then the overhang ring-out. */
export function renderEnvelope(x: number, bloom: number, overhang: number): number {
  const knee = 1 - overhang;
  if (x <= knee) return knee > 0 ? (x / knee) ** bloomExponent(bloom) : 0;
  return Math.exp(-((x - knee) / Math.max(0.02, overhang)) * 3);
}

export const OVERHANGS = ['OFF', '1/16', '1/8', '1/4', '1/2'] as const;
/** Fraction of the render length the overhang takes, for each OVERHANGS step. */
export const OVERHANG_FRACTION = [0, 0.04, 0.08, 0.16, 0.3];
