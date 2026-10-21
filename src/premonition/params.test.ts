import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, clampParams, type PluginParams } from './params';

describe('params', () => {
  it('defaults match Parameters.h and the plugin UI (stretch 1, bloom 25%, size 50%, overhang 1/8 bar, diffusion 70%)', () => {
    expect(DEFAULT_PARAMS).toEqual({
      type: 'plate',
      stretch: 1,
      bloom: 0.25,
      size: 0.5,
      overhang: 0.125,
      diffusion: 0.7,
      bars: 2,
      direction: 'reverse',
    });
  });

  it('clampParams clamps stretch to 0.25..4', () => {
    expect(clampParams({ ...DEFAULT_PARAMS, stretch: 99 }).stretch).toBe(4);
    expect(clampParams({ ...DEFAULT_PARAMS, stretch: 0 }).stretch).toBe(0.25);
  });

  it('clampParams maps NaN to the default', () => {
    const bad = { ...DEFAULT_PARAMS, bloom: NaN, size: Infinity, bars: 3 as unknown as PluginParams['bars'] };
    const out = clampParams(bad);
    expect(out.bloom).toBe(DEFAULT_PARAMS.bloom);
    expect(out.size).toBe(1);
    expect(out.bars).toBe(DEFAULT_PARAMS.bars);
  });

  it('forward direction is accepted', () => {
    expect(clampParams({ ...DEFAULT_PARAMS, direction: 'forward' }).direction).toBe('forward');
  });
});
