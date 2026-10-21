export type DrySource = { id: string; label: string; src: string; placeholder: boolean };

// Placeholders synthesised by scripts/make-placeholder-sources.mjs until the owner supplies the dry hits.
export const SOURCES: readonly [DrySource, DrySource, DrySource] = [
  { id: 'snare', label: 'Snare (placeholder)', src: '/audio/premonition/placeholder-snare.mp3', placeholder: true },
  { id: 'pluck', label: 'Pluck (placeholder)', src: '/audio/premonition/placeholder-pluck.mp3', placeholder: true },
  { id: 'vocal', label: 'Vocal (placeholder)', src: '/audio/premonition/placeholder-vocal.mp3', placeholder: true },
];
