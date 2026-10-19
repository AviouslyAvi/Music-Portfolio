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
    render(<PremonitionDemo bootSequence={false} onFinish={vi.fn()} />);
    for (const s of SOUNDS) expect(screen.getByRole('button', { name: s.label })).toBeTruthy();
    expect(screen.getByText('Echoes of the future.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /skip/i })).toBeTruthy();
  });

  it('shows Audio unavailable on rejection, reaches done, and Skip stays enabled', async () => {
    play.mockRejectedValue(new Error('blocked'));
    render(<PremonitionDemo bootSequence={false} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: SOUNDS[0].label }));
    await waitFor(() => expect(screen.getAllByText(/Audio unavailable/).length).toBeGreaterThan(0));
    expect(screen.getByRole('status').textContent).toMatch(/audio unavailable/i);
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

  it('Tab, modifier keys and keys on the Skip button do not end boot', () => {
    render(<PremonitionDemo bootSequence={true} onFinish={vi.fn()} />);
    for (const key of ['Tab', 'Shift', 'Control', 'Alt', 'Meta']) fireEvent.keyDown(window, { key });
    fireEvent.keyDown(screen.getByRole('button', { name: /skip/i }), { key: 'Enter' });
    expect(screen.queryByRole('button', { name: SOUNDS[0].label })).toBeNull();
  });

  describe('standalone (no onFinish, as on /premonition)', () => {
    it('renders no Skip and no Continue, before or after a sound plays', async () => {
      play.mockResolvedValue(undefined);
      const { container } = render(<PremonitionDemo bootSequence={false} />);
      expect(screen.queryByRole('button', { name: /skip/i })).toBeNull();
      expect(container.querySelector('[data-demo-skip]')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: SOUNDS[0].label }));
      await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/finished/i));
      expect(screen.queryByRole('button', { name: /skip/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /continue to site/i })).toBeNull();
      expect(screen.getByRole('status').textContent).not.toMatch(/continue/i);
      expect(screen.queryByText(/or continue/i)).toBeNull();
    });

    it('lets the visitor play sounds repeatedly and never tracks a skip', async () => {
      play.mockResolvedValue(undefined);
      render(<PremonitionDemo bootSequence={false} />);
      for (const s of [SOUNDS[0], SOUNDS[1], SOUNDS[0]]) {
        const b = screen.getByRole('button', { name: s.label }) as HTMLButtonElement;
        await waitFor(() => expect(b.disabled).toBe(false));
        fireEvent.click(b);
        await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/finished/i));
      }
      expect(play).toHaveBeenCalledTimes(3);
      expect(track).not.toHaveBeenCalledWith('demo_skipped');
    });

    it('still reports audio failure and stays usable', async () => {
      play.mockRejectedValue(new Error('blocked'));
      render(<PremonitionDemo bootSequence={false} />);
      fireEvent.click(screen.getByRole('button', { name: SOUNDS[0].label }));
      await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/audio unavailable/i));
      expect(screen.getByRole('status').textContent).not.toMatch(/continue/i);
      expect((screen.getByRole('button', { name: SOUNDS[1].label }) as HTMLButtonElement).disabled).toBe(false);
      expect(screen.queryByRole('button', { name: /skip/i })).toBeNull();
    });
  });

  describe('in the room (onFinish given)', () => {
    it('renders Skip (with data-demo-skip) and Continue after a sound', async () => {
      play.mockResolvedValue(undefined);
      const { container } = render(<PremonitionDemo bootSequence={false} onFinish={vi.fn()} />);
      expect(container.querySelector('[data-demo-skip]')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: SOUNDS[0].label }));
      expect(await screen.findByRole('button', { name: /continue to site/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /skip/i })).toBeTruthy();
      expect(screen.getByRole('status').textContent).toMatch(/continue/i);
    });

    it('renders Skip during the boot sequence', () => {
      const { container } = render(<PremonitionDemo bootSequence={true} onFinish={vi.fn()} />);
      expect(container.querySelector('[data-demo-skip]')).not.toBeNull();
    });
  });

  describe('stale play promise after Skip', () => {
    function setup() {
      let resolve!: () => void;
      let reject!: (e: Error) => void;
      play.mockReturnValue(new Promise<void>((res, rej) => { resolve = res; reject = rej; }));
      const onFinish = vi.fn();
      render(<PremonitionDemo bootSequence={false} onFinish={onFinish} />);
      fireEvent.click(screen.getByRole('button', { name: SOUNDS[0].label }));
      fireEvent.click(screen.getByRole('button', { name: /skip/i }));
      return { onFinish, resolve, reject };
    }
    it('late resolve is ignored', async () => {
      const { onFinish, resolve } = setup();
      await act(async () => { resolve(); });
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onFinish).toHaveBeenCalledWith('skipped');
      expect(screen.getByRole('status').textContent).toMatch(/skipped/i);
      expect(screen.queryByRole('button', { name: /continue to site/i })).toBeNull();
    });
    it('late reject is ignored', async () => {
      const { onFinish, reject } = setup();
      await act(async () => { reject(new Error('aborted')); });
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onFinish).toHaveBeenCalledWith('skipped');
      expect(screen.getByRole('status').textContent).toMatch(/skipped/i);
      expect(screen.queryByText(/Audio unavailable/)).toBeNull();
    });
  });
});
