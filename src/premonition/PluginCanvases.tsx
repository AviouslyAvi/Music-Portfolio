'use client';

import { useEffect, useRef } from 'react';
import { hashSeed, mulberry32 } from './pluginViz';
import styles from './plugin.module.css';

const SCALE = 2; // bitmap pixels per stage pixel

function setup(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D | null {
  canvas.width = w * SCALE;
  canvas.height = h * SCALE;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null; // no canvas support (or jsdom): the face still works without its drawings
  }
  ctx?.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  return ctx;
}

const W = 848;
const H = 196;

/**
 * The TERRAIN view: stacked ridgelines in perspective, one per time slice of the audio
 * (far = start of the swell, near = the hit). `grid` comes from the real samples; drag to orbit.
 * `head` is the slice the playhead is on, or -1.
 */
export function Terrain({ grid, head }: { grid: number[][]; head: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const view = useRef({ yaw: 0.15, pitch: 0.8 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const paint = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = setup(canvas, W, H);
    if (!ctx) return;
    paint.current = () => {
      const rows = grid.length;
      const { yaw, pitch } = view.current;
      ctx.clearRect(0, 0, W, H);
      for (let r = 0; r < rows; r++) {
        const row = grid[r];
        const cols = row.length;
        const d = rows > 1 ? r / (rows - 1) : 1; // 0 far, 1 near
        const width = W * (0.55 + 0.4 * d);
        const x0 = (W - width) / 2 + yaw * (1 - d) * 90;
        const baseY = H * (0.34 + 0.6 * d * pitch);
        const amp = H * (0.26 + 0.3 * d);
        const top = () => {
          for (let c = 0; c < cols; c++) {
            const x = x0 + (c / Math.max(1, cols - 1)) * width;
            const y = baseY - row[c] * amp;
            if (c === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        };
        ctx.beginPath();
        top();
        ctx.lineTo(x0 + width, baseY + 4);
        ctx.lineTo(x0, baseY + 4);
        ctx.closePath();
        ctx.fillStyle = '#140d0b';
        ctx.fill();
        ctx.beginPath();
        top();
        ctx.lineWidth = r === head ? 1.8 : 1;
        ctx.strokeStyle = r === head ? '#f0e6d8' : `rgba(224,160,26,${(0.25 + 0.75 * d).toFixed(3)})`;
        ctx.stroke();
      }
    };
    paint.current();
  }, [grid, head]);

  return (
    <canvas
      ref={ref}
      className={styles.terrain}
      style={{ width: W, height: H }}
      aria-hidden="true"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const v = view.current;
        v.yaw = Math.max(-1, Math.min(1, v.yaw + (e.clientX - d.x) / 300));
        v.pitch = Math.max(0.45, Math.min(1, v.pitch - (e.clientY - d.y) / 300));
        d.x = e.clientX;
        d.y = e.clientY;
        paint.current();
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    />
  );
}

/** A stippled waveform well (the plugin's default drawing style) from a real peak envelope. */
export function Stipple({ env, seedKey, w = 404, h = 52 }: { env: Float32Array | null; seedKey: string; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = setup(canvas, w, h);
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    if (!env || env.length === 0) {
      ctx.fillStyle = 'rgba(154,132,116,0.35)';
      for (let x = 0; x < w; x += 4) ctx.fillRect(x, mid, 1.2, 1);
      return;
    }
    const rnd = mulberry32(hashSeed(seedKey));
    for (let x = 0; x < w; x += 1.5) {
      const level = env[Math.min(env.length - 1, Math.floor((x / w) * env.length))];
      const half = level * (h / 2 - 3);
      const dots = 3 + Math.round(level * 9);
      for (let k = 0; k < dots; k++) {
        const y = mid + (rnd() * 2 - 1) * half * (0.35 + 0.65 * rnd());
        ctx.fillStyle = `rgba(224,160,26,${(0.35 + 0.65 * rnd()).toFixed(2)})`;
        ctx.fillRect(x, y, 1.3, 1.3);
      }
    }
  }, [env, seedKey, w, h]);
  return <canvas ref={ref} className={styles.wave} style={{ width: w, height: h }} aria-hidden="true" />;
}
