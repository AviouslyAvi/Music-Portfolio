// Pure state machine for the click-wheel iPod. The component feeds it wheel,
// button and key events; it returns the next state and, when something outside
// the iPod has to happen (play a song, change volume, put it down), an action.
// The menu has two rows: the songs and the voice memos.

export type IpodScreenId = { kind: 'menu' } | { kind: 'music' } | { kind: 'voice' } | { kind: 'now' };

export type IpodState = {
  /** Bottom is always the menu; the last entry is on screen. */
  stack: IpodScreenId[];
  /** Highlighted row of the screen on top (menu entries, songs or memos); 0 on Now Playing. */
  cursor: number;
  /** The menu row to return to when going back to the menu. */
  menuCursor: number;
};

export type IpodEvent =
  | { type: 'SCROLL'; delta: number }
  | { type: 'SELECT' }
  | { type: 'BACK' }
  | { type: 'CLOSE' }
  | { type: 'PREV' }
  | { type: 'NEXT' }
  | { type: 'PLAY_PAUSE' };

export type IpodAction =
  | { type: 'select-track'; trackIndex: number }
  | { type: 'toggle-play' }
  | { type: 'step'; dir: 1 | -1 }
  | { type: 'volume'; delta: number }
  | { type: 'seek'; fraction: number }
  | { type: 'close' };

export const IPOD_MENU = ['Songs', 'Voice Memos'] as const;

/**
 * trackCount is the number of songs; voice memos follow them in the player's list,
 * so memo i is track trackCount + i.
 */
export type IpodContext = { trackCount: number; memoCount?: number; currentIndex: number };

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
  const memos = ctx.memoCount ?? 0;
  switch (e.type) {
    case 'PREV':
      return { state: s, action: { type: 'step', dir: -1 } };
    case 'NEXT':
      return { state: s, action: { type: 'step', dir: 1 } };
    case 'PLAY_PAUSE':
      return { state: s, action: { type: 'toggle-play' } };
    case 'CLOSE':
      return { state: s, action: { type: 'close' } };

    case 'SCROLL': {
      if (top.kind === 'now') return { state: s, action: { type: 'volume', delta: e.delta } };
      if (top.kind === 'menu') return { state: { ...s, cursor: wrap(s.cursor + e.delta, IPOD_MENU.length) }, action: null };
      if (top.kind === 'music') return { state: { ...s, cursor: wrap(s.cursor + e.delta, ctx.trackCount) }, action: null };
      return { state: { ...s, cursor: wrap(s.cursor + e.delta, memos) }, action: null };
    }

    case 'BACK': {
      if (s.stack.length <= 1) return { state: s, action: { type: 'close' } };
      return { state: { stack: s.stack.slice(0, -1), cursor: s.menuCursor, menuCursor: s.menuCursor }, action: null };
    }

    case 'SELECT': {
      if (top.kind === 'now') return { state: s, action: { type: 'toggle-play' } };
      const play = (trackIndex: number): Result => ({
        state: { stack: [{ kind: 'menu' }, { kind: 'now' }], cursor: 0, menuCursor: s.menuCursor },
        action: { type: 'select-track', trackIndex },
      });
      if (top.kind === 'music') return ctx.trackCount <= 0 ? { state: s, action: null } : play(s.cursor);
      if (top.kind === 'voice') return memos <= 0 ? { state: s, action: null } : play(ctx.trackCount + s.cursor);
      // menu
      const row = s.cursor;
      if (row === 0) {
        const start = ctx.trackCount > 0 ? wrap(ctx.currentIndex, ctx.trackCount) : 0;
        return { state: { stack: [...s.stack, { kind: 'music' }], cursor: start, menuCursor: row }, action: null };
      }
      return { state: { stack: [...s.stack, { kind: 'voice' }], cursor: 0, menuCursor: row }, action: null };
    }
  }
}
