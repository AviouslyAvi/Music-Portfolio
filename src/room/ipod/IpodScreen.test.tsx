// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IpodScreen } from './IpodScreen';
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

  it('Menu goes to the menu list, and Menu again closes the iPod', () => {
    const onAction = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('listbox', { name: 'Menu' })).toBeTruthy();
    expect(screen.getByText('Music')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'close' });
  });

  it('Escape steps back, then closes', () => {
    const onAction = setup();
    const root = screen.getByTestId('ipod');
    fireEvent.keyDown(root, { key: 'Escape' });
    expect(screen.getByRole('listbox', { name: 'Menu' })).toBeTruthy();
    fireEvent.keyDown(root, { key: 'Escape' });
    expect(onAction).toHaveBeenLastCalledWith({ type: 'close' });
  });

  it('Music lists songs and choosing one plays it and returns to Now Playing', () => {
    const onAction = setup({ currentIndex: 1 });
    const root = screen.getByTestId('ipod');
    fireEvent.keyDown(root, { key: 'Escape' }); // menu
    fireEvent.keyDown(root, { key: 'ArrowDown' }); // Music (down moves down a list)
    fireEvent.keyDown(root, { key: 'Enter' });
    expect(screen.getByRole('listbox', { name: 'Songs' })).toBeTruthy();
    fireEvent.keyDown(root, { key: 'ArrowDown' });
    fireEvent.keyDown(root, { key: 'Enter' });
    expect(onAction).toHaveBeenLastCalledWith({ type: 'select-track', trackIndex: 2 });
    expect(screen.getByRole('progressbar', { name: 'Volume' })).toBeTruthy();
  });

  it('Leave the room and Computer come from the menu', () => {
    const onAction = setup();
    const root = screen.getByTestId('ipod');
    fireEvent.keyDown(root, { key: 'Escape' });
    for (let i = 0; i < 5; i++) fireEvent.keyDown(root, { key: 'ArrowDown' });
    fireEvent.keyDown(root, { key: 'Enter' });
    expect(onAction).toHaveBeenLastCalledWith({ type: 'computer' });
    fireEvent.keyDown(root, { key: 'ArrowDown' });
    fireEvent.keyDown(root, { key: 'Enter' });
    expect(onAction).toHaveBeenLastCalledWith({ type: 'leave' });
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
});
