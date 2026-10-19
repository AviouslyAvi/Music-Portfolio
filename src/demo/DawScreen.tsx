'use client';

import { SOUNDS } from '@/content/sounds';
import { PLUGINS } from '@/content/plugins';
import type { DemoState } from './machine';
import styles from './demo.module.css';

const PLUGIN = PLUGINS[0];
const LANES = ['Drums', 'Bass', 'Keys', 'Vocal'];
// Fixed clip layout (percent) so the lanes look like a session without any randomness.
const CLIPS: Array<Array<[number, number]>> = [
  [[2, 22], [26, 22], [50, 22]],
  [[2, 46], [52, 30]],
  [[10, 30], [44, 38]],
  [[18, 28], [56, 24]],
];
const STEPS = ['Drop', 'Render', 'Drag'];

export function DawScreen({
  state,
  onPick,
  onSkip,
  onContinue,
}: {
  state: DemoState;
  onPick: (soundId: string) => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const playing = state.phase === 'playing';
  const done = state.phase === 'done';
  const activeStep = playing ? 1 : done ? 2 : 0;
  const current = SOUNDS.find((s) => s.id === state.soundId);

  return (
    <div className={styles.daw}>
      <div className={styles.transport}>
        <span className={styles.transportLabel}>Session</span>
        <span className={styles.led} data-on={playing} aria-hidden="true" />
        <span className={styles.readout}>{playing ? 'Rendering' : done ? 'Rendered' : 'Stopped'}</span>
        <button type="button" className={styles.btn} onClick={onSkip}>
          Skip
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.lanes} aria-hidden="true">
          {LANES.map((name, i) => (
            <div className={styles.lane} key={name}>
              <span className={styles.laneName}>{name}</span>
              <div className={styles.laneTrack}>
                {CLIPS[i].map(([left, width]) => (
                  <span key={left} className={styles.clip} style={{ left: `${left}%`, width: `${width}%` }} />
                ))}
              </div>
            </div>
          ))}
          <div className={styles.playhead} data-playing={playing} />
        </div>

        <section className={styles.panel} aria-label={`${PLUGIN.name} plugin`}>
          <h2 className={styles.wordmark}>{PLUGIN.name}</h2>
          <p className={styles.tagline}>{PLUGIN.tagline}</p>
          <ol className={styles.steps}>
            {STEPS.map((s, i) => (
              <li key={s} data-active={i === activeStep}>
                <span className={styles.stepNum}>{i + 1}</span> {s}
              </li>
            ))}
          </ol>
          <div className={styles.sounds} role="group" aria-label="Choose a sound">
            {SOUNDS.map((s) => (
              <button
                type="button"
                key={s.id}
                className={styles.btn}
                data-current={s.id === state.soundId}
                aria-pressed={s.id === state.soundId}
                disabled={playing}
                onClick={() => onPick(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className={styles.note}>
            {state.audioError
              ? 'Audio unavailable on this device.'
              : playing && current
                ? `Rendering ${current.label}`
                : done && current
                  ? `${current.label} rendered. Pick another or continue.`
                  : 'Pick a sound to hear it through the plugin.'}
          </p>
          {done && (
            <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={onContinue}>
              Continue to site
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
