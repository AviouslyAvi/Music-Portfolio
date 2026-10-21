'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Track } from '@/content/tracks';
import { IPOD } from '@/content/copy';
import { IPOD_MENU, initialIpodState, ipodReducer, topScreen, type IpodAction, type IpodEvent, type IpodState } from './menu';
import styles from './ipod.module.css';

const STEP_DEGREES = 24; // one wheel notch

// Plain SVG glyphs (no emoji characters anywhere in the source).
const Glyph = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <path d={d} fill="currentColor" />
  </svg>
);
const PREV_D = 'M6 5h2v14H6zM20 5v14L9 12z';
const NEXT_D = 'M16 5h2v14h-2zM4 5l11 7L4 19z';
const PLAY_D = 'M7 4l13 8-13 8z';
const PAUSE_D = 'M6 4h4v16H6zM14 4h4v16h-4z';
const VISIBLE_ROWS = 5;

type Props = {
  tracks: Track[];
  currentIndex: number;
  playing: boolean;
  /** 0 to 1. */
  volume: number;
  onAction: (a: IpodAction) => void;
};

function windowAround(cursor: number, size: number): number[] {
  const rows = Math.min(VISIBLE_ROWS, size);
  const start = Math.max(0, Math.min(size - rows, cursor - Math.floor(rows / 2)));
  return Array.from({ length: rows }, (_, i) => start + i);
}

// A classic click-wheel iPod. The four wheel buttons, the centre button and
// the ring (drag around it, or use the mouse wheel) are all real controls; the
// keyboard does the same through the arrow keys, Enter, Space and Escape.
export function IpodScreen({ tracks, currentIndex, playing, volume, onAction }: Props) {
  const [state, setState] = useState<IpodState>(initialIpodState);
  const stateRef = useRef(state);
  const ctxRef = useRef({ trackCount: tracks.length, currentIndex });
  ctxRef.current = { trackCount: tracks.length, currentIndex };
  const actionRef = useRef(onAction);
  actionRef.current = onAction;
  const rootRef = useRef<HTMLDivElement>(null);

  const send = useCallback((e: IpodEvent) => {
    const r = ipodReducer(stateRef.current, e, ctxRef.current);
    stateRef.current = r.state;
    setState(r.state);
    if (r.action) actionRef.current(r.action);
  }, []);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const map: Record<string, IpodEvent | undefined> = {
      ArrowUp: { type: 'SCROLL', delta: -1 },
      ArrowDown: { type: 'SCROLL', delta: 1 },
      ArrowLeft: { type: 'PREV' },
      ArrowRight: { type: 'NEXT' },
      Enter: { type: 'SELECT' },
      ' ': { type: 'PLAY_PAUSE' },
      Escape: { type: 'BACK' },
      Backspace: { type: 'BACK' },
    };
    let ev = map[e.key];
    if (!ev) return;
    // On Now Playing, up means louder (on lists, up moves up the list).
    if (ev.type === 'SCROLL' && topScreen(stateRef.current).kind === 'now') ev = { type: 'SCROLL', delta: -ev.delta };
    // Buttons inside the iPod handle their own Enter and Space.
    if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).tagName === 'BUTTON') return;
    e.preventDefault();
    e.stopPropagation();
    send(ev);
  };

  // Dragging around the ring: one SCROLL per STEP_DEGREES of travel.
  const ring = useRef<{ last: number; acc: number } | null>(null);
  const angleOf = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const onRingDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // a wheel button was pressed, not the bare ring
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture is optional
    }
    ring.current = { last: angleOf(e), acc: 0 };
  };
  const onRingMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = ring.current;
    if (!r) return;
    const a = angleOf(e);
    let d = a - r.last;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    r.last = a;
    r.acc += d;
    while (Math.abs(r.acc) >= STEP_DEGREES) {
      const dir = r.acc > 0 ? 1 : -1;
      r.acc -= dir * STEP_DEGREES;
      send({ type: 'SCROLL', delta: dir });
    }
  };
  const onRingUp = () => {
    ring.current = null;
  };
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.deltaY) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    // Wheel up is louder on Now Playing, up the list elsewhere.
    send({ type: 'SCROLL', delta: topScreen(stateRef.current).kind === 'now' ? -dir : dir });
  };

  const top = topScreen(state);
  const track = tracks[currentIndex];
  const pct = Math.round(volume * 100);

  return (
    <div
      ref={rootRef}
      className={styles.ipod}
      role="group"
      aria-label="iPod"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-testid="ipod"
    >
      <div className={styles.lcd} aria-live="polite">
        {top.kind === 'now' && (
          <div className={styles.now}>
            <div className={styles.lcdTitle}>Now Playing</div>
            <div className={styles.songTitle}>{track ? track.title : 'No songs'}</div>
            <div className={styles.meta}>
              {tracks.length ? `${currentIndex + 1} of ${tracks.length}` : ''} {playing ? 'Playing' : 'Press play'}
            </div>
            <div className={styles.volRow}>
              <span className={styles.volLabel}>Volume</span>
              <div
                className={styles.vol}
                role="progressbar"
                aria-label="Volume"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <div className={styles.volFill} style={{ width: `${pct}%` }} />
              </div>
              <span className={styles.volPct}>{pct}</span>
            </div>
          </div>
        )}
        {top.kind === 'menu' && (
          <div>
            <div className={styles.lcdTitle}>iPod</div>
            <ul className={styles.list} role="listbox" aria-label="Menu">
              {IPOD_MENU.map((label, i) => (
                <li key={label} role="option" aria-selected={i === state.cursor} className={i === state.cursor ? styles.sel : undefined}>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}
        {top.kind === 'music' && (
          <div>
            <div className={styles.lcdTitle}>Music</div>
            <ul className={styles.list} role="listbox" aria-label="Songs">
              {windowAround(state.cursor, tracks.length).map((i) => (
                <li key={tracks[i].id} role="option" aria-selected={i === state.cursor} className={i === state.cursor ? styles.sel : undefined}>
                  {i === currentIndex && playing ? '> ' : ''}
                  {tracks[i].title}
                </li>
              ))}
            </ul>
          </div>
        )}
        {top.kind === 'page' && (
          <div>
            <div className={styles.lcdTitle}>{IPOD.pages[top.id].title}</div>
            <p className={styles.pageBody}>{IPOD.pages[top.id].body}</p>
            <p className={styles.meta}>{IPOD.openLink}</p>
          </div>
        )}
      </div>

      <div
        className={styles.wheel}
        onPointerDown={onRingDown}
        onPointerMove={onRingMove}
        onPointerUp={onRingUp}
        onPointerCancel={onRingUp}
        onWheel={onWheel}
        data-testid="ipod-wheel"
      >
        <button type="button" className={`${styles.wbtn} ${styles.wTop}`} onClick={() => send({ type: 'BACK' })} aria-label="Menu">
          MENU
        </button>
        <button type="button" className={`${styles.wbtn} ${styles.wLeft}`} onClick={() => send({ type: 'PREV' })} aria-label="Previous song">
          <Glyph d={PREV_D} />
        </button>
        <button type="button" className={`${styles.wbtn} ${styles.wRight}`} onClick={() => send({ type: 'NEXT' })} aria-label="Next song">
          <Glyph d={NEXT_D} />
        </button>
        <button
          type="button"
          className={`${styles.wbtn} ${styles.wBottom}`}
          onClick={() => send({ type: 'PLAY_PAUSE' })}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <Glyph d={playing ? PAUSE_D : PLAY_D} />
        </button>
        <button type="button" className={styles.center} onClick={() => send({ type: 'SELECT' })} aria-label="Select" />
      </div>
      <p className={styles.help}>Drag the wheel or press Up and Down to scroll and change volume. Esc goes back.</p>
    </div>
  );
}
