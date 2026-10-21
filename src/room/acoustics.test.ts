import { describe, it, expect } from 'vitest';
import { ROOM_ACOUSTICS, roomImpulse } from './acoustics';

describe('room acoustics', () => {
  it('knows the room is 4 x 6 x 2.7 metres', () => {
    expect(ROOM_ACOUSTICS.volume).toBeCloseTo(64.8, 1);
  });

  it('has a reverb time that suits a furnished room this size (a third to two thirds of a second)', () => {
    expect(ROOM_ACOUSTICS.rt60).toBeGreaterThan(0.33);
    expect(ROOM_ACOUSTICS.rt60).toBeLessThan(0.67);
  });

  it('builds a deterministic two-ear impulse response that decays 60 dB by the reverb time', () => {
    const sr = 48000;
    const a = roomImpulse(sr);
    const b = roomImpulse(sr);
    expect(a).toHaveLength(2);
    expect(a[0]).toEqual(b[0]);
    expect(a[0]).not.toEqual(a[1]);
    for (const ch of a) {
      expect(ch.every(Number.isFinite)).toBe(true);
      const peak = (from: number, to: number) => ch.slice(from, to).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(peak(0, ch.length)).toBeLessThan(1);
      const early = peak(0, Math.floor(0.1 * sr));
      const late = peak(Math.floor(ROOM_ACOUSTICS.rt60 * sr), ch.length);
      expect(late).toBeLessThan(early * 0.01); // 40 dB or more down by the reverb time
    }
  });

  it('has early reflections before the diffuse tail builds (a quiet gap then distinct taps)', () => {
    const sr = 48000;
    const [l] = roomImpulse(sr);
    const first = l.findIndex((v) => Math.abs(v) > 0.05);
    expect(first / sr).toBeGreaterThan(0.001);
    expect(first / sr).toBeLessThan(0.05);
  });
});
