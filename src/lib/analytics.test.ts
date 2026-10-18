import { describe, it, expect, vi } from 'vitest';
import { track } from './analytics';

describe('track', () => {
  it('sends the event name through the given sender', () => {
    const spy = vi.fn();
    track('demo_played', spy);
    expect(spy).toHaveBeenCalledWith('demo_played');
  });
  it('does not throw without a sender or window.plausible', () => {
    expect(() => track('room_entered')).not.toThrow();
  });
  it('uses window.plausible by default', () => {
    const plausible = vi.fn();
    (globalThis as { window?: unknown }).window = { plausible };
    try {
      track('premonition_viewed');
      expect(plausible).toHaveBeenCalledWith('premonition_viewed');
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  });
});
