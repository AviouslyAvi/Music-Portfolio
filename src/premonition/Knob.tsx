'use client';

import { useRef, useState } from 'react';
import styles from './plugin.module.css';

const SWEEP = 270; // degrees of arc
const START = 135; // arc starts bottom-left
const DRAG_PX = 280; // a full-range drag, as in the plugin
const FINE_PX = 900; // with Shift

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arc(r: number, from: number, to: number): string {
  const [x1, y1] = polar(40, 40, r, from);
  const [x2, y2] = polar(40, 40, r, to);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * A ring knob as in the plugin: drag up or down (Shift for fine), double-click to reset,
 * arrow keys when focused. `steps` makes it discrete (the overhang note values).
 */
export function Knob({
  label,
  value,
  def,
  text,
  onChange,
  steps,
}: {
  label: string;
  value: number; // 0..1
  def: number;
  text: string;
  onChange: (v: number) => void;
  steps?: number;
}) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const [active, setActive] = useState(false);
  const snap = (v: number) => {
    const c = Math.min(1, Math.max(0, v));
    return steps ? Math.round(c * (steps - 1)) / (steps - 1) : c;
  };
  const end = START + SWEEP * value;

  return (
    <div className={styles.knobCell}>
      <div
        className={styles.knob}
        data-active={active}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={text}
        onPointerDown={(e) => {
          if (e.detail >= 2) {
            onChange(def);
            return;
          }
          e.currentTarget.setPointerCapture?.(e.pointerId);
          drag.current = { y: e.clientY, v: value };
          setActive(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const span = e.shiftKey ? FINE_PX : DRAG_PX;
          onChange(snap(d.v + (d.y - e.clientY) / span));
        }}
        onPointerUp={() => {
          drag.current = null;
          setActive(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setActive(false);
        }}
        onDoubleClick={() => onChange(def)}
        onKeyDown={(e) => {
          const step = steps ? 1 / (steps - 1) : e.shiftKey ? 0.01 : 0.05;
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(snap(value + step));
          else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(snap(value - step));
          else if (e.key === 'Home') onChange(0);
          else if (e.key === 'End') onChange(1);
          else return;
          e.preventDefault();
        }}
      >
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="26" className={styles.knobFace} />
          <path d={arc(33, START, START + SWEEP)} className={styles.knobTrack} />
          {value > 0.001 && <path d={arc(33, START, end)} className={styles.knobArc} />}
          {(() => {
            const [x1, y1] = polar(40, 40, 9, end);
            const [x2, y2] = polar(40, 40, 21, end);
            return <line x1={x1} y1={y1} x2={x2} y2={y2} className={styles.knobTick} />;
          })()}
        </svg>
      </div>
      <span className={styles.knobLabel}>{label}</span>
      <span className={styles.knobValue}>{text}</span>
    </div>
  );
}
