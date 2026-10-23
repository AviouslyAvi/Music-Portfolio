export type Env = {
  webgl: boolean;
  reducedMotion: boolean;
  coarsePointer: boolean;
  viewportWidth: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
};

// The room is the site's front door on every device; WebGL is the only hard requirement.
// Motion preference, pointer type, size and hardware are handled inside the room, not gated here.
export function shouldOfferRoom(env: Env): boolean {
  return env.webgl;
}

function hasWebgl(win: Window): boolean {
  try {
    const canvas = win.document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function detectEnv(win: Window): Env {
  const nav = win.navigator as Navigator & { deviceMemory?: number };
  return {
    webgl: hasWebgl(win),
    reducedMotion: win.matchMedia('(prefers-reduced-motion: reduce)').matches,
    coarsePointer: win.matchMedia('(pointer: coarse)').matches,
    viewportWidth: win.innerWidth,
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
  };
}
