import { describe, expect, it } from 'vitest';
import { IPOD_MENU, initialIpodState, ipodReducer, topScreen, type IpodState } from './menu';

const ctx = { trackCount: 19, currentIndex: 3 };
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

  it('lists the entries in order', () => {
    expect(IPOD_MENU).toEqual(['Now Playing', 'Music', 'Services', 'About', 'Contact', 'Computer', 'Leave the room']);
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

  it('BACK from Now Playing shows the menu; BACK at the menu closes', () => {
    const menu = run(initialIpodState(), { type: 'BACK' });
    expect(topScreen(menu.state)).toEqual({ kind: 'menu' });
    expect(menu.action).toBeNull();
    expect(run(menu.state, { type: 'BACK' }).action).toEqual({ type: 'close' });
  });

  it('SCROLL wraps through the menu entries', () => {
    const menu = run(initialIpodState(), { type: 'BACK' }).state;
    expect(run(menu, { type: 'SCROLL', delta: -1 }).state.cursor).toBe(IPOD_MENU.length - 1);
    expect(run(menu, { type: 'SCROLL', delta: IPOD_MENU.length + 2 }).state.cursor).toBe(2);
  });

  it('Music lists the songs with the playing one selected, and SELECT plays it and shows Now Playing', () => {
    const music = run(initialIpodState(), { type: 'BACK' }, { type: 'SCROLL', delta: 1 }, { type: 'SELECT' });
    expect(topScreen(music.state)).toEqual({ kind: 'music' });
    expect(music.state.cursor).toBe(ctx.currentIndex);
    const scrolled = run(music.state, { type: 'SCROLL', delta: 2 });
    expect(scrolled.state.cursor).toBe(5);
    const picked = run(scrolled.state, { type: 'SELECT' });
    expect(picked.action).toEqual({ type: 'select-track', trackIndex: 5 });
    expect(topScreen(picked.state)).toEqual({ kind: 'now' });
  });

  it('Music scroll wraps around the track count', () => {
    const music = run(initialIpodState(), { type: 'BACK' }, { type: 'SCROLL', delta: 1 }, { type: 'SELECT' });
    expect(run(music.state, { type: 'SCROLL', delta: 16 }).state.cursor).toBe(0);
    expect(run(music.state, { type: 'SCROLL', delta: -4 }).state.cursor).toBe(18);
  });

  it('Services, About and Contact open a page whose SELECT links to the full page', () => {
    const base = run(initialIpodState(), { type: 'BACK' }).state;
    const services = run(base, { type: 'SCROLL', delta: 2 }, { type: 'SELECT' });
    expect(topScreen(services.state)).toEqual({ kind: 'page', id: 'services' });
    expect(run(services.state, { type: 'SELECT' }).action).toEqual({ type: 'link', href: '/services' });
    const about = run(base, { type: 'SCROLL', delta: 3 }, { type: 'SELECT' });
    expect(run(about.state, { type: 'SELECT' }).action).toEqual({ type: 'link', href: '/about' });
    const contact = run(base, { type: 'SCROLL', delta: 4 }, { type: 'SELECT' });
    expect(run(contact.state, { type: 'SELECT' }).action).toEqual({ type: 'link', href: '/contact' });
  });

  it('Computer and Leave the room return their actions', () => {
    const base = run(initialIpodState(), { type: 'BACK' }).state;
    expect(run(base, { type: 'SCROLL', delta: 5 }, { type: 'SELECT' }).action).toEqual({ type: 'computer' });
    expect(run(base, { type: 'SCROLL', delta: 6 }, { type: 'SELECT' }).action).toEqual({ type: 'leave' });
  });

  it('BACK from a page returns to the menu with the cursor on that entry', () => {
    const base = run(initialIpodState(), { type: 'BACK' }).state;
    const back = run(base, { type: 'SCROLL', delta: 3 }, { type: 'SELECT' }, { type: 'BACK' });
    expect(topScreen(back.state)).toEqual({ kind: 'menu' });
    expect(back.state.cursor).toBe(3);
  });

  it('handles a zero track count without throwing', () => {
    const s = run(initialIpodState(), { type: 'BACK' }, { type: 'SCROLL', delta: 1 }, { type: 'SELECT' }).state;
    const { state, action } = ipodReducer(s, { type: 'SCROLL', delta: 3 }, { trackCount: 0, currentIndex: 0 });
    expect(state.cursor).toBe(0);
    expect(action).toBeNull();
    expect(ipodReducer(s, { type: 'SELECT' }, { trackCount: 0, currentIndex: 0 }).action).toBeNull();
  });
});
