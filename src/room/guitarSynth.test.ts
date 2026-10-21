import { describe, it, expect, vi } from 'vitest';
import { GuitarSynth, PIANO_CHORDS, STRING_NAMES, TUNINGS, pianoNote, pluck, tuningHz } from './guitarSynth';
import { GUITAR_ACOUSTIC, GUITAR_ELECTRIC, PIANO } from './layout';

const SR = 48000;
const voice = { damping: 0.9985, bright: 0.7 };

/** Period of a signal in samples, by autocorrelation over plausible guitar pitches. */
function period(x: Float32Array, minHz = 60, maxHz = 400): number {
  const start = 2000; // skip the noisy attack
  const len = 8000;
  let best = 0;
  let bestLag = 0;
  for (let lag = Math.floor(SR / maxHz); lag <= Math.floor(SR / minHz); lag++) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += x[start + i] * x[start + i + lag];
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  return bestLag;
}

describe('tunings', () => {
  it('the electric is in standard tuning, E A D G B E', () => {
    expect(STRING_NAMES.electric).toEqual(['E', 'A', 'D', 'G', 'B', 'E']);
    expect(tuningHz('electric').map((f) => Math.round(f * 100) / 100)).toEqual([82.41, 110, 146.83, 196, 246.94, 329.63]);
  });

  it('the acoustic is in open D, D A D F# A D', () => {
    expect(STRING_NAMES.acoustic).toEqual(['D', 'A', 'D', 'F#', 'A', 'D']);
    expect(tuningHz('acoustic').map((f) => Math.round(f * 100) / 100)).toEqual([73.42, 110, 146.83, 185, 220, 293.66]);
  });

  it('the open D strings spell a D major chord: D, A and F# only', () => {
    const pitchClasses = new Set(TUNINGS.acoustic.map((m) => m % 12));
    expect([...pitchClasses].sort((a, b) => a - b)).toEqual([2, 6, 9]);
  });
});

describe('pluck', () => {
  it('rings at the string pitch', () => {
    for (const hz of [tuningHz('electric')[0], tuningHz('acoustic')[3], tuningHz('electric')[5]]) {
      const lag = period(pluck(hz, SR, 1, voice, 1));
      expect(Math.abs(SR / lag - hz) / hz).toBeLessThan(0.03);
    }
  });

  it('is finite, deterministic, quiet enough to sum six strings, and decays', () => {
    const a = pluck(110, SR, 2, voice, 3);
    const b = pluck(110, SR, 2, voice, 3);
    expect(a).toEqual(b);
    expect(a.every(Number.isFinite)).toBe(true);
    const peak = (from: number, to: number) => a.slice(from, to).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak(0, a.length)).toBeLessThanOrEqual(1.5);
    expect(peak(SR, 2 * SR)).toBeLessThan(peak(0, SR / 4));
  });

  it('starts from silence so there is no click', () => {
    expect(Math.abs(pluck(110, SR, 0.5, voice, 3)[0])).toBe(0);
  });
});

function fakeContext() {
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const param = () => ({ value: 0 });
  const sources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; buffer: unknown }> = [];
  const panners: Array<{ positionX: { value: number }; positionY: { value: number }; positionZ: { value: number } }> = [];
  const ctx = {
    state: 'running',
    currentTime: 1,
    sampleRate: SR,
    destination: node(),
    listener: { positionX: param(), positionY: param(), positionZ: param(), forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param() },
    resume: vi.fn(async () => {}),
    suspend: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    createGain: () => ({ ...node(), gain: param() }),
    createDynamicsCompressor: () => ({ ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createBiquadFilter: () => ({ ...node(), frequency: param(), Q: param(), gain: param(), type: '' }),
    createPanner: () => {
      const p = { ...node(), positionX: param(), positionY: param(), positionZ: param(), panningModel: '', distanceModel: '', refDistance: 0, rolloffFactor: 0 };
      panners.push(p);
      return p;
    },
    createBuffer: (_c: number, n: number) => ({ length: n, getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => {
      const s = { ...node(), start: vi.fn(), stop: vi.fn(), buffer: null as unknown, onended: null as unknown };
      sources.push(s);
      return s;
    },
  };
  return { ctx: ctx as unknown as AudioContext, raw: ctx, sources, panners };
}

describe('GuitarSynth', () => {
  const positions = { electric: GUITAR_ELECTRIC, acoustic: GUITAR_ACOUSTIC, piano: PIANO };

  it('puts each guitar where it hangs on the wall', () => {
    const h = fakeContext();
    new GuitarSynth(positions, () => h.ctx).prepare();
    const xs = h.panners.map((p) => [p.positionX.value, p.positionY.value, p.positionZ.value]);
    expect(xs).toContainEqual([GUITAR_ELECTRIC.x, GUITAR_ELECTRIC.y, GUITAR_ELECTRIC.z]);
    expect(xs).toContainEqual([GUITAR_ACOUSTIC.x, GUITAR_ACOUSTIC.y, GUITAR_ACOUSTIC.z]);
  });

  it('a strum plays six strings, low to high, with a small stagger, then high to low on the next', () => {
    const h = fakeContext();
    const g = new GuitarSynth(positions, () => h.ctx);
    expect(g.strum('electric')).toEqual(tuningHz('electric'));
    expect(h.sources).toHaveLength(6);
    const t = (i: number) => (h.sources[i].start.mock.calls[0][0] as number);
    expect(t(0)).toBeLessThan(t(5));
    expect(t(1) - t(0)).toBeGreaterThan(0.01);
    expect(t(1) - t(0)).toBeLessThan(0.06);
    g.strum('electric');
    const second = h.sources.slice(6).map((s) => s.start.mock.calls[0][0] as number);
    expect(second[0]).toBeLessThan(second[5]); // still starts earliest first...
    expect(h.sources[6].buffer).toBe(h.sources[5].buffer); // ...but it is the highest string that sounds first
  });

  it('strums the acoustic in open D', () => {
    const h = fakeContext();
    expect(new GuitarSynth(positions, () => h.ctx).strum('acoustic')).toEqual(tuningHz('acoustic'));
  });

  it('does nothing without audio support, or after dispose', () => {
    expect(new GuitarSynth(positions, () => null).strum('electric')).toBeNull();
    const h = fakeContext();
    const g = new GuitarSynth(positions, () => h.ctx);
    g.prepare();
    g.dispose();
    expect(g.strum('electric')).toBeNull();
    expect(h.raw.close).toHaveBeenCalled();
  });

  it('a held room keeps the guitar quiet, and release lets it ring again', () => {
    const h = fakeContext();
    const g = new GuitarSynth(positions, () => h.ctx);
    g.prepare();
    g.hold();
    expect(h.raw.suspend).toHaveBeenCalled();
    (h.raw as { state: string }).state = 'suspended';
    g.strum('electric');
    expect(h.raw.resume).not.toHaveBeenCalled();
    g.release();
    expect(h.raw.resume).toHaveBeenCalled();
  });
});

const NOTE = (name: string) => {
  const idx: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const m = /^([A-G])(b|#)?(\d)$/.exec(name)!;
  return 12 * (Number(m[3]) + 1) + idx[m[1]] + (m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0);
};

describe('keyboard chords', () => {
  it('F maj9 is F C, F G A, C E', () => {
    expect(PIANO_CHORDS[0].notes.map((m) => m % 12)).toEqual(['F', 'C', 'F', 'G', 'A', 'C', 'E'].map((n) => NOTE(n + '4') % 12));
  });

  it('the second chord is E, D, Ab, C, D, G', () => {
    expect(PIANO_CHORDS[1].notes.map((m) => m % 12)).toEqual(['E', 'D', 'Ab', 'C', 'D', 'G'].map((n) => NOTE(n + '4') % 12));
  });

  it('A minor 9 has A and E in the bass, then G B C E', () => {
    expect(PIANO_CHORDS[2].notes.map((m) => m % 12)).toEqual(['A', 'E', 'G', 'B', 'C', 'E'].map((n) => NOTE(n + '4') % 12));
    expect(PIANO_CHORDS[2].notes.slice(0, 2)).toEqual([NOTE('A2'), NOTE('E3')]);
  });

  it('every chord is voiced low to high', () => {
    for (const c of PIANO_CHORDS) expect([...c.notes]).toEqual([...c.notes].sort((a, b) => a - b));
  });
});

describe('pianoNote', () => {
  it('rings at the note pitch', () => {
    for (const midi of [41, 55, 64]) {
      const hz = 440 * Math.pow(2, (midi - 69) / 12);
      const lag = period(pianoNote(midi, SR, 1), 60, 400);
      expect(Math.abs(SR / lag - hz) / hz).toBeLessThan(0.03);
    }
  });

  it('is finite, normalised, begins softly, and dies away', () => {
    const x = pianoNote(48, SR, 5);
    expect(x.every(Number.isFinite)).toBe(true);
    const peak = (from: number, to: number) => x.slice(from, to).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak(0, x.length)).toBeCloseTo(1, 5);
    expect(Math.abs(x[0])).toBe(0);
    expect(peak(4 * SR, 5 * SR)).toBeLessThan(peak(0, SR / 2) * 0.3);
  });
});

describe('GuitarSynth keyboard', () => {
  const positions = { electric: GUITAR_ELECTRIC, acoustic: GUITAR_ACOUSTIC, piano: PIANO };

  it('each press plays the next chord, then wraps round', () => {
    const h = fakeContext();
    const g = new GuitarSynth(positions, () => h.ctx);
    const hz = (i: number) => PIANO_CHORDS[i].notes.map((m) => 440 * Math.pow(2, (m - 69) / 12));
    expect(g.nextChord).toBe('F maj9');
    expect(g.strum('piano')).toEqual(hz(0));
    expect(g.strum('piano')).toEqual(hz(1));
    expect(g.strum('piano')).toEqual(hz(2));
    expect(g.strum('piano')).toEqual(hz(0));
  });

  it('plays all the notes of a chord almost together, not one by one', () => {
    const h = fakeContext();
    new GuitarSynth(positions, () => h.ctx).strum('piano');
    const starts = h.sources.map((s) => s.start.mock.calls[0][0] as number);
    expect(h.sources).toHaveLength(PIANO_CHORDS[0].notes.length);
    expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(0.08);
  });

  it('the next chord lifts the last one off, like releasing a pedal; the first has nothing to lift', () => {
    const h = fakeContext();
    const g = new GuitarSynth(positions, () => h.ctx);
    g.strum('piano');
    expect(h.sources.every((s) => s.stop.mock.calls.length === 0)).toBe(true);
    const first = h.sources.slice();
    g.strum('piano');
    for (const s of first) {
      expect(s.stop).toHaveBeenCalledTimes(1);
      const at = s.stop.mock.calls[0][0] as number;
      expect(at).toBeGreaterThan(h.raw.currentTime);
      expect(at).toBeLessThan(h.raw.currentTime + 0.5); // a quick damp, not a long tail
    }
    const second = h.sources.slice(first.length);
    expect(second.every((s) => s.stop.mock.calls.length === 0)).toBe(true);
  });

  it('plays from the keyboard on the wall side', () => {
    const h = fakeContext();
    new GuitarSynth(positions, () => h.ctx).prepare();
    expect(h.panners.map((p) => [p.positionX.value, p.positionZ.value])).toContainEqual([PIANO.x, PIANO.z]);
  });
});
