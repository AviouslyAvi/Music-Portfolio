import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { Terminal } from './Terminal';

function mockReduced(reduced: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: reduced && q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers();
  mockReduced(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('Terminal', () => {
  it('does not call onDone before minMs', () => {
    const onDone = vi.fn();
    render(<Terminal engineReady failed={false} onDone={onDone} minMs={2500} />);
    tick(2499);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('does not call onDone while the engine is not ready, even after minMs', () => {
    const onDone = vi.fn();
    const { rerender } = render(<Terminal engineReady={false} failed={false} onDone={onDone} minMs={2500} />);
    tick(10000);
    expect(onDone).not.toHaveBeenCalled();
    rerender(<Terminal engineReady failed={false} onDone={onDone} minMs={2500} />);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onDone once after both', () => {
    const onDone = vi.fn();
    const { rerender } = render(<Terminal engineReady failed={false} onDone={onDone} minMs={2500} />);
    tick(2500);
    expect(onDone).toHaveBeenCalledTimes(1);
    rerender(<Terminal engineReady failed={false} onDone={onDone} minMs={2500} />);
    tick(5000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reports the real stages: loading lines first, ready only once the engine is', () => {
    const { rerender } = render(<Terminal engineReady={false} failed={false} onDone={() => {}} minMs={2500} />);
    tick(2600);
    expect(screen.getByText(/loading engine/i)).toBeTruthy();
    expect(screen.getByText(/loading samples/i)).toBeTruthy();
    expect(screen.queryByText(/^ready/i)).toBeNull();
    rerender(<Terminal engineReady failed={false} onDone={() => {}} minMs={2500} />);
    expect(screen.getByText(/^ready/i)).toBeTruthy();
  });

  it('failed prints the failure line and never calls onDone', () => {
    const onDone = vi.fn();
    render(<Terminal engineReady={false} failed onDone={onDone} minMs={2500} />);
    tick(10000);
    expect(screen.getByText('engine failed to load')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('a failure after readiness still blocks onDone', () => {
    const onDone = vi.fn();
    render(<Terminal engineReady failed onDone={onDone} minMs={100} />);
    tick(1000);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('under reduced motion there is no falling-code field and the lines appear at once but minMs still holds', () => {
    mockReduced(true);
    const onDone = vi.fn();
    const { container } = render(<Terminal engineReady failed={false} onDone={onDone} minMs={2500} />);
    expect(container.querySelector('[data-code-field]')).toBeNull();
    expect(screen.getByText(/loading engine/i)).toBeTruthy();
    expect(screen.getByText(/loading samples/i)).toBeTruthy();
    tick(2000);
    expect(onDone).not.toHaveBeenCalled();
    tick(500);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows the falling-code field when motion is allowed', () => {
    const { container } = render(<Terminal engineReady failed={false} onDone={() => {}} />);
    expect(container.querySelector('[data-code-field]')).not.toBeNull();
  });

  it('unmounting before minMs never calls onDone', () => {
    const onDone = vi.fn();
    const { unmount } = render(<Terminal engineReady failed={false} onDone={onDone} minMs={2500} />);
    unmount();
    tick(5000);
    expect(onDone).not.toHaveBeenCalled();
  });
});
