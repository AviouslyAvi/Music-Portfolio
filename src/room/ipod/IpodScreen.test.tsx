// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IpodScreen, formatClock } from './IpodScreen';
import type { Track } from '@/content/tracks';

const tracks: Track[] = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'].map((t, i) => ({
  id: `t${i}`,
  title: t,
  src: `/a/${i}.mp3`,
  placeholder: false,
}));

afterEach(cleanup);

const setup = (over: Partial<Parameters<typeof IpodScreen>[0]> = {}) => {
  const onAction = vi.fn();
  render(<IpodScreen tracks={tracks} currentIndex={0} playing={false} volume={0.8} onAction={onAction} {...over} />);
  return onAction;
};

describe('IpodScreen', () => {
  it('opens on Now Playing with the song, the position, and a volume bar', () => {
    setup({ currentIndex: 2, volume: 0.5 });
    expect(screen.getByText('Three')).toBeTruthy();
    expect(screen.getByText(/3 of 7/)).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Volume' }).getAttribute('aria-valuenow')).toBe('50');
  });

  it('says Press play until music plays, and the play button reads Play then Pause', () => {
    setup();
    expect(screen.getByText(/Press play/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });

  it('shows Playing and a Pause button while playing', () => {
    setup({ playing: true });
    expect(screen.getByText(/1 of 7 Playing/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  });

  it('the wheel buttons send previous, next and play or pause', () => {
    const onAction = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'step', dir: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Previous song' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'step', dir: -1 });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'toggle-play' });
  });

  it('the centre button toggles play on Now Playing', () => {
    const onAction = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'toggle-play' });
  });

  it('Up makes it louder and Down quieter on Now Playing', () => {
    const onAction = setup();
    fireEvent.keyDown(screen.getByTestId('ipod'), { key: 'ArrowUp' });
    expect(onAction).toHaveBeenLastCalledWith({ type: 'volume', delta: 1 });
    fireEvent.keyDown(screen.getByTestId('ipod'), { key: 'ArrowDown' });
    expect(onAction).toHaveBeenLastCalledWith({ type: 'volume', delta: -1 });
  });

  it('the mouse wheel over the ring changes the volume, up is louder', () => {
    const onAction = setup();
    fireEvent.wheel(screen.getByTestId('ipod-wheel'), { deltaY: -100 });
    expect(onAction).toHaveBeenLastCalledWith({ type: 'volume', delta: 1 });
    fireEvent.wheel(screen.getByTestId('ipod-wheel'), { deltaY: 100 });
    expect(onAction).toHaveBeenLastCalledWith({ type: 'volume', delta: -1 });
  });

  it('Menu goes to the menu list of songs and voice memos, and Menu again closes the iPod', () => {
    const onAction = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('listbox', { name: 'Menu' })).toBeTruthy();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Songs', 'Voice Memos']);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'close' });
  });

  it('Escape puts the iPod down at once, from any screen', () => {
    const onAction = setup();
    const root = screen.getByTestId('ipod');
    fireEvent.keyDown(root, { key: 'Escape' });
    expect(onAction).toHaveBeenLastCalledWith({ type: 'close' });
    fireEvent.keyDown(root, { key: 'Backspace' }); // Backspace steps back to the menu
    fireEvent.keyDown(root, { key: 'Enter' });
    expect(screen.getByRole('listbox', { name: 'Songs' })).toBeTruthy();
    onAction.mockClear();
    fireEvent.keyDown(root, { key: 'Escape' });
    expect(onAction).toHaveBeenCalledWith({ type: 'close' });
  });

  it('Songs lists songs and choosing one plays it and returns to Now Playing', () => {
    const onAction = setup({ currentIndex: 1 });
    const root = screen.getByTestId('ipod');
    fireEvent.keyDown(root, { key: 'Backspace' }); // menu
    fireEvent.keyDown(root, { key: 'Enter' }); // Songs
    expect(screen.getByRole('listbox', { name: 'Songs' })).toBeTruthy();
    fireEvent.keyDown(root, { key: 'ArrowDown' });
    fireEvent.keyDown(root, { key: 'Enter' });
    expect(onAction).toHaveBeenLastCalledWith({ type: 'select-track', trackIndex: 2 });
    expect(screen.getByRole('progressbar', { name: 'Volume' })).toBeTruthy();
  });

  it('Voice Memos says so when there are none, and lists and plays them when there are', () => {
    setup();
    let root = screen.getByTestId('ipod');
    fireEvent.keyDown(root, { key: 'Backspace' });
    fireEvent.keyDown(root, { key: 'ArrowDown' });
    fireEvent.keyDown(root, { key: 'Enter' });
    expect(screen.getByText('No voice memos yet.')).toBeTruthy();
    cleanup();
    const memos: Track[] = [
      { id: 'm0', title: 'Idea one', src: '/m/0.mp3', placeholder: false },
      { id: 'm1', title: 'Idea two', src: '/m/1.mp3', placeholder: false },
    ];
    const onAction = setup({ memos });
    root = screen.getByTestId('ipod');
    fireEvent.keyDown(root, { key: 'Backspace' });
    fireEvent.keyDown(root, { key: 'ArrowDown' });
    fireEvent.keyDown(root, { key: 'Enter' });
    expect(screen.getByRole('listbox', { name: 'Voice memos' })).toBeTruthy();
    fireEvent.keyDown(root, { key: 'ArrowDown' });
    fireEvent.keyDown(root, { key: 'Enter' });
    expect(onAction).toHaveBeenLastCalledWith({ type: 'select-track', trackIndex: tracks.length + 1 });
  });

  it('dragging around the ring scrolls one step per 24 degrees', () => {
    const onAction = setup();
    const wheel = screen.getByTestId('ipod-wheel');
    wheel.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON() {} }) as DOMRect;
    wheel.setPointerCapture = () => {};
    const at = (deg: number) => ({ clientX: 100 + 90 * Math.cos((deg * Math.PI) / 180), clientY: 100 + 90 * Math.sin((deg * Math.PI) / 180), pointerId: 1 });
    fireEvent.pointerDown(wheel, at(0));
    fireEvent.pointerMove(wheel, at(25));
    fireEvent.pointerMove(wheel, at(50));
    fireEvent.pointerUp(wheel, at(50));
    expect(onAction.mock.calls.filter(([a]) => a.type === 'volume')).toHaveLength(2);
    expect(onAction).toHaveBeenLastCalledWith({ type: 'volume', delta: 1 });
  });

  describe('scrubbing', () => {
    it('formats clock times', () => {
      expect([formatClock(0), formatClock(65), formatClock(3599.9), formatClock(Number.NaN), formatClock(-4)]).toEqual(['0:00', '1:05', '59:59', '0:00', '0:00']);
    });

    it('shows elapsed and total time on a song position slider', () => {
      setup({ position: 65, duration: 200 });
      const bar = screen.getByRole('slider', { name: 'Song position' });
      expect(bar.getAttribute('aria-valuetext')).toBe('1:05 of 3:20');
      expect(screen.getByText('1:05')).toBeTruthy();
      expect(screen.getByText('3:20')).toBeTruthy();
    });

    it('arrow keys on the slider seek five seconds and do not change the song', () => {
      const onAction = setup({ position: 50, duration: 100 });
      const bar = screen.getByRole('slider', { name: 'Song position' });
      fireEvent.keyDown(bar, { key: 'ArrowRight' });
      expect(onAction).toHaveBeenCalledWith({ type: 'seek', fraction: 0.55 });
      fireEvent.keyDown(bar, { key: 'ArrowLeft' });
      expect(onAction).toHaveBeenLastCalledWith({ type: 'seek', fraction: 0.45 });
      expect(onAction).not.toHaveBeenCalledWith({ type: 'step', dir: 1 });
      expect(onAction).not.toHaveBeenCalledWith({ type: 'step', dir: -1 });
    });

    it('a press and release on the bar seeks to that point; nothing seeks before a song has a length', () => {
      const onAction = setup({ position: 0, duration: 100 });
      const bar = screen.getByRole('slider', { name: 'Song position' });
      bar.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 10, right: 200, bottom: 10, x: 0, y: 0, toJSON() {} }) as DOMRect;
      fireEvent.pointerDown(bar, { clientX: 50, pointerId: 1 });
      fireEvent.pointerUp(bar, { clientX: 50, pointerId: 1 });
      expect(onAction).toHaveBeenCalledWith({ type: 'seek', fraction: 0.25 });
      cleanup();
      const none = setup({ position: 0, duration: 0 });
      const bar2 = screen.getByRole('slider', { name: 'Song position' });
      fireEvent.pointerDown(bar2, { clientX: 50, pointerId: 1 });
      fireEvent.pointerUp(bar2, { clientX: 50, pointerId: 1 });
      fireEvent.keyDown(bar2, { key: 'ArrowRight' });
      expect(none).not.toHaveBeenCalled();
    });
  });
});
