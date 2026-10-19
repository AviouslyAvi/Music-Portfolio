'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { detectEnv, shouldOfferRoom } from '@/lib/capability';
import { track } from '@/lib/analytics';
import { TRACKS } from '@/content/tracks';
import { ROOM } from '@/content/copy';
import { TrackPlayer } from './audioEngine';
import type { RoomAudio } from './RoomExperience';
import styles from './room.module.css';

// The room chunk (three.js included) is only fetched once this renders,
// which happens after the visitor clicks Enter.
const RoomExperience = dynamic(() => import('./RoomExperience'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading} role="status">
      {ROOM.loading}
    </div>
  ),
});

const LEFT_KEY = 'room:left';
type GateState = 'checking' | 'unavailable' | 'offering' | 'room' | 'left';

// A failure is not persisted (it may be transient), but the room is not offered
// again during this page view.
let failedThisView = false;

function readLeft(): boolean {
  try {
    return window.sessionStorage.getItem(LEFT_KEY) === '1';
  } catch {
    return false;
  }
}

function writeLeft(): void {
  try {
    window.sessionStorage.setItem(LEFT_KEY, '1');
  } catch {
    // storage may be blocked; the overlay is simply offered again next time
  }
}

/** Create the audio context and start the playlist inside the click gesture. */
function startAudio(): RoomAudio | null {
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const player = new TrackPlayer(ctx, TRACKS, ctx.destination);
    player.start().catch(() => {});
    return { ctx, player };
  } catch {
    return null;
  }
}

function stopAudio(audio: RoomAudio | null): void {
  if (!audio) return;
  try {
    audio.player.dispose();
  } catch {
    // ignore
  }
  try {
    void audio.ctx.close().catch(() => {});
  } catch {
    // ignore
  }
}

export function RoomGate() {
  const [state, setState] = useState<GateState>('checking');
  const [audio, setAudio] = useState<RoomAudio | null>(null);
  const audioRef = useRef<RoomAudio | null>(null);
  const enteredRef = useRef(false);
  const enterBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let offer = false;
    try {
      offer = !failedThisView && !readLeft() && shouldOfferRoom(detectEnv(window));
    } catch {
      offer = false;
    }
    setState(offer ? 'offering' : 'unavailable');
  }, []);

  const active = state === 'offering' || state === 'room';

  // Lock page scroll while the overlay or the room covers it.
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  const skip = useCallback(() => {
    writeLeft();
    setState('left');
  }, []);

  useEffect(() => {
    if (state !== 'offering') return;
    enterBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, skip]);

  // Release audio if the gate itself unmounts (route change while in the room).
  useEffect(
    () => () => {
      stopAudio(audioRef.current);
      audioRef.current = null;
    },
    [],
  );

  const enter = useCallback(() => {
    if (enteredRef.current) return;
    enteredRef.current = true;
    track('room_entered');
    const a = startAudio();
    audioRef.current = a;
    setAudio(a);
    setState('room');
  }, []);

  const finish = useCallback((persist: boolean) => {
    if (persist) writeLeft();
    else failedThisView = true;
    stopAudio(audioRef.current);
    audioRef.current = null;
    setAudio(null);
    setState('left');
  }, []);

  const onLeave = useCallback(() => finish(true), [finish]);
  const onFail = useCallback(() => finish(false), [finish]);

  if (state === 'offering') {
    return (
      <div className={styles.gate} role="dialog" aria-modal="true" aria-label={ROOM.enterLabel}>
        <div className={styles.gateCard}>
          <p className={styles.eyebrow}>{ROOM.enterEyebrow}</p>
          <h2 className={styles.gateTitle}>{ROOM.enterTitle}</h2>
          <p className={styles.gateBody}>{ROOM.enterBody}</p>
          <div className={styles.gateActions}>
            <button ref={enterBtn} type="button" className={`${styles.gateBtn} ${styles.gatePrimary}`} onClick={enter}>
              {ROOM.enter}
            </button>
            <button type="button" className={styles.gateBtn} onClick={skip}>
              {ROOM.skip}
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (state === 'room') return <RoomExperience onLeave={onLeave} onFail={onFail} audio={audio} />;
  return null;
}
