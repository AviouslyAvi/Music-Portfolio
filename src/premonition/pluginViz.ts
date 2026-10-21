// Pure helpers for the plugin face's drawings. Everything is computed from real
// samples (the dry source and the render), nothing is faked.

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

/** Peak per bin, scaled so the loudest bin is 1. All zeros for silence or no samples. */
export function peakEnvelope(samples: Float32Array, bins: number): Float32Array {
  const out = new Float32Array(bins);
  const n = samples.length;
  if (n === 0 || bins <= 0) return out;
  let max = 0;
  for (let b = 0; b < bins; b++) {
    const from = Math.floor((b * n) / bins);
    const to = Math.max(from + 1, Math.floor(((b + 1) * n) / bins));
    let p = 0;
    for (let i = from; i < to && i < n; i++) p = Math.max(p, Math.abs(samples[i]));
    out[b] = p;
    max = Math.max(max, p);
  }
  if (max > 0) for (let b = 0; b < bins; b++) out[b] /= max;
  return out;
}

const WINDOW = 2048;
const F_LOW = 60;
const F_HIGH = 12000;
const FLOOR_DB = -66;

/**
 * Terrain heights from audio: `rows` time slices (start to end of the clip) by
 * `cols` log-spaced frequency bands, each 0..1. Goertzel per band over a Hann window.
 */
export function terrainFromAudio(samples: Float32Array, sampleRate: number, rows: number, cols: number): number[][] {
  const grid: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  const n = samples.length;
  if (n === 0 || rows <= 0 || cols <= 0) return grid;
  const win = Math.min(WINDOW, n);
  const hann = Float32Array.from({ length: win }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, win - 1)));
  const high = Math.min(F_HIGH, sampleRate / 2 - 1);
  const coeffs = Array.from({ length: cols }, (_, c) => {
    const f = F_LOW * (high / F_LOW) ** (cols > 1 ? c / (cols - 1) : 0);
    return 2 * Math.cos((2 * Math.PI * f) / sampleRate);
  });
  const mags: number[][] = [];
  let max = 0;
  for (let r = 0; r < rows; r++) {
    const centre = rows > 1 ? Math.round((r / (rows - 1)) * (n - 1)) : 0;
    const start = Math.max(0, Math.min(n - win, centre - win / 2));
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      const k = coeffs[c];
      let s1 = 0;
      let s2 = 0;
      for (let i = 0; i < win; i++) {
        const s0 = samples[start + i] * hann[i] + k * s1 - s2;
        s2 = s1;
        s1 = s0;
      }
      const power = s1 * s1 + s2 * s2 - k * s1 * s2;
      const m = Math.sqrt(Math.max(0, power)) / win;
      row.push(m);
      max = Math.max(max, m);
    }
    mags.push(row);
  }
  if (max <= 0) return grid;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const db = 20 * Math.log10(Math.max(mags[r][c], 1e-9) / max);
      grid[r][c] = Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB));
    }
  }
  return grid;
}

/** The overhang knob's discrete steps, in bars (Parameters.h allows 0..1 bar; the face offers these). */
export const OVERHANGS = [
  { label: 'OFF', bars: 0 },
  { label: '1/16', bars: 0.0625 },
  { label: '1/8', bars: 0.125 },
  { label: '1/4', bars: 0.25 },
  { label: '1/2', bars: 0.5 },
] as const;
