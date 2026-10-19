'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { SOUNDS } from '@/content/sounds';
import { track } from '@/lib/analytics';
import { demoReducer, initialDemoState, type DemoState } from './machine';
import { useRenderedAudio } from './useRenderedAudio';
import { BootSequence } from './BootSequence';
import { DawScreen } from './DawScreen';
import styles from './demo.module.css';

const PHASE_TEXT: Record<DemoState['phase'], string> = {
  idle: 'Starting',
  booting: 'Starting up',
  ready: 'Ready. Choose a sound.',
  playing: 'Playing a rendered sound',
  done: 'Finished. Choose another sound or continue.',
  skipped: 'Demo skipped',
};

export function PremonitionDemo({
  bootSequence,
  onFinish,
}: {
  bootSequence: boolean;
  onFinish?: (reason: 'done' | 'skipped') => void;
}) {
  const [state, dispatch] = useReducer(demoReducer, initialDemoState, (s): DemoState =>
    // Without a boot sequence start straight in ready.
    bootSequence ? s : { ...s, phase: 'ready' },
  );
  const { play, stop } = useRenderedAudio();
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (state.phase === 'idle') dispatch({ type: 'POWER_ON' });
  }, [state.phase]);

  const onBootDone = useCallback(() => dispatch({ type: 'BOOT_DONE' }), []);

  const onPick = useCallback(
    (soundId: string) => {
      const sound = SOUNDS.find((s) => s.id === soundId);
      const phase = stateRef.current.phase;
      if (!sound || (phase !== 'ready' && phase !== 'done')) return;
      dispatch({ type: 'PICK', soundId });
      track('demo_played');
      play(sound.rendered).then(
        () => dispatch({ type: 'ENDED' }),
        () => dispatch({ type: 'ENDED', failed: true }),
      );
    },
    [play],
  );

  const onSkip = useCallback(() => {
    stop();
    track('demo_skipped');
    dispatch({ type: 'SKIP' });
    onFinish?.('skipped');
  }, [stop, onFinish]);

  const onContinue = useCallback(() => onFinish?.('done'), [onFinish]);

  return (
    <div className={styles.root}>
      <p role="status" className={styles.srOnly}>
        {state.phase === 'done' && state.audioError
          ? 'Audio unavailable. Choose another sound or continue.'
          : PHASE_TEXT[state.phase]}
      </p>
      {state.phase === 'booting' || state.phase === 'idle' ? (
        <>
          <BootSequence onDone={onBootDone} />
          <button type="button" className={`${styles.btn} ${styles.floatSkip}`} data-demo-skip="" onClick={onSkip}>
            Skip
          </button>
        </>
      ) : state.phase === 'skipped' ? (
        <div className={styles.boot}>Demo skipped.</div>
      ) : (
        <DawScreen state={state} onPick={onPick} onSkip={onSkip} onContinue={onContinue} />
      )}
    </div>
  );
}
