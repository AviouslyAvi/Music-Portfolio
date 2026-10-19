import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  offer: true,
  track: vi.fn(),
  start: vi.fn(() => Promise.resolve()),
  dispose: vi.fn(),
  ctor: vi.fn(),
  close: vi.fn(() => Promise.resolve()),
  roomProps: [] as Array<{ onLeave: () => void; onFail: () => void }>,
}));

vi.mock('@/lib/capability', () => ({
  detectEnv: () => ({}),
  shouldOfferRoom: () => h.offer,
}));
vi.mock('@/lib/analytics', () => ({ track: (n: string) => h.track(n) }));
vi.mock('./audioEngine', () => ({
  TrackPlayer: class {
    constructor() {
      h.ctor();
    }
    start = h.start;
    dispose = h.dispose;
  },
}));
vi.mock('next/dynamic', () => ({
  default: () =>
    function RoomStub(props: { onLeave: () => void; onFail: () => void }) {
      h.roomProps.push(props);
      return <div data-testid="room-stub" />;
    },
}));

import { RoomGate } from './RoomGate';

class FakeAudioContext {
  destination = {};
  state = 'running';
  close = h.close;
  resume = () => Promise.resolve();
}

beforeEach(() => {
  cleanup();
  h.offer = true;
  h.track.mockReset();
  h.start.mockClear();
  h.dispose.mockReset();
  h.ctor.mockReset();
  h.close.mockClear();
  h.roomProps.length = 0;
  sessionStorage.clear();
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
});
afterEach(() => cleanup());

const enter = () => screen.getByRole('button', { name: 'Enter' });
const skip = () => screen.getByRole('button', { name: 'Skip' });

describe('RoomGate', () => {
  it('offers the room with Enter focused and Skip', () => {
    render(<RoomGate />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.activeElement).toBe(enter());
    expect(skip()).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('renders nothing when the room is not offered', () => {
    h.offer = false;
    const { container } = render(<RoomGate />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing once room:left is set', () => {
    sessionStorage.setItem('room:left', '1');
    const { container } = render(<RoomGate />);
    expect(container.innerHTML).toBe('');
  });

  it('Skip sets the flag and removes the overlay without loading the room', () => {
    render(<RoomGate />);
    fireEvent.click(skip());
    expect(sessionStorage.getItem('room:left')).toBe('1');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByTestId('room-stub')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('Escape skips', () => {
    render(<RoomGate />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(sessionStorage.getItem('room:left')).toBe('1');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Enter tracks, starts audio and mounts the room once, even on double click', () => {
    render(<RoomGate />);
    const b = enter();
    fireEvent.click(b);
    fireEvent.click(b);
    expect(h.track).toHaveBeenCalledTimes(1);
    expect(h.track).toHaveBeenCalledWith('room_entered');
    expect(h.ctor).toHaveBeenCalledTimes(1);
    expect(h.start).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId('room-stub')).toHaveLength(1);
  });

  it('Leave sets the flag, unmounts the room and closes audio', () => {
    render(<RoomGate />);
    fireEvent.click(enter());
    act(() => h.roomProps[0].onLeave());
    expect(screen.queryByTestId('room-stub')).toBeNull();
    expect(sessionStorage.getItem('room:left')).toBe('1');
    expect(h.dispose).toHaveBeenCalled();
    expect(h.close).toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('');
  });

  it('still enters when audio cannot start', () => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    render(<RoomGate />);
    fireEvent.click(enter());
    expect(screen.getByTestId('room-stub')).toBeTruthy();
    expect(h.track).toHaveBeenCalledWith('room_entered');
  });
  // Last: a failure blocks the room for the rest of this page view.
  it('a failure unmounts the room and closes audio without persisting the flag', () => {
    render(<RoomGate />);
    fireEvent.click(enter());
    act(() => h.roomProps[0].onFail());
    expect(screen.queryByTestId('room-stub')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sessionStorage.getItem('room:left')).toBeNull();
    expect(h.close).toHaveBeenCalled();
  });
});
