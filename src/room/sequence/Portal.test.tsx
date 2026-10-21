import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { Portal } from './Portal';
import { PORTAL_MS } from './portalMath';

function fakeCtx() {
  const noop = () => {};
  const grad = { addColorStop: noop };
  return new Proxy({} as Record<string, unknown>, {
    get: (t, k: string) => (k in t ? t[k] : k.startsWith('create') ? () => grad : noop),
    set: (t, k: string, v) => ((t[k] = v), true),
  });
}

let raf: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  raf = vi.fn((cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  HTMLCanvasElement.prototype.getContext = (() => fakeCtx()) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Portal', () => {
  it('calls onDone exactly once at PORTAL_MS', () => {
    const onDone = vi.fn();
    render(<Portal onDone={onDone} />);
    act(() => void vi.advanceTimersByTime(PORTAL_MS - 1));
    expect(onDone).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(50));
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(10000));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reduced calls onDone after 400 ms and draws no animation frames', () => {
    const onDone = vi.fn();
    render(<Portal onDone={onDone} reduced />);
    act(() => void vi.advanceTimersByTime(399));
    expect(onDone).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(2));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(raf).not.toHaveBeenCalled();
  });

  it('renders nothing and still calls onDone when canvas is unavailable', () => {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const onDone = vi.fn();
    const { container } = render(<Portal onDone={onDone} />);
    expect(container.querySelector('canvas')).toBeNull();
    act(() => void vi.advanceTimersByTime(PORTAL_MS + 10));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('unmounting before the end never calls onDone', () => {
    const onDone = vi.fn();
    const { unmount } = render(<Portal onDone={onDone} />);
    act(() => void vi.advanceTimersByTime(1000));
    unmount();
    act(() => void vi.advanceTimersByTime(10000));
    expect(onDone).not.toHaveBeenCalled();
  });
});
