import { describe, it, expect } from 'vitest';
import { dollyProgress, PORTAL_MS } from './portalMath';

describe('dollyProgress', () => {
  it('is 0 at 0, 1 at 1, monotonic and accelerating (second half covers more than the first)', () => {
    expect(dollyProgress(0)).toBe(0);
    expect(dollyProgress(1)).toBe(1);
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = dollyProgress(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    const firstHalf = dollyProgress(0.5) - dollyProgress(0);
    const secondHalf = dollyProgress(1) - dollyProgress(0.5);
    expect(secondHalf).toBeGreaterThan(firstHalf);
  });
  it('clamps outside 0..1', () => {
    expect(dollyProgress(-1)).toBe(0);
    expect(dollyProgress(4)).toBe(1);
  });
  it('lasts three seconds', () => {
    expect(PORTAL_MS).toBe(3000);
  });
});
