'use client';

import { useEffect, useRef } from 'react';
import { hashSeed, mulberry32, renderEnvelope, sourceEnvelope, terrainGrid, type Shape } from './pluginViz';
import styles from './plugin.module.css';

const SCALE = 2; // bitmap pixels per stage pixel
const ROWS = 30;
const COLS = 96;
const PREVIEW_MS = 3000;

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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

/** The TERRAIN view: stacked ridgelines in perspective; drag to orbit. Animates while previewing. */
export function Terrain({ seedKey, shape, playing }: { seedKey: string; shape: Shape; playing: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const view = useRef({ yaw: 0.15, pitch: 0.8 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const paint = useRef<(now: number) => void>(() => {});
  const W = 848;
  const H = 196;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = setup(canvas, W, H);
    if (!ctx) return;
    let start = -1;
    let raf = 0;
    paint.current = (now: number) => {
      if (start < 0) start = now;
      const t = playing ? Math.min(1, (now - start) / PREVIEW_MS) : 1;
      const grid = terrainGrid(seedKey, ROWS, COLS, shape, playing ? (now - start) / 380 : 0);
      const { yaw, pitch } = view.current;
      ctx.clearRect(0, 0, W, H);
      const head = playing ? Math.floor(t * (ROWS - 1)) : -1;
      for (let r = 0; r < ROWS; r++) {
        const d = r / (ROWS - 1); // 0 far, 1 near
        const width = W * (0.55 + 0.4 * d);
        const x0 = (W - width) / 2 + yaw * (1 - d) * 90;
        const baseY = H * (0.34 + 0.6 * d * pitch);
        const amp = H * (0.26 + 0.3 * d);
        ctx.beginPath();
        for (let c = 0; c < COLS; c++) {
          const x = x0 + (c / (COLS - 1)) * width;
          const y = baseY - grid[r][c] * amp;
          if (c === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(x0 + width, baseY + 4);
        ctx.lineTo(x0, baseY + 4);
        ctx.closePath();
        ctx.fillStyle = '#140d0b';
        ctx.fill();
        // The ridge line itself (re-stroke only the top edge).
        ctx.beginPath();
        for (let c = 0; c < COLS; c++) {
          const x = x0 + (c / (COLS - 1)) * width;
          const y = baseY - grid[r][c] * amp;
          if (c === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineWidth = r === head ? 1.8 : 1;
        ctx.strokeStyle = r === head ? '#f0e6d8' : `rgba(224,160,26,${(0.25 + 0.75 * d).toFixed(3)})`;
        ctx.stroke();
      }
    };
    if (playing && !reducedMotion()) {
      const loop = (now: number) => {
        paint.current(now);
        if (now - start < PREVIEW_MS) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } else {
      paint.current(0);
    }
    return () => cancelAnimationFrame(raf);
  }, [seedKey, shape, playing]);

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
        if (!playing) paint.current(0);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    />
  );
}

/** A stippled waveform well, the plugin's default drawing style. */
export function Stipple({
  kind,
  seedKey,
  bloom = 0.25,
  overhang = 0.08,
  empty = false,
  w = 404,
  h = 52,
}: {
  kind: 'source' | 'render';
  seedKey: string;
  bloom?: number;
  overhang?: number;
  empty?: boolean;
  w?: number;
  h?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = setup(canvas, w, h);
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    if (empty) {
      ctx.fillStyle = 'rgba(154,132,116,0.35)';
      for (let x = 0; x < w; x += 4) ctx.fillRect(x, mid, 1.2, 1);
      return;
    }
    const rnd = mulberry32(hashSeed(`${seedKey}:${kind}`));
    for (let x = 0; x < w; x += 1.5) {
      const p = x / w;
      const env = kind === 'source' ? sourceEnvelope(p, seedKey) : renderEnvelope(p, bloom, overhang);
      const half = env * (h / 2 - 3);
      const dots = 3 + Math.round(env * 9);
      for (let k = 0; k < dots; k++) {
        const y = mid + (rnd() * 2 - 1) * half * (0.35 + 0.65 * rnd());
        ctx.fillStyle = `rgba(224,160,26,${(0.35 + 0.65 * rnd()).toFixed(2)})`;
        ctx.fillRect(x, y, 1.3, 1.3);
      }
    }
  }, [kind, seedKey, bloom, overhang, empty, w, h]);
  return <canvas ref={ref} className={styles.wave} style={{ width: w, height: h }} aria-hidden="true" />;
}
