import { describe, it, expect } from 'vitest';
import { demoReducer, initialDemoState, type DemoState, type DemoPhase } from './machine';

const at = (phase: DemoPhase, extra: Partial<DemoState> = {}): DemoState => ({ ...initialDemoState, phase, ...extra });

describe('demoReducer', () => {
  it('starts idle', () => {
    expect(initialDemoState).toEqual({ phase: 'idle', soundId: null, audioError: false });
  });
  it('POWER_ON only from idle', () => {
    expect(demoReducer(at('idle'), { type: 'POWER_ON' }).phase).toBe('booting');
    for (const p of ['booting', 'ready', 'playing', 'done', 'skipped'] as DemoPhase[]) {
      const s = at(p);
      expect(demoReducer(s, { type: 'POWER_ON' })).toBe(s);
    }
  });
  it('BOOT_DONE only from booting', () => {
    expect(demoReducer(at('booting'), { type: 'BOOT_DONE' }).phase).toBe('ready');
    for (const p of ['idle', 'ready', 'playing', 'done', 'skipped'] as DemoPhase[]) {
      const s = at(p);
      expect(demoReducer(s, { type: 'BOOT_DONE' })).toBe(s);
    }
  });
  it('PICK from ready or done starts playing and clears the error', () => {
    for (const p of ['ready', 'done'] as DemoPhase[]) {
      const next = demoReducer(at(p, { audioError: true }), { type: 'PICK', soundId: 'sound-2' });
      expect(next).toEqual({ phase: 'playing', soundId: 'sound-2', audioError: false });
    }
  });
  it('PICK while playing is ignored', () => {
    const s = at('playing', { soundId: 'sound-1' });
    expect(demoReducer(s, { type: 'PICK', soundId: 'sound-2' })).toBe(s);
  });
  it('PICK is ignored from idle, booting and skipped', () => {
    for (const p of ['idle', 'booting', 'skipped'] as DemoPhase[]) {
      const s = at(p);
      expect(demoReducer(s, { type: 'PICK', soundId: 'sound-1' })).toBe(s);
    }
  });
  it('ENDED playing -> done', () => {
    const next = demoReducer(at('playing', { soundId: 'sound-1' }), { type: 'ENDED' });
    expect(next).toEqual({ phase: 'done', soundId: 'sound-1', audioError: false });
  });
  it('ENDED failed -> done with audioError', () => {
    const next = demoReducer(at('playing', { soundId: 'sound-1' }), { type: 'ENDED', failed: true });
    expect(next.phase).toBe('done');
    expect(next.audioError).toBe(true);
  });
  it('ENDED outside playing is ignored', () => {
    for (const p of ['idle', 'booting', 'ready', 'done', 'skipped'] as DemoPhase[]) {
      const s = at(p);
      expect(demoReducer(s, { type: 'ENDED' })).toBe(s);
    }
  });
  it('SKIP from any phase except skipped', () => {
    for (const p of ['idle', 'booting', 'ready', 'playing', 'done'] as DemoPhase[]) {
      expect(demoReducer(at(p), { type: 'SKIP' }).phase).toBe('skipped');
    }
    const s = at('skipped');
    expect(demoReducer(s, { type: 'SKIP' })).toBe(s);
  });
});
