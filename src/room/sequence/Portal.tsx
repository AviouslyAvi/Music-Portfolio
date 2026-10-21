'use client';

import { useEffect, useRef, useState } from 'react';
import { dollyProgress, PORTAL_MS, PORTAL_REDUCED_MS } from './portalMath';
import styles from './portal.module.css';

const MIDNIGHT = '#0d1030';
const TERRACOTTA = '#c8623f';
const MUSTARD = '#d9a62b';
const STARS = 220;
const ARMS = 3;

type Star = { a: number; r: number; speed: number; hue: number };

function makeStars(): Star[] {
  let s = 11;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  return Array.from({ length: STARS }, () => ({ a: rnd() * Math.PI * 2, r: rnd(), speed: 0.25 + rnd() * 0.75, hue: rnd() }));
}

/**
 * The screen turns into a tunnel: stars streak toward the viewer, a spiral
 * turns in the AVIOUS autumn colours. onDone fires once at PORTAL_MS. Under
 * reduced motion it is a plain cross-fade with no animation frames.
 */
export function Portal({ onDone, reduced = false }: { onDone(): void; reduced?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [usable, setUsable] = useState(true);

  // The timer is separate from drawing so a missing canvas never traps the visitor.
  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), reduced ? PORTAL_REDUCED_MS : PORTAL_MS);
    return () => clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') ?? null;
    if (!canvas || !ctx) {
      setUsable(false);
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const stars = makeStars();
    let raf = 0;
    let t0 = -1;
    const frame = (now: number) => {
      if (t0 < 0) t0 = now;
      const t = Math.min(1, (now - t0) / PORTAL_MS);
      const k = dollyProgress(t);
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const reach = Math.hypot(cx, cy);

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = MIDNIGHT;
      ctx.globalAlpha = 0.25 + 0.2 * t;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      // The spiral: arms wind tighter and spin faster as the pull builds.
      ctx.lineWidth = Math.max(1, reach * (0.004 + 0.02 * k));
      ctx.lineCap = 'round';
      for (let arm = 0; arm < ARMS; arm++) {
        ctx.strokeStyle = arm % 2 ? MUSTARD : TERRACOTTA;
        ctx.globalAlpha = 0.35 + 0.4 * k;
        ctx.beginPath();
        const spin = (now / 1000) * (0.8 + 4 * k) + (arm * Math.PI * 2) / ARMS;
        for (let i = 0; i <= 60; i++) {
          const u = i / 60;
          const r = u * reach * (0.5 + 0.9 * k);
          const a = spin + u * (5 + 6 * k);
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Stars streak out from the vanishing point.
      ctx.globalAlpha = 1;
      for (const s of stars) {
        const prev = s.r;
        s.r += (0.004 + 0.06 * k) * s.speed;
        if (s.r > 1) s.r = 0.02 + (s.r % 1) * 0.1;
        const r0 = prev * prev * reach;
        const r1 = s.r * s.r * reach;
        ctx.strokeStyle = s.hue > 0.66 ? MUSTARD : s.hue > 0.33 ? TERRACOTTA : '#e8dcc4';
        ctx.lineWidth = 1 + s.r * 2.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(s.a) * r0, cy + Math.sin(s.a) * r0);
        ctx.lineTo(cx + Math.cos(s.a) * r1, cy + Math.sin(s.a) * r1);
        ctx.stroke();
      }

      // A warm bloom grows at the centre for the final pull.
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach * (0.15 + 0.7 * k));
      g.addColorStop(0, 'rgba(217, 166, 43, ' + (0.15 + 0.6 * k).toFixed(2) + ')');
      g.addColorStop(1, 'rgba(217, 166, 43, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [reduced]);

  if (reduced) return <div className={`${styles.portal} ${styles.fade}`} data-testid="portal" aria-hidden="true" />;
  if (!usable) return null;
  return (
    <div className={styles.portal} data-testid="portal" aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
