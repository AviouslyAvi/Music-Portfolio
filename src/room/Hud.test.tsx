import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Hud } from './Hud';

beforeEach(() => cleanup());

describe('Hud', () => {
  it('has exactly one control, Skip to site, and no iPod, computer or leave buttons', () => {
    render(<Hud trackTitle="Space" onSkip={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe('Skip to site');
    expect(screen.queryByRole('button', { name: /ipod|computer|leave/i })).toBeNull();
  });

  it('calls onSkip when Skip to site is pressed, and it is focusable', () => {
    const onSkip = vi.fn();
    render(<Hud trackTitle="" onSkip={onSkip} />);
    const b = screen.getByRole('button', { name: 'Skip to site' });
    b.focus();
    expect(document.activeElement).toBe(b);
    fireEvent.click(b);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('shows Now playing with the title and the movement hint', () => {
    render(<Hud trackTitle="Space" onSkip={vi.fn()} />);
    expect(screen.getByText(/Now playing/)).toBeTruthy();
    expect(screen.getByText(/Space/)).toBeTruthy();
    expect(screen.getByText(/WASD/)).toBeTruthy();
  });

  it('shows no Now playing line while nothing plays', () => {
    render(<Hud trackTitle="" onSkip={vi.fn()} />);
    expect(screen.queryByText(/Now playing/)).toBeNull();
    expect(screen.getByText(/WASD/)).toBeTruthy();
  });

  it('shows a quiet audio error line instead of Now playing when audio failed', () => {
    render(<Hud trackTitle="Space" audioError onSkip={vi.fn()} />);
    expect(screen.getByText('Audio unavailable')).toBeTruthy();
    expect(screen.queryByText(/Now playing/)).toBeNull();
    expect(screen.queryByText(/Space/)).toBeNull();
  });

  it('shows the error line even before any title is known', () => {
    render(<Hud trackTitle="" audioError onSkip={vi.fn()} />);
    expect(screen.getByText('Audio unavailable')).toBeTruthy();
  });
});
