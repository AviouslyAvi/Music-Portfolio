'use client';

import { useRef } from 'react';
import type { Track } from '@/content/tracks';

export function TrackList({ tracks }: { tracks: Track[] }) {
  const refs = useRef<Array<HTMLAudioElement | null>>([]);

  // Only one track plays at a time: when one starts, pause every other.
  const onPlay = (index: number) => {
    refs.current.forEach((el, i) => {
      if (el && i !== index && !el.paused) el.pause();
    });
  };

  return (
    <ul className="track-list">
      {tracks.map((t, i) => (
        <li key={t.id} className="track-row">
          <h2 className="track-title" id={`${t.id}-title`}>
            {t.title}
          </h2>
          <audio
            ref={(el) => {
              refs.current[i] = el;
            }}
            controls
            preload="none"
            src={t.src}
            aria-labelledby={`${t.id}-title`}
            onPlay={() => onPlay(i)}
          />
        </li>
      ))}
    </ul>
  );
}
