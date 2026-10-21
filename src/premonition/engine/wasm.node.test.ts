// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const DIR = fileURLToPath(new URL('../../../public/premonition/', import.meta.url));

type DspModule = {
  HEAPF32: Float32Array;
  _malloc(n: number): number;
  _free(p: number): void;
  _premonition_render(...args: number[]): number;
};

// public/ is served as a classic worker script; the package is ESM, so evaluate the glue as CommonJS here.
async function load(): Promise<DspModule> {
  const mod = { exports: {} as unknown };
  const src = readFileSync(DIR + 'dsp.js', 'utf8');
  new Function('module', 'exports', 'require', '__dirname', '__filename', src)(mod, mod.exports, require, DIR, DIR + 'dsp.js');
  return (mod.exports as (o?: object) => Promise<DspModule>)();
}

function render(m: DspModule, input: Float32Array, bars: number, overhang: number): { frames: number; l: Float32Array } {
  const n = input.length;
  const cap = 48000 * 40;
  const inP = m._malloc(n * 4);
  const outL = m._malloc(cap * 4);
  const outR = m._malloc(cap * 4);
  m.HEAPF32.set(input, inP / 4);
  // premonition_render(inL, inR, frames, sr, bpm, mode, type, stretch, bloom, size, overhang, diffusion, bars, outL, outR, cap)
  const frames = m._premonition_render(inP, inP, n, 48000, 120, 0, 1, 1, 0.25, 0.5, overhang, 0.7, bars, outL, outR, cap);
  const l = frames > 0 ? m.HEAPF32.slice(outL / 4, outL / 4 + frames) : new Float32Array(0);
  m._free(inP); m._free(outL); m._free(outR);
  return { frames, l };
}

describe('premonition wasm', () => {
  it('renders a 1 s noise burst at 2 bars into a riser of exactly 2 bars', async () => {
    const m = await load();
    const input = new Float32Array(48000);
    let seed = 1;
    for (let i = 0; i < input.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      input[i] = ((seed / 2 ** 32) * 2 - 1) * Math.exp(-i / 6000);
    }
    const { frames, l } = render(m, input, 2, 0);
    expect(frames).toBe(2 * 2 * 48000 * 1);
    let peak = 0;
    for (const v of l) peak = Math.max(peak, Math.abs(v));
    expect(Number.isFinite(peak)).toBe(true);
    expect(peak).toBeGreaterThan(0.05);
    expect(peak).toBeLessThanOrEqual(1.0);
    const win = 240; // 5 ms
    const rms = (a: number, b: number) => { let s = 0; for (let i = a; i < b; i++) s += l[i] * l[i]; return Math.sqrt(s / (b - a)); };
    expect(rms(frames - win, frames)).toBeGreaterThan(rms(0, win));
  });

  it('extends the render by the overhang', async () => {
    const m = await load();
    const input = new Float32Array(48000).fill(0.3);
    const { frames } = render(m, input, 1, 0.5);
    expect(frames).toBe(96000 + 48000);
  });

  it('returns -1 for a zero-length input', async () => {
    const m = await load();
    expect(render(m, new Float32Array(0), 2, 0).frames).toBe(-1);
  });
});
