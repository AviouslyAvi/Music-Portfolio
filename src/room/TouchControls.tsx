'use client';

import { useRef, type MutableRefObject, type PointerEvent } from 'react';
import { ROOM } from '@/content/copy';
import styles from './room.module.css';

export type TouchMove = { forward: number; strafe: number };

const RADIUS = 48; // px of knob travel that counts as full speed
const DEAD_ZONE = 0.15;

/** Walk stick for touch devices (shown by CSS on coarse pointers only). Writes into `moveRef`; the room reads it each frame. */
export function TouchControls({ moveRef }: { moveRef: MutableRefObject<TouchMove> }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);

  const set = (dx: number, dy: number) => {
    const len = Math.hypot(dx, dy);
    const k = len > RADIUS ? RADIUS / len : 1;
    const x = dx * k;
    const y = dy * k;
    if (knobRef.current) knobRef.current.style.transform = `translate(${x}px, ${y}px)`;
    const fx = x / RADIUS;
    const fy = y / RADIUS;
    moveRef.current = Math.hypot(fx, fy) < DEAD_ZONE ? { forward: 0, strafe: 0 } : { forward: -fy, strafe: fx };
  };
  const reset = () => {
    activeId.current = null;
    set(0, 0);
  };
  const track = (e: PointerEvent<HTMLDivElement>) => {
    const r = baseRef.current?.getBoundingClientRect();
    if (r) set(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
  };

  return (
    <div
      ref={baseRef}
      className={styles.stick}
      role="group"
      aria-label={ROOM.stickLabel}
      onPointerDown={(e) => {
        if (activeId.current !== null) return;
        activeId.current = e.pointerId;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        track(e);
      }}
      onPointerMove={(e) => {
        if (e.pointerId === activeId.current) track(e);
      }}
      onPointerUp={(e) => {
        if (e.pointerId === activeId.current) reset();
      }}
      onPointerCancel={(e) => {
        if (e.pointerId === activeId.current) reset();
      }}
    >
      <div ref={knobRef} className={styles.stickKnob} />
    </div>
  );
}
