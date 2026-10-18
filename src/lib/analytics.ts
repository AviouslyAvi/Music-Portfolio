export type EventName = 'room_entered' | 'demo_played' | 'demo_skipped' | 'premonition_viewed';

type PlausibleWindow = { plausible?: (name: string) => void };

// Cookieless event counts only. No payloads, no identifiers.
export function track(name: EventName, send?: (name: string) => void): void {
  try {
    if (send) {
      send(name);
      return;
    }
    if (typeof window !== 'undefined') (window as unknown as PlausibleWindow).plausible?.(name);
  } catch {
    // analytics must never break the page
  }
}
