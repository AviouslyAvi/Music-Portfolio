import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { StubPluginScreen } from './StubPluginScreen';
import { STUB_SOURCES } from './stubRoom';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('StubPluginScreen', () => {
  it('fires onReady, then onSoundPlayed for the clicked id, and marks played ids dimmed', () => {
    const onReady = vi.fn();
    const onSoundPlayed = vi.fn();
    const { rerender } = render(
      <StubPluginScreen sources={STUB_SOURCES} playedIds={new Set()} onSoundPlayed={onSoundPlayed} onReady={onReady} />,
    );
    expect(onReady).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(500));
    expect(onReady).toHaveBeenCalledTimes(1);

    const first = STUB_SOURCES[0];
    fireEvent.click(screen.getByRole('button', { name: first.label }));
    expect(onSoundPlayed).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(300));
    expect(onSoundPlayed).toHaveBeenCalledWith(first.id);

    expect(screen.getByRole('button', { name: first.label }).getAttribute('data-played')).toBe('false');
    rerender(
      <StubPluginScreen sources={STUB_SOURCES} playedIds={new Set([first.id])} onSoundPlayed={onSoundPlayed} onReady={onReady} />,
    );
    const btn = screen.getByRole('button', { name: first.label }) as HTMLButtonElement;
    expect(btn.getAttribute('data-played')).toBe('true');
    expect(btn.disabled).toBe(false);
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
