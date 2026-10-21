'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RenderResult } from './engine/types';

type Playing = { source: AudioBufferSourceNode; token: number };

// Plays a render in stereo on the plugin's OWN AudioContext, straight to its destination (no room, no panner).
// The context is created inside the first play() call, which the caller makes from a click.
export function usePreview(): {
  play(result: RenderResult, onEnded: () => void): Promise<void>;
  stop(): void;
  playing: boolean;
  progress: number;
} {
  const ctxRef = useRef<AudioContext | null>(null);
  const current = useRef<Playing | null>(null);
  const tokenRef = useRef(0);
  const raf = useRef(0);
  const alive = useRef(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const halt = useCallback(() => {
    tokenRef.current++;
    if (raf.current && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf.current);
    raf.current = 0;
    const c = current.current;
    current.current = null;
    if (c) {
      c.source.onended = null;
      try {
        c.source.stop();
      } catch {
        // already stopped
      }
      try {
        c.source.disconnect();
      } catch {
        // not connected
      }
    }
  }, []);

  const stop = useCallback(() => {
    halt();
    if (alive.current) {
      setPlaying(false);
      setProgress(0);
    }
  }, [halt]);

  const play = useCallback(
    async (result: RenderResult, onEnded: () => void) => {
      halt();
      const token = tokenRef.current;
      const frames = result.channels[0]?.length ?? 0;
      if (frames === 0) return;
      if (!ctxRef.current) {
        try {
          ctxRef.current = new AudioContext({ sampleRate: result.sampleRate });
        } catch {
          ctxRef.current = new AudioContext();
        }
      }
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      if (token !== tokenRef.current || !alive.current) return;

      const buffer = ctx.createBuffer(2, frames, result.sampleRate);
      buffer.getChannelData(0).set(result.channels[0]);
      buffer.getChannelData(1).set(result.channels[1] ?? result.channels[0]);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const startedAt = ctx.currentTime;
      source.onended = () => {
        if (token !== tokenRef.current) return;
        halt();
        if (alive.current) {
          setPlaying(false);
          setProgress(1);
        }
        onEnded();
      };
      current.current = { source, token };
      source.start();
      setPlaying(true);
      setProgress(0);

      if (typeof requestAnimationFrame === 'function') {
        const tick = () => {
          if (token !== tokenRef.current) return;
          setProgress(Math.min(1, (ctx.currentTime - startedAt) / buffer.duration));
          raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      }
    },
    [halt],
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      halt();
      const ctx = ctxRef.current;
      ctxRef.current = null;
      if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
    };
  }, [halt]);

  return { play, stop, playing, progress };
}
