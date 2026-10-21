'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PLUGINS } from '@/content/plugins';
import { SAMPLE_RATE, loadSource } from './decode';
import { createRenderClient } from './engine/renderClient';
import type { RenderResult } from './engine/types';
import { Knob } from './Knob';
import { DEFAULT_PARAMS, clampParams, type Bars, type PluginParams } from './params';
import { Stipple, Terrain } from './PluginCanvases';
import { OVERHANGS, peakEnvelope, terrainFromAudio } from './pluginViz';
import { SOURCES, type DrySource } from './sources';
import { usePreview } from './usePreview';
import styles from './plugin.module.css';

const PLUGIN = PLUGINS[0];
// The plugin is drawn at its real 920 px width and scaled to whatever the screen gives it.
const STAGE_W = 920;
const STAGE_H = 800;
const BARS: { label: string; value: Bars }[] = [
  { label: '1/2', value: 0.5 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '4', value: 4 },
  { label: '8', value: 8 },
];
const RERENDER_MS = 150;
const TERRAIN_ROWS = 30;
const TERRAIN_COLS = 96;
const WAVE_BINS = 270;

const stretchOf = (v: number) => 0.25 * 16 ** v; // 0.25x .. 4x, 1.00x at the middle
const pct = (v: number) => `${Math.round(v * 100)}%`;

type Knobs = { stretch: number; bloom: number; size: number; overhang: number; diffusion: number };
const DEFAULT_KNOBS: Knobs = { stretch: 0.5, bloom: 0.25, size: 0.5, overhang: 0.5, diffusion: 0.7 };
const overhangStep = (v: number) => Math.round(v * (OVERHANGS.length - 1));

function toParams(k: Knobs, bars: Bars, direction: PluginParams['direction']): PluginParams {
  return clampParams({
    ...DEFAULT_PARAMS,
    stretch: stretchOf(k.stretch),
    bloom: k.bloom,
    size: k.size,
    overhang: OVERHANGS[overhangStep(k.overhang)].bars,
    diffusion: k.diffusion,
    bars,
    direction,
  });
}

function useStageScale() {
  const fit = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = fit.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth > 0) setScale(el.clientWidth / STAGE_W);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { fit, scale };
}

type Phase = 'idle' | 'rendering' | 'playing' | 'done' | 'error';
type Loaded = Float32Array[] | 'error';

export function PluginScreen({
  sources = SOURCES,
  playedIds,
  onSoundPlayed,
  onReady,
  onLoadError,
  onClose,
}: {
  sources?: readonly DrySource[];
  /** Sources already heard to the end (owned by the sequence): drawn dimmed, still clickable. */
  playedIds: ReadonlySet<string>;
  /** Fired once when a preview of that source plays to its natural end. */
  onSoundPlayed(id: string): void;
  /** The engine is loaded and all samples are decoded. */
  onReady?(): void;
  onLoadError?(reason: string): void;
  onClose?(): void;
}) {
  const { fit, scale } = useStageScale();
  const preview = usePreview();

  const [engine, setEngine] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [knobs, setKnobs] = useState<Knobs>(DEFAULT_KNOBS);
  const [bars, setBars] = useState<Bars>(DEFAULT_PARAMS.bars);
  const [direction, setDirection] = useState<PluginParams['direction']>('reverse');
  const [rendered, setRendered] = useState<{ id: string; result: RenderResult } | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  // Latest values for callbacks that outlive a render.
  const latest = useRef({ onSoundPlayed, onReady, onLoadError, preview, loaded, selectedId, knobs, bars, direction, sources });
  latest.current = { onSoundPlayed, onReady, onLoadError, preview, loaded, selectedId, knobs, bars, direction, sources };
  const clientRef = useRef<ReturnType<typeof createRenderClient> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback((id: string, params: PluginParams) => {
    const client = clientRef.current;
    const channels = latest.current.loaded[id];
    if (!client || !Array.isArray(channels)) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    abortRef.current?.abort();
    latest.current.preview.stop();
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase('rendering');
    client
      .render({ channels, sampleRate: SAMPLE_RATE, params }, ac.signal)
      .then(async (result) => {
        if (ac.signal.aborted) return;
        setRendered({ id, result });
        await play(id, result, ac);
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted || (err as { code?: string })?.code === 'cancelled') return;
        setPhase('error');
      });
  }, []);

  // Plays a finished render; the sound counts as heard only if it reaches its natural end.
  async function play(id: string, result: RenderResult, ac: AbortController) {
    let fired = false;
    setPhase('playing');
    try {
      await latest.current.preview.play(result, () => {
        if (fired || ac.signal.aborted) return;
        fired = true;
        setPhase('done');
        latest.current.onSoundPlayed(id);
      });
    } catch {
      if (!ac.signal.aborted) setPhase('error');
    }
  }

  // A knob, Direction or Tail change: stop what is playing, drop what is rendering, and render again after a pause.
  const change = useCallback(
    (nextKnobs: Knobs, nextBars: Bars, nextDirection: PluginParams['direction']) => {
      setKnobs(nextKnobs);
      setBars(nextBars);
      setDirection(nextDirection);
      latest.current = { ...latest.current, knobs: nextKnobs, bars: nextBars, direction: nextDirection };
      const id = latest.current.selectedId;
      if (!id) return;
      abortRef.current?.abort();
      latest.current.preview.stop();
      setPhase('rendering');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        run(id, toParams(nextKnobs, nextBars, nextDirection));
      }, RERENDER_MS);
    },
    [run],
  );

  const pick = (id: string) => {
    setSelectedId(id);
    latest.current.selectedId = id;
    const { knobs: k, bars: b, direction: d } = latest.current;
    run(id, toParams(k, b, d));
  };

  useEffect(() => {
    const client = createRenderClient();
    clientRef.current = client;
    let cancelled = false;
    const list = latest.current.sources;
    const wasm = client.ready().then(
      () => ({ ok: true as const }),
      (err: unknown) => ({ ok: false as const, reason: err instanceof Error ? err.message : 'engine failed to load' }),
    );
    const samples = list.map((s) =>
      loadSource(s.src).then(
        (channels): Loaded => channels,
        (): Loaded => 'error',
      ).then((value) => {
        if (!cancelled) setLoaded((prev) => ({ ...prev, [s.id]: value }));
        return value;
      }),
    );
    void Promise.all([wasm, ...samples]).then(([engineResult, ...values]) => {
      if (cancelled) return;
      if (!engineResult.ok) {
        setEngine('error');
        latest.current.onLoadError?.(`Premonition engine did not load: ${engineResult.reason}`);
        return;
      }
      setEngine('ready');
      const failed = list.filter((_, i) => values[i] === 'error').map((s) => s.label);
      if (failed.length) latest.current.onLoadError?.(`A sound did not load: ${failed.join(', ')}`);
      else latest.current.onReady?.();
    });
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      abortRef.current?.abort();
      latest.current.preview.stop();
      client.dispose();
      clientRef.current = null;
    };
  }, []);

  const selected = sources.find((s) => s.id === selectedId) ?? null;
  const selectedChannels = selected && Array.isArray(loaded[selected.id]) ? (loaded[selected.id] as Float32Array[]) : null;
  const renderOfSelected = rendered && rendered.id === selected?.id ? rendered.result : null;

  const sourceEnv = useMemo(() => (selectedChannels ? peakEnvelope(selectedChannels[0], WAVE_BINS) : null), [selectedChannels]);
  const renderEnv = useMemo(() => (renderOfSelected ? peakEnvelope(renderOfSelected.channels[0], WAVE_BINS) : null), [renderOfSelected]);
  const grid = useMemo(() => {
    const audio = renderOfSelected?.channels[0] ?? selectedChannels?.[0];
    return terrainFromAudio(audio ?? new Float32Array(0), SAMPLE_RATE, TERRAIN_ROWS, TERRAIN_COLS);
  }, [renderOfSelected, selectedChannels]);

  if (engine === 'error') {
    return (
      <p className={styles.fault} role="alert">
        The Premonition engine could not load. Reload the page to try again.
      </p>
    );
  }

  const playing = phase === 'playing';
  const status = engine === 'loading' ? 'LOADING' : phase === 'rendering' ? 'RENDERING' : playing ? 'PREVIEW' : phase === 'done' ? 'RENDERED' : phase === 'error' ? 'ERROR' : 'READY';
  const ovStep = overhangStep(knobs.overhang);
  const usable = engine === 'ready';
  const fileSeconds = selectedChannels ? selectedChannels[0].length / SAMPLE_RATE : 0;
  const render = () => {
    const id = selectedId ?? sources.find((s) => Array.isArray(loaded[s.id]))?.id;
    if (id) pick(id);
  };
  const replay = () => {
    if (!selected || !renderOfSelected || phase === 'rendering') return render();
    abortRef.current?.abort();
    latest.current.preview.stop();
    const ac = new AbortController();
    abortRef.current = ac;
    void play(selected.id, renderOfSelected, ac);
  };
  const note =
    phase === 'error'
      ? 'That render did not complete. Try again.'
      : playing && selected
        ? `Playing ${selected.label}`
        : 'Pick a sound to hear it through the plugin.';

  return (
    <div className={styles.daw}>
      <div ref={fit} className={styles.fit} style={{ aspectRatio: `${STAGE_W} / ${STAGE_H}` }}>
        <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
          <div className={styles.session}>
            <span className={styles.sessionLabel}>Session</span>
            <span className={styles.sessionInfo}>120 BPM · 4/4</span>
            <span className={styles.sessionSpacer} />
            {onClose && (
              <button type="button" className={styles.close} onClick={onClose}>
                Close
              </button>
            )}
          </div>

          <section className={styles.plugin} aria-label={`${PLUGIN.name} plugin`}>
            <header className={styles.titleBar}>
              <span className={styles.preset}>{selected ? selected.label : 'No sound'}</span>
              <span className={styles.brand}>
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className={styles.logo}>
                  <circle cx="10" cy="10" r="8" className={styles.logoRing} />
                  <circle cx="10" cy="10" r="3.2" className={styles.logoCore} />
                </svg>
                Premonition
              </span>
              <span className={styles.status} data-state={phase === 'rendering' || playing ? 'busy' : 'idle'} role="status">
                <span className={styles.statusDot} aria-hidden="true" />
                {status}
              </span>
            </header>

            <div className={styles.strip}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Source</span>
                <div className={styles.sources} role="group" aria-label="Choose a sound">
                  {sources.map((s) => {
                    const heard = playedIds.has(s.id);
                    return (
                      <button
                        type="button"
                        key={s.id}
                        className={styles.source}
                        data-current={s.id === selectedId}
                        data-heard={heard}
                        aria-pressed={s.id === selectedId}
                        disabled={!usable || !Array.isArray(loaded[s.id])}
                        onClick={() => pick(s.id)}
                      >
                        {s.label}
                        {heard && <span className={styles.heard}>heard</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Direction</span>
                <div className={styles.seg} role="group" aria-label="Direction">
                  {(['reverse', 'forward'] as const).map((d) => (
                    <button type="button" key={d} data-on={direction === d} aria-pressed={direction === d} disabled={!usable} onClick={() => change(knobs, bars, d)}>
                      {d === 'reverse' ? 'Reverse' : 'Forward'}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Tail (bars)</span>
                <div className={styles.seg} role="group" aria-label="Tail length in bars">
                  {BARS.map((b) => (
                    <button type="button" key={b.label} data-on={bars === b.value} aria-pressed={bars === b.value} disabled={!usable} onClick={() => change(knobs, b.value, direction)}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.view}>
              <Terrain grid={grid} head={playing ? Math.floor(Math.min(0.999, preview.progress) * TERRAIN_ROWS) : -1} />
              <span className={styles.viewTag}>Terrain</span>
            </div>

            <div className={styles.waves}>
              <div className={styles.waveCol}>
                <div className={styles.waveHead}>
                  <span>Source · {selected ? selected.label.toLowerCase() : 'none'}</span>
                </div>
                <div className={styles.waveWell}>
                  <Stipple env={sourceEnv} seedKey={`${selectedId ?? 'none'}:source`} />
                </div>
                <div className={styles.waveFoot}>{selected ? `LENGTH ${fileSeconds.toFixed(2)} S` : 'NO SOUND PICKED'}</div>
              </div>
              <div className={styles.waveCol}>
                <div className={styles.waveHead}>
                  <span>Render · {renderOfSelected ? 'natural' : 'not rendered'}</span>
                </div>
                <div className={styles.waveWell}>
                  <Stipple env={renderEnv} seedKey={`${selectedId ?? 'none'}:render`} />
                  {playing && <span className={styles.playhead} style={{ left: `calc(${(preview.progress * 100).toFixed(2)}% - 1px)` }} />}
                </div>
                <div className={styles.waveFoot}>
                  LENGTH {bars} BAR{bars === 1 ? '' : 'S'}
                </div>
              </div>
            </div>

            <div className={styles.knobs}>
              <Knob label="Stretch" value={knobs.stretch} def={DEFAULT_KNOBS.stretch} text={`${stretchOf(knobs.stretch).toFixed(2)}×`} onChange={(v) => change({ ...knobs, stretch: v }, bars, direction)} />
              <Knob label="Bloom" value={knobs.bloom} def={DEFAULT_KNOBS.bloom} text={pct(knobs.bloom)} onChange={(v) => change({ ...knobs, bloom: v }, bars, direction)} />
              <Knob label="Size" value={knobs.size} def={DEFAULT_KNOBS.size} text={pct(knobs.size)} onChange={(v) => change({ ...knobs, size: v }, bars, direction)} />
              <Knob
                label="Overhang"
                value={knobs.overhang}
                def={DEFAULT_KNOBS.overhang}
                text={ovStep === 0 ? 'OFF' : `${OVERHANGS[ovStep].label} bar`}
                onChange={(v) => change({ ...knobs, overhang: v }, bars, direction)}
                steps={OVERHANGS.length}
              />
              <Knob label="Diffusion" value={knobs.diffusion} def={DEFAULT_KNOBS.diffusion} text={pct(knobs.diffusion)} onChange={(v) => change({ ...knobs, diffusion: v }, bars, direction)} />
            </div>

            <footer className={styles.foot}>
              <button type="button" className={styles.renderBtn} disabled={!usable} onClick={render}>
                Render
              </button>
              <button type="button" className={styles.round} aria-label="Play" disabled={!usable || (!selected && !Object.values(loaded).some(Array.isArray))} onClick={replay}>
                <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true">
                  <path d="M2.5 1.5 10 6 2.5 10.5Z" fill="currentColor" />
                </svg>
              </button>
              <span className={styles.footNote}>Listen only</span>
            </footer>
          </section>

          <div className={styles.under}>
            <span className={styles.tagline}>{PLUGIN.tagline}</span>
            <p className={styles.note} aria-live="polite">
              {note}
            </p>
          </div>
          <p className={styles.privacy}>Your sound is processed in this browser and never uploaded</p>
        </div>
      </div>
    </div>
  );
}
