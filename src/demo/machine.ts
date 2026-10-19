export type DemoPhase = 'idle' | 'booting' | 'ready' | 'playing' | 'done' | 'skipped';
export type DemoState = { phase: DemoPhase; soundId: string | null; audioError: boolean };
export type DemoEvent =
  | { type: 'POWER_ON' }
  | { type: 'BOOT_DONE' }
  | { type: 'PICK'; soundId: string }
  | { type: 'ENDED'; failed?: boolean }
  | { type: 'SKIP' };

export const initialDemoState: DemoState = { phase: 'idle', soundId: null, audioError: false };

// Pure transitions. Anything not listed returns the same state object.
export function demoReducer(s: DemoState, e: DemoEvent): DemoState {
  switch (e.type) {
    case 'POWER_ON':
      return s.phase === 'idle' ? { ...s, phase: 'booting' } : s;
    case 'BOOT_DONE':
      return s.phase === 'booting' ? { ...s, phase: 'ready' } : s;
    case 'PICK':
      return s.phase === 'ready' || s.phase === 'done'
        ? { phase: 'playing', soundId: e.soundId, audioError: false }
        : s;
    case 'ENDED':
      return s.phase === 'playing' ? { ...s, phase: 'done', audioError: e.failed === true } : s;
    case 'SKIP':
      return s.phase === 'skipped' ? s : { ...s, phase: 'skipped' };
  }
}
