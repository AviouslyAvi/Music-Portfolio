export type Track = { id: string; title: string; src: string; placeholder: boolean };

// Placeholder audio: replace each file at the same path and flip placeholder to false.
export const TRACKS: Track[] = [
  { id: 'track-1', title: 'Placeholder Track One', src: '/audio/tracks/placeholder-1.mp3', placeholder: true },
  { id: 'track-2', title: 'Placeholder Track Two', src: '/audio/tracks/placeholder-2.mp3', placeholder: true },
  { id: 'track-3', title: 'Placeholder Track Three', src: '/audio/tracks/placeholder-3.mp3', placeholder: true },
];
