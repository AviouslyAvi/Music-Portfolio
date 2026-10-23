'use client';

import { ROOM } from '@/content/copy';
import styles from './room.module.css';

// Plain DOM overlay for the room. Bottom left is text only (what is playing and
// how to move); the iPod and the computer are reached through the floating prompts in the room.
export function Hud({
  trackTitle,
  audioError = false,
}: {
  /** Shown as Now playing; pass '' while nothing is playing. */
  trackTitle: string;
  /** The music could not load or play: show a quiet line instead of the title. */
  audioError?: boolean;
}) {
  return (
    <>
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
        <p className={styles.hint}>{ROOM.hint}</p>
        <p className={styles.hintTouch}>{ROOM.hintTouch}</p>
      </div>
    </>
  );
}
