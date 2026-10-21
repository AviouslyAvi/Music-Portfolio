'use client';

// Stand-in for Part B's PluginScreen: same props, three buttons, no audio.
import { useEffect, useRef } from 'react';
import type { DrySource } from './stubRoom';

export type PluginScreenProps = {
  sources: readonly DrySource[];
  playedIds: ReadonlySet<string>;
  onSoundPlayed(id: string): void;
  onReady?(): void;
  onLoadError?(reason: string): void;
  onClose?(): void;
};

const READY_MS = 500;
const PLAY_MS = 300;

export function StubPluginScreen({ sources, playedIds, onSoundPlayed, onReady }: PluginScreenProps) {
  const ready = useRef(onReady);
  ready.current = onReady;
  const played = useRef(onSoundPlayed);
  played.current = onSoundPlayed;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const t = setTimeout(() => ready.current?.(), READY_MS);
    const pending = timers.current;
    return () => {
      clearTimeout(t);
      pending.forEach(clearTimeout);
    };
  }, []);

  return (
    <div data-testid="plugin-screen">
      {sources.map((s) => (
        <button
          key={s.id}
          type="button"
          data-played={String(playedIds.has(s.id))}
          style={{ opacity: playedIds.has(s.id) ? 0.5 : 1 }}
          onClick={() => timers.current.push(setTimeout(() => played.current(s.id), PLAY_MS))}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
