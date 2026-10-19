import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Hud } from './Hud';

const LABELS = ['Play next track (iPod)', 'Use the computer', 'Leave the room'] as const;

beforeEach(() => cleanup());

function setup(nearby: 'ipod' | 'computer' | null) {
  const onInteract = vi.fn();
  const onLeave = vi.fn();
  render(<Hud nearby={nearby} trackTitle="Placeholder Track One" onInteract={onInteract} onLeave={onLeave} />);
  return { onInteract, onLeave };
}

describe('Hud', () => {
  for (const nearby of [null, 'ipod', 'computer'] as const) {
    it(`renders the three buttons, focusable, with nearby=${nearby}`, () => {
      setup(nearby);
      for (const label of LABELS) {
        const b = screen.getByRole('button', { name: label }) as HTMLButtonElement;
        expect(b.disabled).toBe(false);
        b.focus();
        expect(document.activeElement).toBe(b);
      }
    });

    it(`calls the matching callback on click with nearby=${nearby}`, () => {
      const { onInteract, onLeave } = setup(nearby);
      fireEvent.click(screen.getByRole('button', { name: LABELS[0] }));
      expect(onInteract).toHaveBeenLastCalledWith('ipod');
      fireEvent.click(screen.getByRole('button', { name: LABELS[1] }));
      expect(onInteract).toHaveBeenLastCalledWith('computer');
      expect(onInteract).toHaveBeenCalledTimes(2);
      expect(onLeave).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: LABELS[2] }));
      expect(onLeave).toHaveBeenCalledTimes(1);
      expect(onInteract).toHaveBeenCalledTimes(2);
    });
  }

  it('shows the track title and the movement hint', () => {
    setup(null);
    expect(screen.getByText(/Placeholder Track One/)).toBeTruthy();
    expect(screen.getByText(/WASD/)).toBeTruthy();
  });

  it('shows a quiet audio error line instead of Now playing when audio failed', () => {
    const onInteract = vi.fn();
    render(<Hud nearby={null} trackTitle="Placeholder Track One" audioError onInteract={onInteract} onLeave={vi.fn()} />);
    expect(screen.getByText('Audio unavailable')).toBeTruthy();
    expect(screen.queryByText(/Now playing/)).toBeNull();
    expect(screen.queryByText(/Placeholder Track One/)).toBeNull();
    // The iPod still works: it tries the next track.
    fireEvent.click(screen.getByRole('button', { name: LABELS[0] }));
    expect(onInteract).toHaveBeenCalledWith('ipod');
  });

  it('shows the error line even before any title is known', () => {
    render(<Hud nearby={null} trackTitle="" audioError onInteract={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText('Audio unavailable')).toBeTruthy();
  });

  it('shows Now playing and no error line when audio works', () => {
    setup(null);
    expect(screen.getByText(/Now playing/)).toBeTruthy();
    expect(screen.queryByText('Audio unavailable')).toBeNull();
  });

  it('highlights only the nearby interactable', () => {
    setup('computer');
    expect(screen.getByRole('button', { name: LABELS[1] }).getAttribute('data-nearby')).toBe('true');
    expect(screen.getByRole('button', { name: LABELS[0] }).getAttribute('data-nearby')).toBe('false');
    cleanup();
    setup(null);
    expect(screen.getByRole('button', { name: LABELS[1] }).getAttribute('data-nearby')).toBe('false');
  });
});
