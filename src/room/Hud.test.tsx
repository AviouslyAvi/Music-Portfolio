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

  it('highlights only the nearby interactable', () => {
    setup('computer');
    expect(screen.getByRole('button', { name: LABELS[1] }).getAttribute('data-nearby')).toBe('true');
    expect(screen.getByRole('button', { name: LABELS[0] }).getAttribute('data-nearby')).toBe('false');
    cleanup();
    setup(null);
    expect(screen.getByRole('button', { name: LABELS[1] }).getAttribute('data-nearby')).toBe('false');
  });
});
