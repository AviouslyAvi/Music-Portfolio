import { describe, expect, it } from 'vitest';
import { IPOD_MENU, initialIpodState, ipodReducer, topScreen, type IpodState } from './menu';

const ctx = { trackCount: 19, memoCount: 3, currentIndex: 3 };
const run = (s: IpodState, ...events: Parameters<typeof ipodReducer>[1][]) => {
  let state = s;
  let action = null as ReturnType<typeof ipodReducer>['action'];
  for (const e of events) ({ state, action } = ipodReducer(state, e, ctx));
  return { state, action };
};

describe('ipod menu model', () => {
  it('opens on Now Playing with the menu underneath', () => {
    const s = initialIpodState();
    expect(topScreen(s)).toEqual({ kind: 'now' });
    expect(s.stack[0]).toEqual({ kind: 'menu' });
  });

  it('has only songs and voice memos in the menu', () => {
    expect(IPOD_MENU).toEqual(['Songs', 'Voice Memos']);
  });

  it('on Now Playing, SCROLL changes the volume and keeps the screen', () => {
    const { state, action } = run(initialIpodState(), { type: 'SCROLL', delta: 2 });
    expect(action).toEqual({ type: 'volume', delta: 2 });
    expect(topScreen(state)).toEqual({ kind: 'now' });
    expect(run(initialIpodState(), { type: 'SCROLL', delta: -1 }).action).toEqual({ type: 'volume', delta: -1 });
  });

  it('SELECT on Now Playing toggles play and pause', () => {
    expect(run(initialIpodState(), { type: 'SELECT' }).action).toEqual({ type: 'toggle-play' });
  });

  it('PREV, NEXT and PLAY_PAUSE are physical buttons that work on every screen', () => {
    const s = run(initialIpodState(), { type: 'BACK' }).state; // the menu
    expect(run(s, { type: 'PREV' }).action).toEqual({ type: 'step', dir: -1 });
    expect(run(s, { type: 'NEXT' }).action).toEqual({ type: 'step', dir: 1 });
    expect(run(s, { type: 'PLAY_PAUSE' }).action).toEqual({ type: 'toggle-play' });
  });

  it('CLOSE (Escape) puts the iPod down from every screen', () => {
    const base = initialIpodState();
    const songs = run(base, { type: 'BACK' }, { type: 'SELECT' }).state;
    const memos = run(base, { type: 'BACK' }, { type: 'SCROLL', delta: 1 }, { type: 'SELECT' }).state;
    for (const s of [base, run(base, { type: 'BACK' }).state, songs, memos]) {
      expect(run(s, { type: 'CLOSE' }).action).toEqual({ type: 'close' });
    }
  });

  it('BACK from Now Playing shows the menu; BACK at the menu closes', () => {
    const menu = run(initialIpodState(), { type: 'BACK' });
    expect(topScreen(menu.state)).toEqual({ kind: 'menu' });
    expect(menu.action).toBeNull();
    expect(run(menu.state, { type: 'BACK' }).action).toEqual({ type: 'close' });
  });

  it('SCROLL wraps through the two menu entries', () => {
    const menu = run(initialIpodState(), { type: 'BACK' }).state;
    expect(run(menu, { type: 'SCROLL', delta: -1 }).state.cursor).toBe(1);
    expect(run(menu, { type: 'SCROLL', delta: 3 }).state.cursor).toBe(1);
  });

  it('Songs lists the songs with the playing one selected, and SELECT plays it and shows Now Playing', () => {
    const music = run(initialIpodState(), { type: 'BACK' }, { type: 'SELECT' });
    expect(topScreen(music.state)).toEqual({ kind: 'music' });
    expect(music.state.cursor).toBe(ctx.currentIndex);
    const scrolled = run(music.state, { type: 'SCROLL', delta: 2 });
    expect(scrolled.state.cursor).toBe(5);
    const picked = run(scrolled.state, { type: 'SELECT' });
    expect(picked.action).toEqual({ type: 'select-track', trackIndex: 5 });
    expect(topScreen(picked.state)).toEqual({ kind: 'now' });
  });

  it('Songs scroll wraps around the track count', () => {
    const music = run(initialIpodState(), { type: 'BACK' }, { type: 'SELECT' });
    expect(run(music.state, { type: 'SCROLL', delta: 16 }).state.cursor).toBe(0);
    expect(run(music.state, { type: 'SCROLL', delta: -4 }).state.cursor).toBe(18);
  });

  it('Voice Memos plays memo i as track trackCount + i', () => {
    const memos = run(initialIpodState(), { type: 'BACK' }, { type: 'SCROLL', delta: 1 }, { type: 'SELECT' });
    expect(topScreen(memos.state)).toEqual({ kind: 'voice' });
    expect(memos.state.cursor).toBe(0);
    const picked = run(memos.state, { type: 'SCROLL', delta: 2 }, { type: 'SELECT' });
    expect(picked.action).toEqual({ type: 'select-track', trackIndex: 21 });
    expect(topScreen(picked.state)).toEqual({ kind: 'now' });
    expect(run(memos.state, { type: 'SCROLL', delta: 4 }).state.cursor).toBe(1);
  });

  it('BACK from a list returns to the menu with the cursor on that entry', () => {
    const back = run(initialIpodState(), { type: 'BACK' }, { type: 'SCROLL', delta: 1 }, { type: 'SELECT' }, { type: 'BACK' });
    expect(topScreen(back.state)).toEqual({ kind: 'menu' });
    expect(back.state.cursor).toBe(1);
  });

  it('handles no songs and no memos without throwing', () => {
    const empty = { trackCount: 0, memoCount: 0, currentIndex: 0 };
    const songs = run(initialIpodState(), { type: 'BACK' }, { type: 'SELECT' }).state;
    expect(ipodReducer(songs, { type: 'SCROLL', delta: 3 }, empty).state.cursor).toBe(0);
    expect(ipodReducer(songs, { type: 'SELECT' }, empty).action).toBeNull();
    const memos = run(initialIpodState(), { type: 'BACK' }, { type: 'SCROLL', delta: 1 }, { type: 'SELECT' }).state;
    expect(ipodReducer(memos, { type: 'SCROLL', delta: 3 }, empty).state.cursor).toBe(0);
    expect(ipodReducer(memos, { type: 'SELECT' }, empty).action).toBeNull();
  });
});
