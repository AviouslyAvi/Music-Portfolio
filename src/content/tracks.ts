export type Track = { id: string; title: string; src: string; placeholder: boolean };

// Avi's own songs, transcoded to 128 kbps stereo mp3 from the masters in
// "My Drive/Audio/All Songs" (see docs/superpowers/specs, owner approved all
// of these for the room on 2026-10-20). The file names are the dated working
// titles; rename a title here whenever a song gets its final name.
const T = (id: string, title: string): Track => ({
  id,
  title,
  src: `/audio/tracks/${id}.mp3`,
  placeholder: false,
});

export const TRACKS: Track[] = [
  T('space', 'Space'),
  T('park-scene', 'Park Scene'),
  T('tarry', 'Tarry (15 min cook)'),
  T('open', 'Open'),
  T('cfa', 'CFA'),
  T('milking-sine', 'Milking + Sine'),
  T('mkkaygeez', 'MkkayGeez'),
  T('mildbutsober', 'Mildbutsober'),
  T('zxcv', 'zxcv (beat only)'),
  T('bouncer', 'Bouncer (early)'),
  T('closer-flip', 'Closer (flip)'),
  T('guitar-drone', 'Random Guitar Drone'),
  T('lmlilu', 'LMLILU'),
  T('shimmy', 'Shimmy (ID)'),
  T('sunday-feeling', 'Sunday Feeling (unmixed, unfinished)'),
  T('at-least', 'At Least'),
  T('memories', 'Memories'),
  T('atmos-guitar', 'Atmos Guitar'),
  T('keeth-learning', 'Keeth Learning'),
];
