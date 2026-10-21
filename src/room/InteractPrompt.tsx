'use client';

import type { Ref } from 'react';
import { ROOM } from '@/content/copy';
import styles from './room.module.css';

export type PromptTarget = 'ipod' | 'computer';

// The floating "Press E to interact" label that sits next to the iPod or the
// computer when the visitor is close. RoomExperience moves it each frame (through
// the ref) to the object's projected screen position and shows or hides it with
// data-visible. It is a real button, so a mouse or keyboard visitor can use it
// without the E key.
export function InteractPrompt({
  target,
  onActivate,
  ref,
}: {
  target: PromptTarget;
  onActivate: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className={styles.prompt}
      data-visible="false"
      data-prompt={target}
      aria-label={target === 'ipod' ? ROOM.promptIpodLabel : ROOM.promptComputerLabel}
      onClick={onActivate}
    >
      <span className={styles.promptKey} aria-hidden="true">
        E
      </span>
      <span className={styles.promptText}>{ROOM.promptText}</span>
    </button>
  );
}
