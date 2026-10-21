'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './room.module.css';

// Film grain over the room: a small noise tile redrawn about 12 times a second
// and stretched over the viewport with hard pixels, plus a faint warm vignette.
// No post-processing pass, so it costs next to nothing. Under reduced motion the
// grain is drawn once and stays still. Without canvas support or matchMedia it
// renders nothing.

const TILE = 128; // noise tile edge, in pixels
const VIEW_W = 512; // the canvas is this big and scaled to the viewport by CSS
const VIEW_H = 288;
const FRAME_MS = 80; // about 12 fps

function noiseInto(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    // Warm grey grain: a random level, tinted toward brown, never reaching 255.
    const v = 40 + Math.random() * 190;
    data[i] = Math.min(250, v * 1.04);
    data[i + 1] = v * 0.94;
    data[i + 2] = v * 0.82;
    data[i + 3] = Math.random() * 255;
  }
}

export function FilmGrain({ intensity = 0.09 }: { intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [supported, setSupported] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function',
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setSupported(false);
      return;
    }
    const canvas = ref.current;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas?.getContext('2d') ?? null;
    } catch {
      ctx = null;
    }
    if (!canvas || !ctx) {
      setSupported(false);
      return;
    }
    const g = ctx;
    const tile = g.createImageData(TILE, TILE);
    const scratch = document.createElement('canvas');
    scratch.width = TILE;
    scratch.height = TILE;
    const tileCtx = scratch.getContext('2d') ?? g;

    function draw() {
      noiseInto(tile.data);
      tileCtx.putImageData(tile, 0, 0);
      const pattern = g.createPattern(scratch, 'repeat');
      if (!pattern) return;
      g.fillStyle = pattern;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    draw();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    let frame = 0;
    let last = performance.now();
    const tick = (t: number) => {
      if (t - last >= FRAME_MS) {
        last = t;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!supported) return null;
  return (
    <div className={styles.grain} aria-hidden="true" style={{ pointerEvents: 'none' }}>
      <canvas ref={ref} className={styles.grainCanvas} width={VIEW_W} height={VIEW_H} style={{ opacity: intensity }} />
    </div>
  );
}
