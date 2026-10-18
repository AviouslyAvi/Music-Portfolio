export type DemoSound = { id: string; label: string; rendered: string; placeholder: boolean };

// Pre-rendered risers, about 3 seconds, ending on the downbeat.
// Placeholder audio: replace each file at the same path and flip placeholder to false.
export const SOUNDS: DemoSound[] = [
  { id: 'sound-1', label: 'Rising Pad', rendered: '/audio/demo/placeholder-riser-1.mp3', placeholder: true },
  { id: 'sound-2', label: 'Noise Sweep', rendered: '/audio/demo/placeholder-riser-2.mp3', placeholder: true },
  { id: 'sound-3', label: 'Tension Lift', rendered: '/audio/demo/placeholder-riser-3.mp3', placeholder: true },
];
