export type Env = {
  webgl: boolean;
  reducedMotion: boolean;
  coarsePointer: boolean;
  viewportWidth: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
};

// Builder tunes these.
export const MIN_VIEWPORT_WIDTH = 1024;
export const MIN_DEVICE_MEMORY_GB = 4;
export const MIN_CORES = 4;

export function shouldOfferRoom(env: Env): boolean {
  if (!env.webgl || env.reducedMotion || env.coarsePointer) return false;
  if (env.viewportWidth < MIN_VIEWPORT_WIDTH) return false;
  if (env.deviceMemory !== undefined && env.deviceMemory < MIN_DEVICE_MEMORY_GB) return false;
  if (env.hardwareConcurrency !== undefined && env.hardwareConcurrency < MIN_CORES) return false;
  return true;
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
