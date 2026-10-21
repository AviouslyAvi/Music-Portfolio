// Knob ranges and defaults mirror Premonition/Parameters.h (namespace ranges,
// kSize, kDiffusion, kTailOverhang) at the commit pinned in PLUGIN_COMMIT.md.
// Decay is not a knob: the engine derives RT60 from the tail length in bars.

export type ReverbType = 'hall' | 'plate';
export type Bars = 0.5 | 1 | 2 | 4 | 8;

export type PluginParams = {
  type: ReverbType;
  stretch: number;
  bloom: number;
  size: number;
  overhang: number;
  diffusion: number;
  bars: Bars;
  direction: 'reverse' | 'forward';
};

export const BARS_CHOICES: readonly Bars[] = [0.5, 1, 2, 4, 8];

export const RANGES: Record<'stretch' | 'bloom' | 'size' | 'overhang' | 'diffusion', { min: number; max: number }> = {
  stretch: { min: 0.25, max: 4 },
  bloom: { min: 0, max: 1 },
  size: { min: 0, max: 1 },
  overhang: { min: 0, max: 1 },
  diffusion: { min: 0, max: 1 },
};

export const DEFAULT_PARAMS: PluginParams = {
  type: 'plate',
  stretch: 1,
  bloom: 0.25,
  size: 0.5,
  overhang: 0.125,
  diffusion: 0.7,
  bars: 2,
  direction: 'reverse',
};

function clampNum(v: number, key: keyof typeof RANGES): number {
  const { min, max } = RANGES[key];
  if (Number.isNaN(v)) return DEFAULT_PARAMS[key];
  return Math.min(max, Math.max(min, v));
}

export function clampParams(p: PluginParams): PluginParams {
  return {
    type: p.type === 'hall' ? 'hall' : 'plate',
    stretch: clampNum(p.stretch, 'stretch'),
    bloom: clampNum(p.bloom, 'bloom'),
    size: clampNum(p.size, 'size'),
    overhang: clampNum(p.overhang, 'overhang'),
    diffusion: clampNum(p.diffusion, 'diffusion'),
    bars: BARS_CHOICES.includes(p.bars) ? p.bars : DEFAULT_PARAMS.bars,
    direction: p.direction === 'forward' ? 'forward' : 'reverse',
  };
}
