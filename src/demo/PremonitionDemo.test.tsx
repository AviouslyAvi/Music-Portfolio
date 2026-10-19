import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { SOUNDS } from '@/content/sounds';

const play = vi.fn<(src: string) => Promise<void>>();
const stop = vi.fn();
vi.mock('./useRenderedAudio', () => ({ useRenderedAudio: () => ({ play, stop }) }));
const track = vi.fn();
vi.mock('@/lib/analytics', () => ({ track: (n: string) => track(n) }));

import { PremonitionDemo } from './PremonitionDemo';

beforeEach(() => {
  cleanup();
  play.mockReset();
  stop.mockReset();
  track.mockReset();
});

describe('PremonitionDemo', () => {
  it('renders ready with every sound label when bootSequence is false', () => {
    render(<PremonitionDemo bootSequence={false} />);
    for (const s of SOUNDS) expect(screen.getByRole('button', { name: s.label })).toBeTruthy();
    expect(screen.getByText('Echoes of the future.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /skip/i })).toBeTruthy();
  });

  it('shows Audio unavailable on rejection, reaches done, and Skip stays enabled', async () => {
    play.mockRejectedValue(new Error('blocked'));
    render(<PremonitionDemo bootSequence={false} />);
    fireEvent.click(screen.getByRole('button', { name: SOUNDS[0].label }));
    await waitFor(() => expect(screen.getByText(/Audio unavailable/)).toBeTruthy());
    expect(screen.getByRole('status').textContent).toMatch(/done|finished/i);
    expect((screen.getByRole('button', { name: /skip/i }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('button', { name: /continue to site/i })).toBeTruthy();
  });

  it('plays the rendered file, tracks, and reaches done on success', async () => {
    play.mockResolvedValue(undefined);
    const onFinish = vi.fn();
    render(<PremonitionDemo bootSequence={false} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: SOUNDS[1].label }));
    expect(play).toHaveBeenCalledWith(SOUNDS[1].rendered);
    expect(track).toHaveBeenCalledWith('demo_played');
    const cont = await screen.findByRole('button', { name: /continue to site/i });
    fireEvent.click(cont);
    expect(onFinish).toHaveBeenCalledWith('done');
  });

  it('ignores a second pick while playing', () => {
    play.mockReturnValue(new Promise(() => {}));
    render(<PremonitionDemo bootSequence={false} />);
    fireEvent.click(screen.getByRole('button', { name: SOUNDS[0].label }));
    fireEvent.click(screen.getByRole('button', { name: SOUNDS[1].label }));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('Skip stops audio, tracks, and finishes as skipped', () => {
    play.mockReturnValue(new Promise(() => {}));
    const onFinish = vi.fn();
    render(<PremonitionDemo bootSequence={false} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: SOUNDS[0].label }));
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(stop).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('demo_skipped');
    expect(onFinish).toHaveBeenCalledWith('skipped');
  });

  it('boots then becomes ready; any key jumps to ready', async () => {
    render(<PremonitionDemo bootSequence={true} />);
    expect(screen.queryByRole('button', { name: SOUNDS[0].label })).toBeNull();
    act(() => {
      fireEvent.keyDown(window, { key: 'a' });
    });
    await waitFor(() => expect(screen.getByRole('button', { name: SOUNDS[0].label })).toBeTruthy());
  });
});
