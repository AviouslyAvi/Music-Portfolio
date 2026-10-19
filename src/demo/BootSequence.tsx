'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './demo.module.css';

const LINES = [
  'AVIOUS STUDIO SYSTEM',
  'memory check ............ ok',
  'audio engine ............ ok',
  'loading session ......... ok',
  'plugin: PREMONITION ..... found',
  'ready',
];

const TOTAL_MS = 2500;
const REDUCED_MS = 400;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function BootSequence({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const reduced = prefersReducedMotion();
    if (reduced) setShown(LINES.length);
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!reduced) {
      const step = TOTAL_MS / (LINES.length + 1);
      LINES.forEach((_, i) => timers.push(setTimeout(() => setShown(i + 1), step * (i + 1))));
    }
    timers.push(setTimeout(() => done.current(), reduced ? REDUCED_MS : TOTAL_MS));
    const onKey = () => done.current();
    window.addEventListener('keydown', onKey);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className={styles.boot} aria-hidden="true">
      {LINES.slice(0, shown).map((l) => (
        <div key={l}>{l}</div>
      ))}
      <span className={styles.cursor} />
    </div>
  );
}
