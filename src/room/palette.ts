// Room colours as 0xRRGGBB integers. The first five mirror the CSS tokens in
// src/app/globals.css (--charcoal #23262a, --walnut #5b3f2c, --lamp #e9a85f,
// --text #efe6d8). The seven named AVIOUS colours below them are the autumn
// palette of the 70s studio look; exact values are the builder's pick from the
// names and are shown to the owner as swatches. The brightest colour is offWhite,
// the warm text tone; nothing here is a full-bright channel triple.
export const ROOM_COLORS = {
  charcoal: 0x23262a,
  walnut: 0x5b3f2c,
  lamp: 0xe9a85f,
  offWhite: 0xefe6d8,
  rug: 0x8f4a33,
  oxblood: 0x5c1f24,
  terracotta: 0xb2573a,
  sage: 0x8a9b77,
  midnight: 0x1d2639,
  mustard: 0xc99a2e,
  espresso: 0x3b2a21,
  cotton: 0xe8dec8,
} as const;
