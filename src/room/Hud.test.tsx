import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Hud } from './Hud';

beforeEach(() => cleanup());

describe('Hud', () => {
  it('has no buttons: the room is the whole site', () => {
    render(<Hud trackTitle="Space" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('shows Now playing with the title and the movement hint', () => {
    render(<Hud trackTitle="Space" />);
    expect(screen.getByText(/Now playing/)).toBeTruthy();
    expect(screen.getByText(/Space/)).toBeTruthy();
    expect(screen.getByText(/WASD/)).toBeTruthy();
  });

  it('shows no Now playing line while nothing plays', () => {
    render(<Hud trackTitle="" />);
    expect(screen.queryByText(/Now playing/)).toBeNull();
    expect(screen.getByText(/WASD/)).toBeTruthy();
  });

  it('shows a quiet audio error line instead of Now playing when audio failed', () => {
    render(<Hud trackTitle="Space" audioError />);
    expect(screen.getByText('Audio unavailable')).toBeTruthy();
    expect(screen.queryByText(/Now playing/)).toBeNull();
    expect(screen.queryByText(/Space/)).toBeNull();
  });

  it('shows the error line even before any title is known', () => {
    render(<Hud trackTitle="" audioError />);
    expect(screen.getByText('Audio unavailable')).toBeTruthy();
  });
});
