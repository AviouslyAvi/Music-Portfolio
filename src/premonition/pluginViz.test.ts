import { describe, expect, it } from 'vitest';
import { OVERHANGS, peakEnvelope, terrainFromAudio } from './pluginViz';

const SR = 48000;

function sweep(seconds: number, f: number, rise: boolean): Float32Array {
  const n = Math.round(SR * seconds);
  return Float32Array.from({ length: n }, (_, i) => {
    const g = rise ? i / n : 1;
    return Math.sin((2 * Math.PI * f * i) / SR) * g;
  });
}

describe('pluginViz', () => {
  it('peakEnvelope returns the requested number of bins normalised to 1', () => {
    const env = peakEnvelope(sweep(1, 440, true), 100);
    expect(env).toHaveLength(100);
    expect(Math.max(...env)).toBeCloseTo(1, 5);
    expect(env[95]).toBeGreaterThan(env[10]);
  });

  it('peakEnvelope of silence or nothing is all zero', () => {
    expect(Array.from(peakEnvelope(new Float32Array(0), 4))).toEqual([0, 0, 0, 0]);
    expect(Array.from(peakEnvelope(new Float32Array(1000), 4))).toEqual([0, 0, 0, 0]);
  });

  it('terrainFromAudio is rows by cols, finite, in 0..1, and rises with a riser', () => {
    const grid = terrainFromAudio(sweep(1, 880, true), SR, 12, 24);
    expect(grid).toHaveLength(12);
    expect(grid[0]).toHaveLength(24);
    for (const row of grid) for (const v of row) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    const peak = (r: number[]) => Math.max(...r);
    expect(peak(grid[11])).toBeGreaterThan(peak(grid[2]));
  });

  it('terrainFromAudio of silence is flat zero', () => {
    const grid = terrainFromAudio(new Float32Array(SR), SR, 4, 8);
    expect(grid.flat().every((v) => v === 0)).toBe(true);
  });

  it('lists the overhang steps the plugin offers', () => {
    expect(OVERHANGS.map((o) => o.bars)).toEqual([0, 0.0625, 0.125, 0.25, 0.5]);
  });
});
