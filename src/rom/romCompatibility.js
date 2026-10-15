/**
 * Layout used by constants.js, verified against ISS Europe (CRC32 6CD568A9).
 * These engine routines are outside every editor's writable ranges. Unlike the
 * whole-file CRC, they survive renamed teams, translations and graphic edits.
 * A Japanese title alone does not establish compatibility with this layout.
 */
export const ISS_ENGINE_SIGNATURES = [
  { offset: 0x6d41, hex: 'ad861f0aa8b9ae9c29ff008d2017b9af' }, // scenario setup
  { offset: 0x6c68, hex: 'bfe48287a8a22005ad26178504640220' }, // formation setup
  { offset: 0x2a8eb, hex: 'a90f008500860284048be220a98748ab' }, // player decoding
];

export function hasSupportedLayout(data, headerOffset = 0) {
  if (data.length - headerOffset !== 0x100000) return false;
  if (
    !ISS_ENGINE_SIGNATURES.every(({ offset, hex }) =>
      hex.match(/../g).every((byte, i) => data[headerOffset + offset + i] === parseInt(byte, 16)),
    )
  )
    return false;
  const word = (offset) => data[headerOffset + offset] | (data[headerOffset + offset + 1] << 8);
  // Each squad must point to its own 15 x 6-byte record in bank $87.
  const players = new Set();
  for (let i = 0; i < 27; i++) {
    const ptr = word(0xded7 + i * 2);
    if (ptr < 0x87ec || ptr > 0x9110 || (ptr - 0x87ec) % 90 !== 0) return false;
    players.add(ptr);
    const formation = word(0x382e4 + i * 2);
    if (formation < 0x831c || formation + 44 > 0x87ec) return false;
  }
  return players.size === 27;
}
