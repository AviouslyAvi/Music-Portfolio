// Fetches and decodes one shipped dry sound to 48 kHz channel data. Needs no user gesture
// (an OfflineAudioContext never plays), so it can run while the boot is on screen.
export const SAMPLE_RATE = 48000;

export async function loadSource(src: string): Promise<Float32Array[]> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`${src} ${res.status}`);
  const bytes = await res.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const buf = await ctx.decodeAudioData(bytes);
  const channels: Float32Array[] = [];
  for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) channels.push(buf.getChannelData(c).slice());
  return channels;
}
