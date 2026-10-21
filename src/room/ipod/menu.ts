// Pure state machine for the click-wheel iPod. The component feeds it wheel,
// button and key events; it returns the next state and, when something outside
// the iPod has to happen (play a song, change volume, leave), an action.

export type PageId = 'services' | 'about' | 'contact';

export type IpodScreenId = { kind: 'menu' } | { kind: 'music' } | { kind: 'now' } | { kind: 'page'; id: PageId };

export type IpodState = {
  /** Bottom is always the menu; the last entry is on screen. */
  stack: IpodScreenId[];
  /** Highlighted row of the screen on top (menu entries or songs); 0 on other screens. */
  cursor: number;
  /** The menu row to return to when going back to the menu. */
  menuCursor: number;
};

export type IpodEvent =
  | { type: 'SCROLL'; delta: number }
  | { type: 'SELECT' }
  | { type: 'BACK' }
  | { type: 'PREV' }
  | { type: 'NEXT' }
  | { type: 'PLAY_PAUSE' };

export type IpodAction =
  | { type: 'select-track'; trackIndex: number }
  | { type: 'toggle-play' }
  | { type: 'step'; dir: 1 | -1 }
  | { type: 'volume'; delta: number }
  | { type: 'computer' }
  | { type: 'leave' }
  | { type: 'link'; href: string }
  | { type: 'close' };

export const IPOD_MENU = ['Now Playing', 'Music', 'Services', 'About', 'Contact', 'Computer', 'Leave the room'] as const;

const PAGE_ROWS: Record<number, PageId> = { 2: 'services', 3: 'about', 4: 'contact' };
const PAGE_HREF: Record<PageId, string> = { services: '/services', about: '/about', contact: '/contact' };

export type IpodContext = { trackCount: number; currentIndex: number };

export function initialIpodState(): IpodState {
  return { stack: [{ kind: 'menu' }, { kind: 'now' }], cursor: 0, menuCursor: 0 };
}

export function topScreen(s: IpodState): IpodScreenId {
  return s.stack[s.stack.length - 1];
}

const wrap = (n: number, size: number) => (size <= 0 ? 0 : ((n % size) + size) % size);

type Result = { state: IpodState; action: IpodAction | null };

export function ipodReducer(s: IpodState, e: IpodEvent, ctx: IpodContext): Result {
  const top = topScreen(s);
  switch (e.type) {
    case 'PREV':
      return { state: s, action: { type: 'step', dir: -1 } };
    case 'NEXT':
      return { state: s, action: { type: 'step', dir: 1 } };
    case 'PLAY_PAUSE':
      return { state: s, action: { type: 'toggle-play' } };

    case 'SCROLL': {
      if (top.kind === 'now') return { state: s, action: { type: 'volume', delta: e.delta } };
      if (top.kind === 'menu') return { state: { ...s, cursor: wrap(s.cursor + e.delta, IPOD_MENU.length) }, action: null };
      if (top.kind === 'music') return { state: { ...s, cursor: wrap(s.cursor + e.delta, ctx.trackCount) }, action: null };
      return { state: s, action: null };
    }

    case 'BACK': {
      if (s.stack.length <= 1) return { state: s, action: { type: 'close' } };
      return { state: { stack: s.stack.slice(0, -1), cursor: s.menuCursor, menuCursor: s.menuCursor }, action: null };
    }

    case 'SELECT': {
      if (top.kind === 'now') return { state: s, action: { type: 'toggle-play' } };
      if (top.kind === 'page') return { state: s, action: { type: 'link', href: PAGE_HREF[top.id] } };
      if (top.kind === 'music') {
        if (ctx.trackCount <= 0) return { state: s, action: null };
        return {
          state: { stack: [{ kind: 'menu' }, { kind: 'now' }], cursor: 0, menuCursor: s.menuCursor },
          action: { type: 'select-track', trackIndex: s.cursor },
        };
      }
      // menu
      const row = s.cursor;
      const keep = { menuCursor: row };
      if (row === 0) return { state: { stack: [...s.stack, { kind: 'now' }], cursor: 0, ...keep }, action: null };
      if (row === 1) {
        const start = ctx.trackCount > 0 ? wrap(ctx.currentIndex, ctx.trackCount) : 0;
        return { state: { stack: [...s.stack, { kind: 'music' }], cursor: start, ...keep }, action: null };
      }
      const page = PAGE_ROWS[row];
      if (page) return { state: { stack: [...s.stack, { kind: 'page', id: page }], cursor: 0, ...keep }, action: null };
      if (row === 5) return { state: s, action: { type: 'computer' } };
      return { state: s, action: { type: 'leave' } };
    }
  }
}
