import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { lazy, Suspense, type ComponentType } from 'react';

const h = vi.hoisted(() => ({
  offer: true,
  track: vi.fn(),
  start: vi.fn(() => Promise.resolve()),
  dispose: vi.fn(),
  ctor: vi.fn(),
  close: vi.fn(() => Promise.resolve()),
  roomProps: [] as Array<{ onLeave: () => void; onFail: () => void; audioFailures?: string[] }>,
  errorCbs: [] as Array<(e: { trackId: string }) => void>,
  renderThrows: false,
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
    onError(cb: (e: { trackId: string }) => void) {
      h.errorCbs.push(cb);
    }
  },
}));
// next/dynamic is React.lazy plus Suspense; mirror that so the real loader runs.
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<ComponentType<Record<string, unknown>> | { default: ComponentType<Record<string, unknown>> }>) => {
    const L = lazy(async () => {
      const m = await loader();
      return { default: 'default' in m ? m.default : m };
    });
    return function Dynamic(props: Record<string, unknown>) {
      return (
        <Suspense fallback={null}>
          <L {...props} />
        </Suspense>
      );
    };
  },
}));
const roomModule = () => ({
  default: function RoomStub(props: { onLeave: () => void; onFail: () => void; audioFailures?: string[] }) {
    if (h.renderThrows) throw new Error('render failed');
    h.roomProps.push(props);
    return <div data-testid="room-stub" />;
  },
});

let RoomGate: typeof import('./RoomGate').RoomGate;


class FakeAudioContext {
  destination = {};
  state = 'running';
  close = h.close;
  resume = () => Promise.resolve();
}

beforeEach(async () => {
  cleanup();
  // Fresh modules per test: no failure flag or lazy cache leaks between tests.
  vi.resetModules();
  h.renderThrows = false;
  vi.doMock('./RoomExperience', roomModule);
  RoomGate = (await import('./RoomGate')).RoomGate;
  document.body.querySelectorAll('[data-chrome]').forEach((e) => e.remove());
  for (const html of ['<nav data-chrome><a href="/work">Work</a></nav>', '<main id="main" tabindex="-1" data-chrome><h1>Home</h1></main>']) {
    document.body.insertAdjacentHTML('afterbegin', html);
  }
  h.offer = true;
  h.track.mockReset();
  h.start.mockClear();
  h.dispose.mockReset();
  h.ctor.mockReset();
  h.close.mockClear();
  h.roomProps.length = 0;
  h.errorCbs.length = 0;
  sessionStorage.clear();
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
});
afterEach(() => cleanup());

const enter = () => screen.getByRole('button', { name: 'Enter' });
const skip = () => screen.getByRole('button', { name: 'Skip' });

describe('RoomGate', () => {
  it('subscribes to audio errors and hands the failed ids to the room', async () => {
    render(<RoomGate />);
    fireEvent.click(enter());
    await screen.findByTestId('room-stub');
    expect(h.errorCbs.length).toBe(1);
    expect(h.roomProps.at(-1)?.audioFailures).toEqual([]);
    act(() => {
      h.errorCbs[0]({ trackId: 'track-1' });
      h.errorCbs[0]({ trackId: 'audio-context' });
      h.errorCbs[0]({ trackId: 'track-1' });
    });
    await waitFor(() => expect(h.roomProps.at(-1)?.audioFailures).toEqual(['track-1', 'audio-context']));
  });

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

  it('makes the site behind the overlay inert, and restores it with focus on main after Skip', () => {
    render(<RoomGate />);
    const nav = document.querySelector('nav')!;
    const main = document.getElementById('main')!;
    expect(nav.hasAttribute('inert')).toBe(true);
    expect(main.hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('dialog').closest('[inert]')).toBeNull();
    fireEvent.click(skip());
    expect(nav.hasAttribute('inert')).toBe(false);
    expect(main.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(main);
  });

  it('Enter tracks, starts audio and mounts the room once, even on double click', async () => {
    render(<RoomGate />);
    const b = enter();
    fireEvent.click(b);
    fireEvent.click(b);
    expect(await screen.findAllByTestId('room-stub')).toHaveLength(1);
    expect(h.track).toHaveBeenCalledTimes(1);
    expect(h.track).toHaveBeenCalledWith('room_entered');
    expect(h.ctor).toHaveBeenCalledTimes(1);
    expect(h.start).toHaveBeenCalledTimes(1);
    expect(document.querySelector('nav')!.hasAttribute('inert')).toBe(true);
  });

  it('Leave sets the flag, unmounts the room, closes audio and restores the page', async () => {
    render(<RoomGate />);
    fireEvent.click(enter());
    await screen.findByTestId('room-stub');
    act(() => h.roomProps[0].onLeave());
    expect(screen.queryByTestId('room-stub')).toBeNull();
    expect(sessionStorage.getItem('room:left')).toBe('1');
    expect(h.dispose).toHaveBeenCalled();
    expect(h.close).toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('');
    expect(document.querySelector('nav')!.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(document.getElementById('main'));
  });

  it('still enters when audio cannot start', async () => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    render(<RoomGate />);
    fireEvent.click(enter());
    expect(await screen.findByTestId('room-stub')).toBeTruthy();
    expect(h.track).toHaveBeenCalledWith('room_entered');
  });

  const renderPage = () =>
    render(
      <>
        <h2>Site content</h2>
        <RoomGate />
      </>,
    );

  function expectNormalHome() {
    expect(screen.queryByTestId('room-stub')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    // Rendered in the same React tree as the gate, so an uncaught error would remove it.
    expect(screen.getByRole('heading', { name: 'Site content' })).toBeTruthy();
    expect(document.querySelector('nav')!.hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(sessionStorage.getItem('room:left')).toBeNull();
    expect(h.dispose).toHaveBeenCalled();
    expect(h.close).toHaveBeenCalled();
  }

  it('onFail unmounts the room and stops audio without persisting the flag', async () => {
    renderPage();
    fireEvent.click(enter());
    await screen.findByTestId('room-stub');
    act(() => h.roomProps[0].onFail());
    expectNormalHome();
  });

  it('a render error in the room falls back to the normal home', async () => {
    h.renderThrows = true;
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage();
    fireEvent.click(enter());
    await waitFor(() => expect(h.close).toHaveBeenCalled());
    expectNormalHome();
    err.mockRestore();
  });

  it('a room chunk that fails to load falls back to the normal home', async () => {
    vi.doMock('./RoomExperience', () => {
      throw new Error('chunk failed to load');
    });
    renderPage();
    fireEvent.click(enter());
    await waitFor(() => expect(h.close).toHaveBeenCalled());
    expectNormalHome();
  });

  it('does not offer the room again in this page view after a failure', async () => {
    const { unmount } = render(<RoomGate />);
    fireEvent.click(enter());
    await screen.findByTestId('room-stub');
    act(() => h.roomProps[0].onFail());
    unmount();
    render(<RoomGate />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
