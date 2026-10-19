'use client';

import { useCallback, useEffect, useRef } from 'react';

type Active = { audio: HTMLAudioElement; fail: (reason: Error) => void; cleanup: () => void };

// Plays one pre-rendered file at a time. play() resolves when the file ends
// and rejects on load error, abort (stop), or autoplay refusal.
export function useRenderedAudio(): { play(src: string): Promise<void>; stop(): void } {
  const active = useRef<Active | null>(null);

  const stop = useCallback(() => {
    const a = active.current;
    if (!a) return;
    active.current = null;
    a.cleanup();
    try {
      a.audio.pause();
      a.audio.currentTime = 0;
    } catch {
      // ignore
    }
    a.fail(new Error('aborted'));
  }, []);

  const play = useCallback(
    (src: string) => {
      stop();
      return new Promise<void>((resolve, reject) => {
        let audio: HTMLAudioElement;
        try {
          audio = new Audio(src);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('audio unavailable'));
          return;
        }
        const onEnded = () => {
          if (active.current?.audio === audio) active.current = null;
          cleanup();
          resolve();
        };
        const onError = () => {
          if (active.current?.audio === audio) active.current = null;
          cleanup();
          reject(new Error('audio error'));
        };
        const cleanup = () => {
          audio.removeEventListener('ended', onEnded);
          audio.removeEventListener('error', onError);
          audio.removeEventListener('abort', onError);
        };
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);
        audio.addEventListener('abort', onError);
        active.current = { audio, fail: reject, cleanup };
        audio.preload = 'auto';
        Promise.resolve(audio.play()).catch((err: unknown) => {
          if (active.current?.audio === audio) active.current = null;
          cleanup();
          reject(err instanceof Error ? err : new Error('playback refused'));
        });
      });
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { play, stop };
}
