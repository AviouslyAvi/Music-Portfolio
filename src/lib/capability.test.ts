import { describe, it, expect } from 'vitest';
import { shouldOfferRoom, detectEnv, type Env } from './capability';

const good: Env = { webgl: true, reducedMotion: false, coarsePointer: false, viewportWidth: 1440, deviceMemory: 8, hardwareConcurrency: 8 };

describe('shouldOfferRoom', () => {
  it('offers the room to a capable desktop', () => {
    expect(shouldOfferRoom(good)).toBe(true);
  });
  it('declines only without webgl', () => {
    expect(shouldOfferRoom({ ...good, webgl: false })).toBe(false);
  });
  const stillOffered: [string, Partial<Env>][] = [
    ['reduced motion', { reducedMotion: true }],
    ['coarse pointer', { coarsePointer: true }],
    ['narrow viewport', { viewportWidth: 390 }],
    ['low memory', { deviceMemory: 2 }],
    ['few cores', { hardwareConcurrency: 2 }],
  ];
  for (const [name, patch] of stillOffered) {
    it(`still offers with ${name} (phones get the room too)`, () => {
      expect(shouldOfferRoom({ ...good, ...patch })).toBe(true);
    });
  }
});

describe('detectEnv', () => {
  it('reads the window', () => {
    const ctx = {};
    const win = {
      innerWidth: 1280,
      document: { createElement: () => ({ getContext: (k: string) => (k === 'webgl2' ? ctx : null) }) },
      matchMedia: (q: string) => ({ matches: q.includes('reduce') }),
      navigator: { deviceMemory: 4, hardwareConcurrency: 6 },
    } as unknown as Window;
    expect(detectEnv(win)).toEqual({ webgl: true, reducedMotion: true, coarsePointer: false, viewportWidth: 1280, deviceMemory: 4, hardwareConcurrency: 6 });
  });
  it('reports no webgl when no context is available', () => {
    const win = {
      innerWidth: 1280,
      document: { createElement: () => ({ getContext: () => null }) },
      matchMedia: () => ({ matches: false }),
      navigator: {},
    } as unknown as Window;
    expect(detectEnv(win).webgl).toBe(false);
  });
});
