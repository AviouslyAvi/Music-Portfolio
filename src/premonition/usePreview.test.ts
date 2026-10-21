import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderResult } from './engine/types';
import { usePreview } from './usePreview';

class FakeSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn(() => {
    this.started = true;
  });
  stop = vi.fn(() => {
    this.stopped = true;
    // real nodes fire ended on stop(), too
    this.onended?.();
  });
  end() {
    this.onended?.();
  }
}

let contexts: FakeContext[] = [];
class FakeContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  destination = { kind: 'destination' };
  sources: FakeSource[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => ({
    channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: () => new Float32Array(length),
  }));
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  constructor() {
    contexts.push(this);
  }
}

const result = (): RenderResult => ({ channels: [new Float32Array(480), new Float32Array(480)], sampleRate: 48000 });

beforeEach(() => {
  contexts = [];
  vi.stubGlobal('AudioContext', FakeContext);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usePreview', () => {
  it('play creates the context on first call and reuses it', async () => {
    const { result: h } = renderHook(() => usePreview());
    expect(contexts).toHaveLength(0);
    await act(async () => h.current.play(result(), () => {}));
    await act(async () => h.current.play(result(), () => {}));
    expect(contexts).toHaveLength(1);
  });

  it('play resumes a suspended context and plays to the destination', async () => {
    const { result: h } = renderHook(() => usePreview());
    await act(async () => h.current.play(result(), () => {}));
    expect(contexts[0].resume).toHaveBeenCalled();
    const s = contexts[0].sources[0];
    expect(s.connect).toHaveBeenCalledWith(contexts[0].destination);
    expect(s.started).toBe(true);
    expect(contexts[0].createBuffer).toHaveBeenCalledWith(2, 480, 48000);
    expect(h.current.playing).toBe(true);
  });

  it('onEnded fires once when the source ends naturally', async () => {
    const onEnded = vi.fn();
    const { result: h } = renderHook(() => usePreview());
    await act(async () => h.current.play(result(), onEnded));
    act(() => {
      contexts[0].sources[0].end();
      contexts[0].sources[0].end();
    });
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(h.current.playing).toBe(false);
  });

  it('stop does not fire onEnded', async () => {
    const onEnded = vi.fn();
    const { result: h } = renderHook(() => usePreview());
    await act(async () => h.current.play(result(), onEnded));
    act(() => h.current.stop());
    expect(contexts[0].sources[0].stopped).toBe(true);
    expect(onEnded).not.toHaveBeenCalled();
    expect(h.current.playing).toBe(false);
  });

  it('a second play stops the first without firing its onEnded', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result: h } = renderHook(() => usePreview());
    await act(async () => h.current.play(result(), first));
    await act(async () => h.current.play(result(), second));
    expect(contexts[0].sources[0].stopped).toBe(true);
    expect(first).not.toHaveBeenCalled();
    act(() => contexts[0].sources[1].end());
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('a stop while the context is still resuming plays nothing', async () => {
    const onEnded = vi.fn();
    const { result: h } = renderHook(() => usePreview());
    let p!: Promise<void>;
    await act(async () => {
      p = h.current.play(result(), onEnded);
      h.current.stop();
      await p;
    });
    expect(contexts[0].sources.every((s) => !s.started)).toBe(true);
    expect(onEnded).not.toHaveBeenCalled();
  });

  it('unmount closes the context and stops sound', async () => {
    const onEnded = vi.fn();
    const { result: h, unmount } = renderHook(() => usePreview());
    await act(async () => h.current.play(result(), onEnded));
    unmount();
    expect(contexts[0].sources[0].stopped).toBe(true);
    expect(contexts[0].close).toHaveBeenCalled();
    expect(onEnded).not.toHaveBeenCalled();
  });
});
