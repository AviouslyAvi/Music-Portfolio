import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import * as THREE from 'three';

const h = vi.hoisted(() => ({
  plugin: null as null | {
    sources: readonly { id: string }[];
    onSoundPlayed(id: string): void;
    onReady?(): void;
    onLoadError?(reason: string): void;
  },
  pluginMounts: 0,
  rafQueue: [] as Array<(t: number) => void>,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('three', async (orig) => {
  const actual = await orig<typeof import('three')>();
  class FakeRenderer {
    domElement = document.createElement('canvas');
    toneMapping = 0;
    outputColorSpace = '';
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
    forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});
vi.mock('./buildRoom', () => ({
  buildRoom: () => ({ group: new THREE.Group(), ipod: new THREE.Group(), computer: new THREE.Group(), dispose() {} }),
}));
vi.mock('./sequence/stubs', async (orig) => {
  const actual = await orig<typeof import('./sequence/stubs')>();
  return {
    ...actual,
    PluginScreen: (props: NonNullable<typeof h.plugin>) => {
      h.plugin = props;
      h.pluginMounts++;
      return <div data-testid="plugin-screen" />;
    },
  };
});

import RoomExperience from './RoomExperience';
import { LINKS } from '@/content/site';

function fakeAudio() {
  return {
    ctx: {} as AudioContext,
    player: {
      hold: vi.fn(),
      release: vi.fn(),
      setListenerPose: vi.fn(),
      title: '',
      index: 0,
      playing: false,
      volume: 0.5,
      select: vi.fn(() => Promise.resolve()),
      togglePlay: vi.fn(() => Promise.resolve()),
      step: vi.fn(() => Promise.resolve()),
      setVolume: vi.fn(),
    },
  };
}

let clock = 0;
function frames(ms: number) {
  const steps = Math.ceil(ms / 16);
  for (let i = 0; i < steps; i++) {
    clock += 16;
    const q = h.rafQueue.splice(0);
    act(() => {
      vi.advanceTimersByTime(16);
      q.forEach((cb) => cb(clock));
    });
  }
}

function setup(opts: { reduced?: boolean } = {}) {
  const audio = fakeAudio();
  const navigate = vi.fn();
  const onLeave = vi.fn();
  render(<RoomExperience onLeave={onLeave} onFail={vi.fn()} audio={audio as never} navigate={navigate} />);
  frames(32);
  return { audio, navigate, onLeave, opts };
}

const sit = () => {
  fireEvent.click(screen.getByRole('button', { name: /computer: press e/i }));
};
const stage = () => screen.getByRole('dialog', { name: /studio room/i }).getAttribute('data-stage');
const toPlugin = () => {
  sit();
  frames(1500); // ease
  frames(1000); // headphones
  act(() => h.plugin!.onReady?.());
  frames(3000); // terminal minimum
};
const playAll = () => {
  for (const s of h.plugin!.sources) act(() => h.plugin!.onSoundPlayed(s.id));
};

beforeEach(() => {
  vi.useFakeTimers();
  clock = 0;
  h.plugin = null;
  h.pluginMounts = 0;
  h.rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    h.rafQueue.push(cb);
    return h.rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  sessionStorage.clear();
  const noop = () => {};
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k: string) => (k in t ? t[k] : k.startsWith('create') ? () => ({ addColorStop: noop }) : noop),
    set: (t, k: string, v) => ((t[k] = v), true),
  });
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('RoomExperience sequence', () => {
  it('E at the computer starts seating and holds the room audio once', () => {
    const { audio } = setup();
    expect(stage()).toBe('walk');
    sit();
    sit();
    expect(stage()).toBe('seating');
    expect(audio.player.hold).toHaveBeenCalledTimes(1);
    expect(audio.player.release).not.toHaveBeenCalled();
    frames(1500);
    expect(stage()).toBe('headphones');
    frames(1000);
    expect(stage()).toBe('boot');
    expect(audio.player.hold).toHaveBeenCalledTimes(1);
  });

  it('Escape in boot or plugin releases the audio and returns to walk', () => {
    const { audio } = setup();
    sit();
    frames(2600);
    expect(stage()).toBe('boot');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(stage()).toBe('walk');
    expect(audio.player.release).toHaveBeenCalledTimes(1);

    frames(1500); // stand-up ease
    sit();
    frames(2600);
    act(() => h.plugin!.onReady?.());
    frames(3000);
    expect(stage()).toBe('plugin');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(stage()).toBe('walk');
    expect(audio.player.release).toHaveBeenCalledTimes(2);
  });

  it('Escape during the seating ease ends in one consistent state', () => {
    const { audio } = setup();
    sit();
    frames(400);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(stage()).toBe('walk');
    frames(3000);
    expect(stage()).toBe('walk');
    expect(audio.player.hold).toHaveBeenCalledTimes(1);
    expect(audio.player.release).toHaveBeenCalledTimes(1);
  });

  it('the visitor own iPod pause survives seat and stand (only hold and release are used, never play)', () => {
    const { audio } = setup();
    sit();
    frames(2600);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(audio.player.togglePlay).not.toHaveBeenCalled();
    expect(audio.player.select).not.toHaveBeenCalled();
    expect(audio.player.hold).toHaveBeenCalledTimes(1);
    expect(audio.player.release).toHaveBeenCalledTimes(1);
  });

  it('Skip to site works in seating, boot, plugin and portal and unmounts once', () => {
    for (const upTo of ['seating', 'boot', 'plugin', 'portal'] as const) {
      cleanup();
      h.plugin = null;
      const { audio, navigate, onLeave } = setup();
      if (upTo === 'seating') sit();
      else if (upTo === 'boot') {
        sit();
        frames(2600);
      } else {
        toPlugin();
        if (upTo === 'portal') playAll();
      }
      expect(stage()).toBe(upTo);
      fireEvent.click(screen.getByRole('button', { name: 'Skip to site' }));
      fireEvent.click(screen.getByRole('button', { name: 'Skip to site' }));
      expect(onLeave).toHaveBeenCalledTimes(1);
      expect(audio.player.release).toHaveBeenCalledTimes(1);
      frames(5000);
      expect(navigate).not.toHaveBeenCalled();
    }
  });

  it('the third SOUND_PLAYED shows the portal and, at PORTAL_DONE, sets room:left then navigates to the Premonition URL', () => {
    const { navigate } = setup();
    toPlugin();
    const [a, b, c] = h.plugin!.sources.map((s) => s.id);
    act(() => h.plugin!.onSoundPlayed(a));
    act(() => h.plugin!.onSoundPlayed(b));
    expect(stage()).toBe('plugin');
    expect(screen.queryByTestId('portal')).toBeNull();
    act(() => h.plugin!.onSoundPlayed(c));
    expect(stage()).toBe('portal');
    expect(screen.getByTestId('portal')).toBeTruthy();
    let leftWhenNavigated: string | null = null;
    navigate.mockImplementation(() => {
      leftWhenNavigated = sessionStorage.getItem('room:left');
    });
    frames(3100);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(LINKS.premonitionStore);
    expect(leftWhenNavigated).toBe('1');
  });

  it('a repeated sound does not fire the portal early', () => {
    setup();
    toPlugin();
    const [a] = h.plugin!.sources.map((s) => s.id);
    for (let i = 0; i < 3; i++) act(() => h.plugin!.onSoundPlayed(a));
    expect(stage()).toBe('plugin');
  });

  it('ENGINE_FAILED shows the failure and never navigates to the portal URL', () => {
    const { navigate } = setup();
    sit();
    act(() => h.plugin!.onLoadError?.('wasm'));
    frames(6000);
    expect(stage()).toBe('boot');
    expect(screen.getByText('engine failed to load')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip to site' })).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('a hidden tab keeps audio held and does not restart the boot', () => {
    const { audio } = setup();
    sit();
    frames(2600);
    const mounts = h.pluginMounts;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    frames(100);
    expect(stage()).toBe('boot');
    expect(audio.player.release).not.toHaveBeenCalled();
    expect(h.pluginMounts).toBe(mounts);
    expect(screen.getAllByTestId('terminal')).toHaveLength(1);
  });
});
