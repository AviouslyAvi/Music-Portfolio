'use client';

import { ROOM } from '@/content/copy';
import styles from './room.module.css';

export type Interactable = 'ipod' | 'computer';

// Plain DOM overlay for the room. Every action is a real button, so the room
// works with the keyboard alone and with the mouse unlocked.
export function Hud({
  nearby,
  trackTitle,
  audioError = false,
  onInteract,
  onLeave,
}: {
  nearby: Interactable | null;
  trackTitle: string;
  /** The music could not load or play: show a quiet line instead of the title. */
  audioError?: boolean;
  onInteract: (t: Interactable) => void;
  onLeave: () => void;
}) {
  return (
    <div className={styles.hud}>
      {audioError ? (
        <p className={styles.nowPlaying}>{ROOM.audioUnavailable}</p>
      ) : (
        trackTitle && (
          <p className={styles.nowPlaying}>
            <span className={styles.label}>{ROOM.nowPlaying}</span> {trackTitle}
          </p>
        )
      )}
      <p className={styles.nearby} aria-live="polite">
        {nearby === 'ipod' ? ROOM.nearbyIpod : nearby === 'computer' ? ROOM.nearbyComputer : ''}
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.hudBtn}
          data-nearby={nearby === 'ipod'}
          onClick={() => onInteract('ipod')}
        >
          {ROOM.ipodButton}
        </button>
        <button
          type="button"
          className={styles.hudBtn}
          data-nearby={nearby === 'computer'}
          data-hud-computer=""
          onClick={() => onInteract('computer')}
        >
          {ROOM.computerButton}
        </button>
        <button type="button" className={`${styles.hudBtn} ${styles.leave}`} onClick={onLeave}>
          {ROOM.leaveButton}
        </button>
      </div>
      <p className={styles.hint}>{ROOM.hint}</p>
    </div>
  );
}
