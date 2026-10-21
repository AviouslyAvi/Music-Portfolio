'use client';

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { detectEnv, shouldOfferRoom } from '@/lib/capability';
import { track } from '@/lib/analytics';
import { TRACKS } from '@/content/tracks';
import { VOICE_MEMOS } from '@/content/voiceMemos';
import { GuitarSynth } from './guitarSynth';
import { GUITAR_ACOUSTIC, GUITAR_ELECTRIC, PIANO } from './layout';
import { ROOM } from '@/content/copy';
import { TrackPlayer } from './audioEngine';
import type { RoomAudio } from './RoomExperience';
import styles from './room.module.css';

type RoomProps = {
  onLeave: () => void;
  onFail: () => void;
  audio?: RoomAudio | null;
  audioFailures?: string[];
};

/** Stands in for the room when its chunk cannot load: reports the failure once mounted. */
function FailOnMount({ onFail }: RoomProps) {
  useEffect(() => onFail(), [onFail]);
  return null;
}

// The room chunk (three.js included) is only fetched once this renders,
// which happens after the visitor clicks Enter. A failed fetch becomes a
// normal room failure instead of an application error.
const RoomExperience = dynamic<RoomProps>(() => import('./RoomExperience').then((m) => m.default, () => FailOnMount), {
  ssr: false,
  loading: () => (
    <div className={styles.loading} role="status">
      {ROOM.loading}
    </div>
  ),
});

/** Any render error in the room tree falls back to the normal home. */
class RoomBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

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

/**
 * Create the audio context inside the click gesture, but start nothing: the music
 * begins only when the visitor presses play on the iPod.
 */
function startAudio(onError: (trackId: string) => void): RoomAudio | null {
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const player = new TrackPlayer(ctx, [...TRACKS, ...VOICE_MEMOS], ctx.destination);
    player.onError((e) => onError(e.trackId));
    // The guitars make their own context in the same click, so a strum is allowed to sound.
    let guitar: GuitarSynth | undefined;
    try {
      guitar = new GuitarSynth({ electric: GUITAR_ELECTRIC, acoustic: GUITAR_ACOUSTIC, piano: PIANO });
      guitar.prepare();
    } catch {
      guitar?.dispose();
      guitar = undefined; // the music still works without the guitars
    }
    return { ctx, player, guitar };
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
    audio.guitar?.dispose();
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
  // Track ids (or 'audio-context') that failed, for the HUD's error line.
  const [audioFailures, setAudioFailures] = useState<string[]>([]);
  const audioRef = useRef<RoomAudio | null>(null);
  const enteredRef = useRef(false);
  const enterBtn = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);

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

  // While the overlay or the room covers the page: lock scroll and make the
  // site behind it (nav, main, footer) inert, so Tab and assistive tech stay
  // inside the dialog.
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = rootRef.current;
    const made: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (root && el.contains(root)) continue;
      if (el.hasAttribute('inert') || el.tagName === 'SCRIPT') continue;
      el.setAttribute('inert', '');
      made.push(el);
    }
    return () => {
      document.body.style.overflow = prev;
      for (const el of made) el.removeAttribute('inert');
    };
  }, [active]);

  // After Skip, Leave or a failure, put focus on the page content.
  useEffect(() => {
    if (state !== 'left' || !restoreFocus.current) return;
    restoreFocus.current = false;
    document.getElementById('main')?.focus();
  }, [state]);

  const skip = useCallback(() => {
    writeLeft();
    restoreFocus.current = true;
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
    const a = startAudio((id) => setAudioFailures((prev) => (prev.includes(id) ? prev : [...prev, id])));
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
    restoreFocus.current = true;
    setState('left');
  }, []);

  const onLeave = useCallback(() => finish(true), [finish]);
  const onFail = useCallback(() => finish(false), [finish]);

  if (state === 'offering') {
    return (
      <div ref={rootRef} className={styles.gate} role="dialog" aria-modal="true" aria-label={ROOM.enterLabel}>
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
  if (state === 'room') {
    return (
      <div ref={rootRef}>
        <RoomBoundary onError={onFail}>
          <RoomExperience onLeave={onLeave} onFail={onFail} audio={audio} audioFailures={audioFailures} />
        </RoomBoundary>
      </div>
    );
  }
  return null;
}
