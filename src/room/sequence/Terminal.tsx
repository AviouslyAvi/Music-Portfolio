'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './terminal.module.css';

const DEFAULT_MIN_MS = 2500;
const COLUMNS = 36;
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ｱｲｳｴｵｶｷｸｹｺ+=<>';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// Fixed seed so the field is the same on every render.
function makeColumns(): Array<{ text: string; duration: number; delay: number }> {
  let s = 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  return Array.from({ length: COLUMNS }, () => ({
    text: Array.from({ length: 28 }, () => GLYPHS[Math.floor(rnd() * GLYPHS.length)]).join('\n'),
    duration: 3 + rnd() * 4,
    delay: -rnd() * 6,
  }));
}

/**
 * Boot terminal. Lines mirror the real load: the engine and sample lines are
 * printed as the load begins, "ready" only once the engine reports ready.
 * onDone fires once, after minMs and readiness, and never when the load failed.
 */
export function Terminal({
  engineReady,
  failed,
  onDone,
  minMs = DEFAULT_MIN_MS,
}: {
  engineReady: boolean;
  failed: boolean;
  onDone(): void;
  minMs?: number;
}) {
  const reduced = useMemo(prefersReducedMotion, []);
  const [elapsed, setElapsed] = useState(false);
  const [stage, setStage] = useState(reduced ? 2 : 0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const fired = useRef(false);

  useEffect(() => {
    const timers = [setTimeout(() => setElapsed(true), minMs)];
    if (!reduced) {
      timers.push(setTimeout(() => setStage(1), minMs * 0.15), setTimeout(() => setStage(2), minMs * 0.4));
    }
    return () => timers.forEach(clearTimeout);
  }, [minMs, reduced]);

  useEffect(() => {
    if (fired.current || !elapsed || !engineReady || failed) return;
    fired.current = true;
    doneRef.current();
  }, [elapsed, engineReady, failed]);

  const columns = useMemo(() => (reduced ? [] : makeColumns()), [reduced]);
  const lines: Array<{ text: string; fail?: boolean }> = [];
  lines.push({ text: 'AVIOUS studio terminal' });
  if (stage >= 1 || reduced) lines.push({ text: 'loading engine ....... ' + (engineReady ? 'ok' : '') });
  if (stage >= 2 || reduced) lines.push({ text: 'loading samples ...... ' + (engineReady ? 'ok' : '') });
  if (failed) lines.push({ text: 'engine failed to load', fail: true });
  else if (engineReady) lines.push({ text: 'ready' });

  return (
    <div className={styles.term} role="status" aria-live="polite" data-testid="terminal">
      {!reduced && (
        <div className={styles.field} data-code-field="" aria-hidden="true">
          {columns.map((c, i) => (
            <span key={i} className={styles.col} style={{ animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s` }}>
              {c.text}
            </span>
          ))}
        </div>
      )}
      <div className={styles.lines}>
        {lines.map((l) => (
          <div key={l.text} className={l.fail ? `${styles.line} ${styles.fail}` : styles.line}>
            {l.text}
          </div>
        ))}
        {!failed && <span className={styles.cursor} aria-hidden="true" />}
      </div>
    </div>
  );
}
