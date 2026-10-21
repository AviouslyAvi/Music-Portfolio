import type { Track } from './tracks';

// Avi's voice memos, played from the iPod's Voice Memos menu. Add one per file in
// public/audio/memos/<id>.mp3, for example
//   { id: 'idea-1', title: 'Idea 1', src: '/audio/memos/idea-1.mp3', placeholder: false }
// None are supplied yet, so the menu shows an empty list.
export const VOICE_MEMOS: Track[] = [];
