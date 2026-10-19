import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRenderedAudio } from './useRenderedAudio';

class FakeAudio {
  static all: FakeAudio[] = [];
  static playImpl: () => Promise<void> = () => Promise.resolve();
  listeners = new Map<string, Set<() => void>>();
  paused = false;
  currentTime = 5;
  preload = '';
  pause = vi.fn(() => { this.paused = true; });
  constructor(public src: string) { FakeAudio.all.push(this); }
  addEventListener(t: string, f: () => void) {
    if (!this.listeners.has(t)) this.listeners.set(t, new Set());
    this.listeners.get(t)!.add(f);
  }
  removeEventListener(t: string, f: () => void) { this.listeners.get(t)?.delete(f); }
  play() { return FakeAudio.playImpl(); }
  emit(t: string) { [...(this.listeners.get(t) ?? [])].forEach((f) => f()); }
  listenerCount() { return [...this.listeners.values()].reduce((n, s) => n + s.size, 0); }
}

beforeEach(() => {
  FakeAudio.all = [];
  FakeAudio.playImpl = () => Promise.resolve();
  vi.stubGlobal('Audio', FakeAudio);
});
afterEach(() => vi.unstubAllGlobals());

describe('useRenderedAudio', () => {
  it('resolves when ended fires', async () => {
    const { result } = renderHook(() => useRenderedAudio());
    const p = result.current.play('/a.mp3');
    FakeAudio.all[0].emit('ended');
    await expect(p).resolves.toBeUndefined();
    expect(FakeAudio.all[0].src).toBe('/a.mp3');
  });

  it.each(['error', 'abort'])('rejects on %s', async (evt) => {
    const { result } = renderHook(() => useRenderedAudio());
    const p = result.current.play('/a.mp3');
    FakeAudio.all[0].emit(evt);
    await expect(p).rejects.toBeInstanceOf(Error);
  });

  it('rejects when audio.play() rejects (autoplay refusal)', async () => {
    FakeAudio.playImpl = () => Promise.reject(new Error('NotAllowedError'));
    const { result } = renderHook(() => useRenderedAudio());
    await expect(result.current.play('/a.mp3')).rejects.toThrow('NotAllowedError');
  });

  it('a second play stops the first', async () => {
    const { result } = renderHook(() => useRenderedAudio());
    const first = result.current.play('/a.mp3');
    const firstAudio = FakeAudio.all[0];
    const second = result.current.play('/b.mp3');
    await expect(first).rejects.toBeInstanceOf(Error);
    expect(firstAudio.pause).toHaveBeenCalled();
    expect(firstAudio.currentTime).toBe(0);
    expect(firstAudio.listenerCount()).toBe(0);
    FakeAudio.all[1].emit('ended');
    await expect(second).resolves.toBeUndefined();
  });

  it('stop() pauses, resets and settles the pending promise', async () => {
    const { result } = renderHook(() => useRenderedAudio());
    const p = result.current.play('/a.mp3');
    result.current.stop();
    await expect(p).rejects.toBeInstanceOf(Error);
    expect(FakeAudio.all[0].pause).toHaveBeenCalled();
    expect(FakeAudio.all[0].currentTime).toBe(0);
  });

  it('unmount stops audio and leaves no listeners', async () => {
    const { result, unmount } = renderHook(() => useRenderedAudio());
    const p = result.current.play('/a.mp3');
    const audio = FakeAudio.all[0];
    unmount();
    await expect(p).rejects.toBeInstanceOf(Error);
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.currentTime).toBe(0);
    expect(audio.listenerCount()).toBe(0);
  });
});
