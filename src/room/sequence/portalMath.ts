export const PORTAL_MS = 3000;
export const PORTAL_REDUCED_MS = 400;

const clamp01 = (t: number) => (Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0);

/** How far the camera has been pulled in, 0..1. Slow at first, hard at the end (ease-in cubic). */
export function dollyProgress(t: number): number {
  const c = clamp01(t);
  return c * c * c;
}
