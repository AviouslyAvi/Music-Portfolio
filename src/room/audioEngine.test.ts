import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crossfadeGains, TrackPlayer, CROSSFADE_SECONDS } from './audioEngine';
import type { Track } from '@/content/tracks';

describe('crossfadeGains', () => {
  it('endpoints', () => {
    expect(crossfadeGains(0, 2)).toEqual({ out: 1, in: 0 });
    const end = crossfadeGains(2, 2);
    expect(end.out).toBeCloseTo(0, 10);
    expect(end.in).toBeCloseTo(1, 10);
  });
  it('is equal power at the midpoint and throughout', () => {
    for (const t of [0.3, 1, 1.4]) {
      const g = crossfadeGains(t, 2);
      expect(g.out ** 2 + g.in ** 2).toBeCloseTo(1, 10);
    }
  });
  it('clamps t', () => {
    expect(crossfadeGains(-5, 2)).toEqual(crossfadeGains(0, 2));
    expect(crossfadeGains(9, 2)).toEqual(crossfadeGains(2, 2));
  });
});

class FakeParam {
  value = 0;
  curves: Array<{ values: Float32Array; start: number; dur: number }> = [];
  setValueCurveAtTime(values: Float32Array, start: number, dur: number) {
    this.curves.push({ values, start, dur });
  }
}
class FakeNode {
  connected: unknown[] = [];
  disconnected = 0;
  connect(n: unknown) {
    this.connected.push(n);
  }
  disconnect() {
    this.disconnected++;
  }
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  started = 0;
  stopped = 0;
  start() {
    this.started++;
  }
  stop() {
    this.stopped++;
  }
}
class FakePanner extends FakeNode {
  panningModel = '';
  distanceModel = '';
  refDistance = 0;
  rolloffFactor = 0;
  positionX = new FakeParam();
  positionY = new FakeParam();
  positionZ = new FakeParam();
}

function makeCtx(opts: { state?: string; resume?: () => Promise<void>; legacyListener?: boolean } = {}) {
  const sources: FakeSource[] = [];
  const gains: FakeGain[] = [];
  const panners: FakePanner[] = [];
  const listener = opts.legacyListener
    ? { setPosition: vi.fn(), setOrientation: vi.fn() }
    : {
        positionX: new FakeParam(), positionY: new FakeParam(), positionZ: new FakeParam(),
        forwardX: new FakeParam(), forwardY: new FakeParam(), forwardZ: new FakeParam(),
        upX: new FakeParam(), upY: new FakeParam(), upZ: new FakeParam(),
      };
  const ctx = {
    state: opts.state ?? 'running',
    currentTime: 10,
    destination: new FakeNode(),
    listener,
    resume: opts.resume ?? (async () => {}),
    createGain: () => {
      const g = new FakeGain();
      gains.push(g);
      return g;
    },
    createBufferSource: () => {
      const s = new FakeSource();
      sources.push(s);
      return s;
    },
    createPanner: () => {
      const p = new FakePanner();
      panners.push(p);
      return p;
    },
    decodeAudioData: vi.fn(async (b: ArrayBuffer) => {
      if (new Uint8Array(b)[0] === 255) throw new Error('bad audio');
      return { tag: 'buf' } as unknown as AudioBuffer;
    }),
  };
  return { ctx: ctx as unknown as AudioContext, raw: ctx, sources, gains, panners, listener };
}

const T = (id: string): Track => ({ id, title: `Title ${id}`, src: `/a/${id}.mp3`, placeholder: true });
const TRACKS = [T('a'), T('b'), T('c')];

function makeFetch(bad: string[] = []) {
  return vi.fn(async (url: string) => {
    const broken = bad.some((id) => url.includes(`/${id}.`));
    return { ok: true, arrayBuffer: async () => new Uint8Array([broken ? 255 : 1]).buffer };
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function settle(ms = CROSSFADE_SECONDS * 1000) {
  await vi.advanceTimersByTimeAsync(ms);
}

describe('TrackPlayer', () => {
  it('start plays the first track and sets the panner positions', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch());
    await p.start();
    expect(p.index).toBe(0);
    expect(p.title).toBe('Title a');
    expect(h.sources).toHaveLength(1);
    expect(h.sources[0].started).toBe(1);
    expect(h.panners).toHaveLength(2);
    expect(h.panners.map((x) => x.positionX.value)).toEqual([-1.6, 1.85]);
    expect(h.panners.every((x) => x.positionY.value === 1 && x.distanceModel === 'inverse' && x.refDistance === 1.5 && x.rolloffFactor === 1)).toBe(true);
    expect(h.panners.every((x) => x.connected[0] === h.raw.destination)).toBe(true);
  });

  it('ignores next() during a fade and returns the same promise (one advance per fade)', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch());
    await p.start();
    const first = p.next();
    const second = p.next();
    const third = p.next();
    expect(second).toBe(first);
    expect(third).toBe(first);
    await settle();
    await first;
    expect(p.index).toBe(1);
    expect(h.sources).toHaveLength(2);
    expect(h.sources[0].stopped).toBe(1);
    // after the fade completes a new call is accepted
    const again = p.next();
    expect(again).not.toBe(first);
    await settle();
    await again;
    expect(p.index).toBe(2);
  });

  it('fades with equal-power curves over 1.5 s', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch());
    await p.start();
    const pending = p.next();
    await vi.advanceTimersByTimeAsync(0);
    const outGain = h.gains[1];
    const inGain = h.gains[2];
    const o = outGain.gain.curves[0];
    const i = inGain.gain.curves[0];
    expect(o.dur).toBe(1.5);
    expect(o.start).toBe(10);
    expect(o.values[0]).toBeCloseTo(1);
    expect(o.values[o.values.length - 1]).toBeCloseTo(0);
    expect(i.values[0]).toBeCloseTo(0);
    expect(i.values[i.values.length - 1]).toBeCloseTo(1);
    const mid = Math.floor(o.values.length / 2);
    expect(o.values[mid] ** 2 + i.values[mid] ** 2).toBeCloseTo(1, 1);
    await settle();
    await pending;
  });

  it('loops the playlist', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch());
    await p.start();
    for (let k = 0; k < 3; k++) {
      const n = p.next();
      await settle();
      await n;
    }
    expect(p.index).toBe(0);
  });

  it('single track: next() does nothing', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, [T('a')], h.raw.destination as unknown as AudioNode, makeFetch());
    await p.start();
    await p.next();
    expect(p.index).toBe(0);
    expect(h.sources).toHaveLength(1);
  });

  it('a failing track reports its id and is skipped', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch(['b']));
    const errs: string[] = [];
    p.onError((e) => errs.push(e.trackId));
    await p.start();
    const n = p.next();
    await settle();
    await n;
    expect(errs).toEqual(['b']);
    expect(p.index).toBe(2);
    expect(p.title).toBe('Title c');
  });

  it('a failing first track on start moves to the next working one', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch(['a']));
    const errs: string[] = [];
    p.onError((e) => errs.push(e.trackId));
    await p.start();
    expect(errs).toEqual(['a']);
    expect(p.index).toBe(1);
    expect(h.sources).toHaveLength(1);
  });

  it('a network rejection is treated like a decode failure', async () => {
    const h = makeCtx();
    const f = vi.fn(async () => {
      throw new Error('offline');
    });
    const p = new TrackPlayer(h.ctx, [T('a')], h.raw.destination as unknown as AudioNode, f);
    const errs: string[] = [];
    p.onError((e) => errs.push(e.trackId));
    await expect(p.start()).resolves.toBeUndefined();
    expect(errs).toEqual(['a']);
  });

  it('when every track fails: one error each, silent, no loop, no throw', async () => {
    const h = makeCtx();
    const f = makeFetch(['a', 'b', 'c']);
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, f);
    const errs: string[] = [];
    p.onError((e) => errs.push(e.trackId));
    await expect(p.start()).resolves.toBeUndefined();
    expect(errs).toEqual(['a', 'b', 'c']);
    expect(h.sources).toHaveLength(0);
    expect(f).toHaveBeenCalledTimes(3);
    await expect(p.next()).resolves.toBeUndefined();
    expect(h.sources).toHaveLength(0);
  });

  it('next() keeps the current track when no other track works', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch(['b', 'c']));
    const errs: string[] = [];
    p.onError((e) => errs.push(e.trackId));
    await p.start();
    await p.next();
    expect(errs).toEqual(['b', 'c']);
    expect(p.index).toBe(0);
    expect(h.sources[0].stopped).toBe(0);
  });

  it('resumes a suspended context', async () => {
    const resume = vi.fn(async () => {});
    const h = makeCtx({ state: 'suspended', resume });
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch());
    await p.start();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(h.sources).toHaveLength(1);
  });

  it('a rejected resume is reported, not thrown', async () => {
    const h = makeCtx({ state: 'suspended', resume: async () => { throw new Error('blocked'); } });
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch());
    const errs: string[] = [];
    p.onError((e) => errs.push(e.trackId));
    await expect(p.start()).resolves.toBeUndefined();
    expect(errs).toEqual(['audio-context']);
  });

  it('dispose is idempotent and tears everything down', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch());
    await p.start();
    p.dispose();
    const count = h.sources[0].stopped;
    expect(count).toBe(1);
    expect(h.sources[0].disconnected).toBeGreaterThan(0);
    expect(h.panners.every((x) => x.disconnected === 1)).toBe(true);
    expect(() => p.dispose()).not.toThrow();
    expect(h.sources[0].stopped).toBe(count);
    await expect(p.next()).resolves.toBeUndefined();
  });

  it('dispose during a fade settles the pending promise', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch());
    await p.start();
    const n = p.next();
    await vi.advanceTimersByTimeAsync(0);
    p.dispose();
    await expect(n).resolves.toBeUndefined();
    expect(h.sources.every((s) => s.stopped >= 1)).toBe(true);
  });

  it('a fetch resolving after dispose does not start playback', async () => {
    const h = makeCtx();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const f = vi.fn(async () => {
      await gate;
      return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer };
    });
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, f);
    const started = p.start();
    p.dispose();
    release();
    await started;
    expect(h.sources).toHaveLength(0);
  });

  it('setListenerPose uses AudioParams: forward is -z at yaw 0, -x at yaw PI/2', () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch());
    const l = h.listener as unknown as Record<string, FakeParam>;
    p.setListenerPose(1, 2, 0);
    expect([l.positionX.value, l.positionZ.value]).toEqual([1, 2]);
    expect(l.forwardX.value).toBeCloseTo(0);
    expect(l.forwardZ.value).toBeCloseTo(-1);
    p.setListenerPose(0, 0, Math.PI / 2);
    expect(l.forwardX.value).toBeCloseTo(-1);
    expect(l.forwardZ.value).toBeCloseTo(0);
  });

  it('setListenerPose falls back to setPosition and setOrientation', () => {
    const h = makeCtx({ legacyListener: true });
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch());
    p.setListenerPose(3, 4, 0);
    const l = h.listener as { setPosition: ReturnType<typeof vi.fn>; setOrientation: ReturnType<typeof vi.fn> };
    expect(l.setPosition).toHaveBeenCalledWith(3, 1.6, 4);
    const o = l.setOrientation.mock.calls[0];
    expect(o[0]).toBeCloseTo(0);
    expect(o[2]).toBeCloseTo(-1);
  });

  const active = (h: ReturnType<typeof makeCtx>) => h.sources.filter((x) => x.started > x.stopped).length;

  it('next() called while start() is loading waits, leaving one active source', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch());
    const s = p.start();
    const n = p.next();
    await s;
    await settle();
    await n;
    expect(p.index).toBe(1);
    expect(active(h)).toBe(1);
    p.dispose();
    expect(active(h)).toBe(0);
  });

  it('next() before start() calls start() first, then advances', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch());
    const n = p.next();
    await settle();
    await n;
    expect(p.index).toBe(1);
    expect(active(h)).toBe(1);
    p.dispose();
    expect(active(h)).toBe(0);
  });

  it('next() right after dispose does nothing', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch());
    await p.start();
    p.dispose();
    await expect(p.next()).resolves.toBeUndefined();
    expect(h.sources).toHaveLength(1);
    expect(active(h)).toBe(0);
  });

  it('caches decoded buffers: one fetch per track over a full loop', async () => {
    const h = makeCtx();
    const f = makeFetch();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, f);
    await p.start();
    for (let k = 0; k < 4; k++) {
      const n = p.next();
      await settle();
      await n;
    }
    expect(f).toHaveBeenCalledTimes(TRACKS.length);
  });

  it('a throwing onError callback does not break the engine', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch(['a']));
    const seen: string[] = [];
    p.onError(() => {
      throw new Error('listener bug');
    });
    p.onError((e) => seen.push(e.trackId));
    await expect(p.start()).resolves.toBeUndefined();
    expect(seen).toEqual(['a']);
    expect(p.index).toBe(1);
  });

  it('dispose clears error callbacks', async () => {
    const h = makeCtx();
    const p = new TrackPlayer(h.ctx, TRACKS, h.raw.destination as unknown as AudioNode, makeFetch(['a']));
    const cb = vi.fn();
    p.onError(cb);
    const s = p.start();
    p.dispose();
    await s;
    expect(cb).not.toHaveBeenCalled();
  });
});
