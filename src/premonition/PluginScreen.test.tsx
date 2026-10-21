import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAMS } from './params';
import type { RenderResult } from './engine/types';
import { SOURCES, type DrySource } from './sources';

const h = vi.hoisted(() => {
  const state = {
    readyImpl: (() => Promise.resolve()) as () => Promise<void>,
    renderCalls: [] as { params: unknown; channels: Float32Array[]; signal: AbortSignal }[],
    pending: [] as { resolve(r: RenderResult): void; reject(e: unknown): void; signal: AbortSignal }[],
    disposed: 0,
    loadImpl: (async () => [new Float32Array(4800).fill(0.2)]) as (src: string) => Promise<Float32Array[]>,
    played: [] as { result: RenderResult; onEnded: () => void }[],
    stopCalls: 0,
  };
  return state;
});

class CancelledError extends Error {
  code = 'cancelled';
}

vi.mock('./engine/renderClient', () => ({
  createRenderClient: () => ({
    ready: () => h.readyImpl(),
    render: (req: { params: unknown; channels: Float32Array[] }, signal: AbortSignal) => {
      h.renderCalls.push({ params: req.params, channels: req.channels, signal });
      return new Promise<RenderResult>((resolve, reject) => {
        h.pending.push({ resolve, reject, signal });
        signal.addEventListener('abort', () => reject(new CancelledError('cancelled')));
      });
    },
    dispose: () => {
      h.disposed++;
    },
  }),
}));
vi.mock('./decode', () => ({ SAMPLE_RATE: 48000, loadSource: (src: string) => h.loadImpl(src) }));
vi.mock('./usePreview', () => ({
  usePreview: () => ({
    play: async (result: RenderResult, onEnded: () => void) => {
      h.played.push({ result, onEnded });
    },
    stop: () => {
      h.stopCalls++;
    },
    playing: false,
    progress: 0,
  }),
}));

import { PluginScreen } from './PluginScreen';

const result = (): RenderResult => ({ channels: [new Float32Array(960).fill(0.1), new Float32Array(960).fill(0.1)], sampleRate: 48000 });
const empty = new Set<string>();
const nameOf = (s: DrySource) => new RegExp(s.label.replace(/[()]/g, '\\$&'), 'i');

function mount(over: Partial<React.ComponentProps<typeof PluginScreen>> = {}) {
  const props = { playedIds: empty, onSoundPlayed: vi.fn(), onReady: vi.fn(), onLoadError: vi.fn(), onClose: vi.fn(), ...over };
  const view = render(<PluginScreen {...props} />);
  return { props, ...view };
}

async function ready(props: ReturnType<typeof mount>['props']) {
  await waitFor(() => expect(props.onReady).toHaveBeenCalled());
}

const finishRender = async (i = h.pending.length - 1) => {
  await act(async () => {
    h.pending[i].resolve(result());
  });
};

beforeEach(() => {
  h.readyImpl = () => Promise.resolve();
  h.loadImpl = async () => [new Float32Array(4800).fill(0.2)];
  h.renderCalls = [];
  h.pending = [];
  h.played = [];
  h.disposed = 0;
  h.stopCalls = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PluginScreen', () => {
  it('onReady fires after wasm and all three samples are ready', async () => {
    let release!: () => void;
    h.loadImpl = (src) => (src === SOURCES[2].src ? new Promise((r) => (release = () => r([new Float32Array(10)]))) : Promise.resolve([new Float32Array(10)]));
    const { props } = mount();
    await act(async () => {});
    expect(props.onReady).not.toHaveBeenCalled();
    await act(async () => release());
    await ready(props);
    expect(props.onReady).toHaveBeenCalledTimes(1);
    expect(props.onLoadError).not.toHaveBeenCalled();
  });

  it('pick renders then plays and passes the current params', async () => {
    const { props } = mount();
    await ready(props);
    fireEvent.click(screen.getByRole('button', { name: nameOf(SOURCES[1]) }));
    expect(h.renderCalls).toHaveLength(1);
    expect(h.renderCalls[0].params).toEqual(DEFAULT_PARAMS);
    expect(h.played).toHaveLength(0);
    await finishRender();
    expect(h.played).toHaveLength(1);
  });

  it('a knob change re-renders once after 150 ms of quiet', async () => {
    const { props } = mount();
    await ready(props);
    fireEvent.click(screen.getByRole('button', { name: nameOf(SOURCES[0]) }));
    await finishRender();
    vi.useFakeTimers();
    const bloom = screen.getByRole('slider', { name: 'Bloom' });
    fireEvent.keyDown(bloom, { key: 'ArrowUp' });
    fireEvent.keyDown(bloom, { key: 'ArrowUp' });
    await act(async () => {
      vi.advanceTimersByTime(140);
    });
    expect(h.renderCalls).toHaveLength(1);
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    expect(h.renderCalls).toHaveLength(2);
    expect((h.renderCalls[1].params as { bloom: number }).bloom).toBeCloseTo(0.35, 5);
  });

  it('a knob change during a play stops it without firing onSoundPlayed', async () => {
    const { props } = mount();
    await ready(props);
    fireEvent.click(screen.getByRole('button', { name: nameOf(SOURCES[0]) }));
    await finishRender();
    const stopsBefore = h.stopCalls;
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Size' }), { key: 'ArrowUp' });
    expect(h.stopCalls).toBeGreaterThan(stopsBefore);
    // the old play ending late (a stale callback) must not count
    act(() => h.played[0].onEnded());
    expect(props.onSoundPlayed).not.toHaveBeenCalled();
  });

  it('a newer render aborts the one in flight and the stale result plays nothing', async () => {
    const { props } = mount();
    await ready(props);
    fireEvent.click(screen.getByRole('button', { name: nameOf(SOURCES[0]) }));
    fireEvent.click(screen.getByRole('button', { name: nameOf(SOURCES[1]) }));
    expect(h.renderCalls).toHaveLength(2);
    expect(h.renderCalls[0].signal.aborted).toBe(true);
    await finishRender(1);
    expect(h.played).toHaveLength(1);
  });

  it('onSoundPlayed fires once when playback ends naturally', async () => {
    const { props } = mount();
    await ready(props);
    fireEvent.click(screen.getByRole('button', { name: nameOf(SOURCES[2]) }));
    await finishRender();
    act(() => h.played[0].onEnded());
    act(() => h.played[0].onEnded());
    expect(props.onSoundPlayed).toHaveBeenCalledTimes(1);
    expect(props.onSoundPlayed).toHaveBeenCalledWith(SOURCES[2].id);
  });

  it('played sources get data-heard and stay enabled', async () => {
    const { props } = mount({ playedIds: new Set([SOURCES[0].id]) });
    await ready(props);
    const btn = screen.getByRole('button', { name: nameOf(SOURCES[0]) });
    expect(btn).toHaveAttribute('data-heard', 'true');
    expect(btn).toBeEnabled();
    expect(screen.getByRole('button', { name: nameOf(SOURCES[1]) })).toHaveAttribute('data-heard', 'false');
  });

  it('a sample that fails to decode disables only that source and the others still render', async () => {
    h.loadImpl = async (src) => {
      if (src === SOURCES[1].src) throw new Error('decode');
      return [new Float32Array(100).fill(0.1)];
    };
    const { props } = mount();
    await waitFor(() => expect(props.onLoadError).toHaveBeenCalled());
    expect(props.onReady).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: nameOf(SOURCES[1]) })).toBeDisabled();
    const ok = screen.getByRole('button', { name: nameOf(SOURCES[0]) });
    expect(ok).toBeEnabled();
    fireEvent.click(ok);
    expect(h.renderCalls).toHaveLength(1);
  });

  it('a wasm load failure shows one plain line and calls onLoadError', async () => {
    h.readyImpl = () => Promise.reject(new Error('dsp.js 404'));
    const { props, container } = mount();
    await waitFor(() => expect(props.onLoadError).toHaveBeenCalledWith(expect.stringContaining('dsp.js 404')));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryAllByRole('slider')).toHaveLength(0);
    expect(container.querySelectorAll('button').length).toBeLessThanOrEqual(1);
    expect(props.onReady).not.toHaveBeenCalled();
  });

  it('there is no download attribute, anchor to a blob, or Drag-into-DAW action in the DOM', async () => {
    const { props, container } = mount();
    await ready(props);
    fireEvent.click(screen.getByRole('button', { name: nameOf(SOURCES[0]) }));
    await finishRender();
    expect(container.querySelector('[download]')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('[draggable="true"]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/blob:|Drag into DAW/i);
  });

  it('unmount mid-render aborts it and plays nothing', async () => {
    const { props, unmount } = mount();
    await ready(props);
    fireEvent.click(screen.getByRole('button', { name: nameOf(SOURCES[0]) }));
    unmount();
    expect(h.renderCalls[0].signal.aborted).toBe(true);
    expect(h.disposed).toBe(1);
    expect(h.played).toHaveLength(0);
  });

  it('shows the one privacy line and calls onClose', async () => {
    const { props } = mount();
    await ready(props);
    expect(screen.getByText('Your sound is processed in this browser and never uploaded')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('uses the sources prop when given', async () => {
    const custom: DrySource[] = SOURCES.map((s, i) => ({ ...s, id: `c${i}`, label: `Custom ${i}` }));
    const { props } = mount({ sources: custom });
    await ready(props);
    expect(screen.getByRole('button', { name: /Custom 2/ })).toBeInTheDocument();
  });
});
