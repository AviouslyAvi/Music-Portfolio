// The visit as a pure state machine: no timers, no DOM, no three.js. The room
// loop feeds it events; it decides the stage and when the portal fires.
export type Stage = 'walk' | 'seating' | 'headphones' | 'boot' | 'plugin' | 'portal' | 'leaving';

export type SeqState = {
  stage: Stage;
  /** Ids of sounds heard to their natural end. Lives in memory only. */
  heard: ReadonlySet<string>;
  engineReady: boolean;
  loadError: boolean;
};

export type SeqEvent =
  | { type: 'INTERACT' } // E or click at the computer
  | { type: 'SEATED' } // the ease finished
  | { type: 'HEADPHONES_ON' }
  | { type: 'ENGINE_READY' }
  | { type: 'ENGINE_FAILED' }
  | { type: 'BOOT_DONE' } // terminal finished and engine ready
  | { type: 'SOUND_PLAYED'; id: string }
  | { type: 'ESCAPE' }
  | { type: 'PORTAL_DONE' }
  | { type: 'SKIP' };

export const SOUND_COUNT = 3;

export const initialSeq: SeqState = { stage: 'walk', heard: new Set(), engineReady: false, loadError: false };

const SEATED_STAGES: readonly Stage[] = ['seating', 'headphones', 'boot', 'plugin'];

export function seqReducer(s: SeqState, e: SeqEvent): SeqState {
  switch (e.type) {
    case 'INTERACT':
      // Loading starts here, so a new visit begins with a clean engine state.
      return s.stage === 'walk' ? { ...s, stage: 'seating', engineReady: false, loadError: false } : s;
    case 'SEATED':
      return s.stage === 'seating' ? { ...s, stage: 'headphones' } : s;
    case 'HEADPHONES_ON':
      return s.stage === 'headphones' ? { ...s, stage: 'boot' } : s;
    case 'ENGINE_READY':
      return s.engineReady || s.stage === 'walk' || s.stage === 'leaving' ? s : { ...s, engineReady: true };
    case 'ENGINE_FAILED':
      return s.loadError || s.stage === 'walk' || s.stage === 'leaving' ? s : { ...s, loadError: true };
    case 'BOOT_DONE':
      return s.stage === 'boot' && s.engineReady && !s.loadError ? { ...s, stage: 'plugin' } : s;
    case 'SOUND_PLAYED': {
      if (s.stage !== 'plugin' || s.heard.has(e.id)) return s;
      const heard = new Set(s.heard).add(e.id);
      const done = heard.size >= SOUND_COUNT && !s.loadError;
      return { ...s, heard, stage: done ? 'portal' : 'plugin' };
    }
    case 'ESCAPE':
      return SEATED_STAGES.includes(s.stage) ? { ...s, stage: 'walk', engineReady: false, loadError: false } : s;
    case 'PORTAL_DONE':
      return s.stage === 'portal' ? { ...s, stage: 'leaving' } : s;
    case 'SKIP':
      return s.stage === 'leaving' ? s : { ...s, stage: 'leaving' };
  }
}

/** The room's music is held from the start of seating until the visitor stands or leaves. */
export function shouldHoldRoomAudio(stage: Stage): boolean {
  return stage !== 'walk' && stage !== 'leaving';
}
