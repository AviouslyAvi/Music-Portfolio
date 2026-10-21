'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SOUNDS } from '@/content/sounds';
import { PLUGINS } from '@/content/plugins';
import type { DemoState } from './machine';
import { Knob } from './Knob';
import { Stipple, Terrain } from './PluginCanvases';
import { OVERHANGS, OVERHANG_FRACTION } from './pluginViz';
import styles from './plugin.module.css';

const PLUGIN = PLUGINS[0];
// The plugin is drawn at its real 920 px width and scaled to whatever the screen gives it.
const STAGE_W = 920;
const STAGE_H = 800;
const BARS = ['1/2', '1', '2', '4', '8'];
const RENDERING_MS = 900;

const stretchOf = (v: number) => 0.25 * 16 ** v; // 0.25x .. 4x, 1.00x at the middle
const pct = (v: number) => `${Math.round(v * 100)}%`;

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

export function DawScreen({
  state,
  onPick,
  onSkip,
  onContinue,
}: {
  state: DemoState;
  onPick: (soundId: string) => void;
  /** Omitted outside the room: no Skip button is rendered. */
  onSkip?: () => void;
  /** Omitted outside the room: no Continue button is rendered. */
  onContinue?: () => void;
}) {
  const playing = state.phase === 'playing';
  const done = state.phase === 'done';
  const current = SOUNDS.find((s) => s.id === state.soundId);
  const selected = current ?? SOUNDS[0];
  const { fit, scale } = useStageScale();

  const [dir, setDir] = useState<'Reverse' | 'Forward'>('Reverse');
  const [bars, setBars] = useState('2');
  const [stretch, setStretch] = useState(0.5);
  const [bloom, setBloom] = useState(0.25);
  const [size, setSize] = useState(0.5);
  const [overhang, setOverhang] = useState(0.5);
  const [diffusion, setDiffusion] = useState(0.7);

  // RENDERING… for a moment at the start of a preview, then PREVIEW.
  const [rendering, setRendering] = useState(false);
  useEffect(() => {
    if (!playing) {
      setRendering(false);
      return;
    }
    setRendering(true);
    const t = setTimeout(() => setRendering(false), RENDERING_MS);
    return () => clearTimeout(t);
  }, [playing, state.soundId]);

  const status = state.audioError ? 'NO AUDIO' : playing ? (rendering ? 'RENDERING…' : 'PREVIEW') : done ? 'RENDERED' : 'READY';
  const hasRender = state.soundId !== null;
  const overhangIdx = Math.round(overhang * (OVERHANGS.length - 1));
  const ov = OVERHANG_FRACTION[overhangIdx];
  const shape = { bloom, size, diffusion, stretch: stretchOf(stretch) };
  const fileName = `riser_${selected.id.replace('sound-', 'pad_')}.wav`;
  const render = () => onPick(selected.id);

  return (
    <div className={styles.daw}>
      <div ref={fit} className={styles.fit} style={{ aspectRatio: `${STAGE_W} / ${STAGE_H}` }}>
        <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
          <div className={styles.session}>
            <span className={styles.sessionLabel}>Session</span>
            <span className={styles.sessionInfo}>120 BPM · 4/4</span>
            <span className={styles.sessionSpacer} />
            {onSkip && (
              <button type="button" className={styles.skip} data-demo-skip="" onClick={onSkip}>
                Skip
              </button>
            )}
          </div>

          <section className={styles.plugin} aria-label={`${PLUGIN.name} plugin`}>
            <header className={styles.titleBar}>
              <span className={styles.preset}>{selected.label}</span>
              <span className={styles.brand}>
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className={styles.logo}>
                  <circle cx="10" cy="10" r="8" className={styles.logoRing} />
                  <circle cx="10" cy="10" r="3.2" className={styles.logoCore} />
                </svg>
                Premonition
              </span>
              <span className={styles.status} data-state={playing ? 'busy' : 'idle'}>
                <span className={styles.statusDot} aria-hidden="true" />
                {status}
              </span>
            </header>

            <div className={styles.strip}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Source</span>
                <div className={styles.sources} role="group" aria-label="Choose a sound">
                  {SOUNDS.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className={styles.source}
                      data-current={s.id === state.soundId}
                      aria-pressed={s.id === state.soundId}
                      disabled={playing}
                      onClick={() => onPick(s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Direction</span>
                <div className={styles.seg} role="group" aria-label="Direction">
                  {(['Reverse', 'Forward'] as const).map((d) => (
                    <button type="button" key={d} data-on={dir === d} aria-pressed={dir === d} onClick={() => setDir(d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Tail (bars)</span>
                <div className={styles.seg} role="group" aria-label="Tail length in bars">
                  {BARS.map((b) => (
                    <button type="button" key={b} data-on={bars === b} aria-pressed={bars === b} onClick={() => setBars(b)}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.view}>
              <Terrain seedKey={selected.id} shape={shape} playing={playing} />
              <span className={styles.viewTag}>Terrain</span>
            </div>

            <div className={styles.waves}>
              <div className={styles.waveCol}>
                <div className={styles.waveHead}>
                  <span>Source · {selected.label.toLowerCase().replace(/ /g, '_')}.wav</span>
                  <span className={styles.snap}>Snap 1/16</span>
                </div>
                <div className={styles.waveWell}>
                  <Stipple kind="source" seedKey={selected.id} />
                  <span className={`${styles.handle} ${styles.in}`} />
                  <span className={`${styles.handle} ${styles.out}`} />
                </div>
                <div className={styles.waveFoot}>IN 0.00s · OUT 3.80s</div>
              </div>
              <div className={styles.waveCol}>
                <div className={styles.waveHead}>
                  <span>Render · {hasRender ? fileName : 'not rendered'}</span>
                  <span className={styles.snap}>Preview</span>
                </div>
                <div className={styles.waveWell}>
                  <Stipple kind="render" seedKey={selected.id} bloom={bloom} overhang={ov} empty={!hasRender} />
                  {playing && <span className={styles.playhead} />}
                </div>
                <div className={styles.waveFoot}>LENGTH {bars === '1/2' ? '0.5' : bars} BAR{bars === '1' ? '' : 'S'}</div>
              </div>
            </div>

            <div className={styles.knobs}>
              <Knob label="Stretch" value={stretch} def={0.5} text={`${stretchOf(stretch).toFixed(2)}×`} onChange={setStretch} />
              <Knob label="Bloom" value={bloom} def={0.25} text={pct(bloom)} onChange={setBloom} />
              <Knob label="Size" value={size} def={0.5} text={pct(size)} onChange={setSize} />
              <Knob
                label="Overhang"
                value={overhang}
                def={0.5}
                text={overhangIdx === 0 ? 'OFF' : `${OVERHANGS[overhangIdx]} bar`}
                onChange={setOverhang}
                steps={OVERHANGS.length}
              />
              <Knob label="Diffusion" value={diffusion} def={0.7} text={pct(diffusion)} onChange={setDiffusion} />
            </div>

            <footer className={styles.foot}>
              <button type="button" className={styles.renderBtn} disabled={playing} onClick={render}>
                Render
              </button>
              <button type="button" className={styles.round} aria-label="Preview" disabled={playing} onClick={render}>
                <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true">
                  <path d="M2.5 1.5 10 6 2.5 10.5Z" fill="currentColor" />
                </svg>
              </button>
              <div className={styles.dragPill}>
                <span className={styles.dragName}>{hasRender ? fileName : 'no render yet'}</span>
                <span className={styles.dragHint}>Drag into DAW →</span>
              </div>
            </footer>
          </section>

          <div className={styles.under}>
            <span className={styles.tagline}>Echoes of the future.</span>
            <p className={styles.note}>
              {state.audioError
                ? 'Audio unavailable on this device.'
                : playing && current
                  ? `Rendering ${current.label}`
                  : done && current
                    ? onContinue
                      ? `${current.label} rendered. Pick another or continue.`
                      : `${current.label} rendered. Pick another to hear it.`
                    : 'Pick a sound to hear it through the plugin.'}
            </p>
            {done && onContinue && (
              <button type="button" className={styles.continue} onClick={onContinue}>
                Continue to site
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
