# AVIOUS site

## Replacing placeholder audio

Everything under `public/audio/` is generated placeholder audio (sine and noise sweeps).
Replace each file at the same path with the real one, then set `placeholder: false` on its
entry in `src/content/tracks.ts` (tracks) or `src/content/sounds.ts` (demo renders).

- `public/audio/tracks/placeholder-{1,2,3}.mp3`: portfolio tracks, any length.
- `public/audio/demo/placeholder-riser-{1,2,3}.mp3`: pre-rendered Premonition risers, about 3 seconds, ending on the downbeat.

Update the matching `id`, `title` and `label` fields when swapping in real material.
