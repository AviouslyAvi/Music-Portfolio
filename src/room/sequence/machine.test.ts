import { describe, it, expect } from 'vitest';
import { initialSeq, seqReducer, shouldHoldRoomAudio, SOUND_COUNT, type SeqEvent, type SeqState, type Stage } from './machine';

const run = (events: SeqEvent[], from: SeqState = initialSeq) => events.reduce(seqReducer, from);
const toPlugin = (): SeqState =>
  run([{ type: 'INTERACT' }, { type: 'SEATED' }, { type: 'HEADPHONES_ON' }, { type: 'ENGINE_READY' }, { type: 'BOOT_DONE' }]);

describe('seqReducer', () => {
  it('INTERACT only works from walk', () => {
    const seating = seqReducer(initialSeq, { type: 'INTERACT' });
    expect(seating.stage).toBe('seating');
    expect(seqReducer(seating, { type: 'INTERACT' })).toBe(seating);
    const plugin = toPlugin();
    expect(seqReducer(plugin, { type: 'INTERACT' })).toBe(plugin);
  });

  it('the happy path walk -> seating -> headphones -> boot -> plugin', () => {
    const stages: Stage[] = [];
    let s = initialSeq;
    for (const e of [{ type: 'INTERACT' }, { type: 'SEATED' }, { type: 'HEADPHONES_ON' }, { type: 'ENGINE_READY' }, { type: 'BOOT_DONE' }] as SeqEvent[]) {
      s = seqReducer(s, e);
      stages.push(s.stage);
    }
    expect(stages).toEqual(['seating', 'headphones', 'boot', 'boot', 'plugin']);
  });

  it('BOOT_DONE is ignored until the engine is ready', () => {
    const boot = run([{ type: 'INTERACT' }, { type: 'SEATED' }, { type: 'HEADPHONES_ON' }]);
    expect(seqReducer(boot, { type: 'BOOT_DONE' })).toBe(boot);
    expect(run([{ type: 'ENGINE_READY' }, { type: 'BOOT_DONE' }], boot).stage).toBe('plugin');
  });

  it('two SOUND_PLAYED with distinct ids stays in plugin', () => {
    const s = run([{ type: 'SOUND_PLAYED', id: 'a' }, { type: 'SOUND_PLAYED', id: 'b' }], toPlugin());
    expect(s.stage).toBe('plugin');
    expect(s.heard.size).toBe(2);
  });

  it('the third distinct id moves to portal exactly once', () => {
    const two = run([{ type: 'SOUND_PLAYED', id: 'a' }, { type: 'SOUND_PLAYED', id: 'b' }], toPlugin());
    const portal = seqReducer(two, { type: 'SOUND_PLAYED', id: 'c' });
    expect(portal.stage).toBe('portal');
    expect(portal.heard.size).toBe(SOUND_COUNT);
    expect(seqReducer(portal, { type: 'SOUND_PLAYED', id: 'c' })).toBe(portal);
    expect(seqReducer(portal, { type: 'SOUND_PLAYED', id: 'a' })).toBe(portal);
  });

  it('a repeated id does not count twice', () => {
    const s = run(
      [{ type: 'SOUND_PLAYED', id: 'a' }, { type: 'SOUND_PLAYED', id: 'a' }, { type: 'SOUND_PLAYED', id: 'a' }],
      toPlugin(),
    );
    expect(s.stage).toBe('plugin');
    expect(s.heard.size).toBe(1);
  });

  it('SOUND_PLAYED outside plugin is ignored', () => {
    for (const events of [[], [{ type: 'INTERACT' }], [{ type: 'INTERACT' }, { type: 'SEATED' }]] as SeqEvent[][]) {
      const s = run(events);
      expect(seqReducer(s, { type: 'SOUND_PLAYED', id: 'a' })).toBe(s);
    }
  });

  it('ENGINE_FAILED blocks the portal and keeps Skip available', () => {
    const boot = run([{ type: 'INTERACT' }, { type: 'SEATED' }, { type: 'HEADPHONES_ON' }, { type: 'ENGINE_FAILED' }]);
    expect(boot.loadError).toBe(true);
    expect(seqReducer(boot, { type: 'BOOT_DONE' })).toBe(boot);
    // a failure arriving late, inside the plugin, still blocks the portal
    const failedLate = run(
      [{ type: 'ENGINE_FAILED' }, { type: 'SOUND_PLAYED', id: 'a' }, { type: 'SOUND_PLAYED', id: 'b' }, { type: 'SOUND_PLAYED', id: 'c' }],
      toPlugin(),
    );
    expect(failedLate.stage).not.toBe('portal');
    expect(seqReducer(boot, { type: 'SKIP' }).stage).toBe('leaving');
  });

  it('ESCAPE from seating, headphones, boot or plugin returns to walk and keeps the heard set', () => {
    const heard = run([{ type: 'SOUND_PLAYED', id: 'a' }], toPlugin());
    const prefixes: SeqEvent[][] = [
      [{ type: 'INTERACT' }],
      [{ type: 'INTERACT' }, { type: 'SEATED' }],
      [{ type: 'INTERACT' }, { type: 'SEATED' }, { type: 'HEADPHONES_ON' }],
    ];
    for (const p of prefixes) {
      const s = run([...p, { type: 'ESCAPE' }], { ...initialSeq, heard: heard.heard });
      expect(s.stage).toBe('walk');
      expect([...s.heard]).toEqual(['a']);
    }
    const out = seqReducer(heard, { type: 'ESCAPE' });
    expect(out.stage).toBe('walk');
    expect([...out.heard]).toEqual(['a']);
    expect(out.engineReady).toBe(false);
    expect(out.loadError).toBe(false);
  });

  it('ESCAPE does nothing in walk, portal or leaving', () => {
    expect(seqReducer(initialSeq, { type: 'ESCAPE' })).toBe(initialSeq);
    const portal = run(
      [{ type: 'SOUND_PLAYED', id: 'a' }, { type: 'SOUND_PLAYED', id: 'b' }, { type: 'SOUND_PLAYED', id: 'c' }],
      toPlugin(),
    );
    expect(seqReducer(portal, { type: 'ESCAPE' })).toBe(portal);
    const leaving = seqReducer(portal, { type: 'SKIP' });
    expect(seqReducer(leaving, { type: 'ESCAPE' })).toBe(leaving);
  });

  it('SKIP from any stage goes to leaving', () => {
    const stages: SeqState[] = [
      initialSeq,
      run([{ type: 'INTERACT' }]),
      run([{ type: 'INTERACT' }, { type: 'SEATED' }]),
      run([{ type: 'INTERACT' }, { type: 'SEATED' }, { type: 'HEADPHONES_ON' }]),
      toPlugin(),
      run([{ type: 'SOUND_PLAYED', id: 'a' }, { type: 'SOUND_PLAYED', id: 'b' }, { type: 'SOUND_PLAYED', id: 'c' }], toPlugin()),
    ];
    for (const s of stages) {
      const out = seqReducer(s, { type: 'SKIP' });
      expect(out.stage).toBe('leaving');
      expect(seqReducer(out, { type: 'SKIP' })).toBe(out);
    }
  });

  it('PORTAL_DONE moves to leaving, only from portal', () => {
    const portal = run(
      [{ type: 'SOUND_PLAYED', id: 'a' }, { type: 'SOUND_PLAYED', id: 'b' }, { type: 'SOUND_PLAYED', id: 'c' }],
      toPlugin(),
    );
    expect(seqReducer(portal, { type: 'PORTAL_DONE' }).stage).toBe('leaving');
    const plugin = toPlugin();
    expect(seqReducer(plugin, { type: 'PORTAL_DONE' })).toBe(plugin);
  });

  it('out-of-order events leave the state untouched', () => {
    expect(seqReducer(initialSeq, { type: 'SEATED' })).toBe(initialSeq);
    expect(seqReducer(initialSeq, { type: 'HEADPHONES_ON' })).toBe(initialSeq);
  });

  it('a new visit after escape resets the engine flags but keeps the heard set', () => {
    const s = run([{ type: 'SOUND_PLAYED', id: 'a' }, { type: 'ESCAPE' }, { type: 'INTERACT' }], toPlugin());
    expect(s.stage).toBe('seating');
    expect(s.engineReady).toBe(false);
    expect([...s.heard]).toEqual(['a']);
  });
});

describe('shouldHoldRoomAudio', () => {
  it('is true for seating through portal and false for walk and leaving', () => {
    const hold: Stage[] = ['seating', 'headphones', 'boot', 'plugin', 'portal'];
    for (const st of hold) expect(shouldHoldRoomAudio(st)).toBe(true);
    for (const st of ['walk', 'leaving'] as Stage[]) expect(shouldHoldRoomAudio(st)).toBe(false);
  });
});
