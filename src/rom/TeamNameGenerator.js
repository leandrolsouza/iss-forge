/**
 * Team Name Generator for ISS (1995)
 * Converts text to positioned tile data for the game's team name display
 *
 * Based on TeamNameCharPart.java / TeamNameText.java from rodmguerra/issparser
 * and the web-iss-studio port by EstebanFuentealba
 */

// Character part definitions: { b1, b2, preferredSize, cutLeft }
const TOPS = {
  A: { b1: 0xc0, b2: 0x06, size: 9 },
  B: { b1: 0xc1, b2: 0x06, size: 9 },
  C: { b1: 0xc2, b2: 0x06, size: 9 },
  D: { b1: 0xc3, b2: 0x06, size: 9 },
  E: { b1: 0xc4, b2: 0x06, size: 9 },
  F: { b1: 0xc5, b2: 0x06, size: 9 },
  G: { b1: 0xc6, b2: 0x06, size: 9 },
  H: { b1: 0xc7, b2: 0x06, size: 9 },
  I: { b1: 0xc8, b2: 0x06, size: 7 },
  J: { b1: 0xc9, b2: 0x06, size: 9 },
  K: { b1: 0xca, b2: 0x06, size: 9 },
  L: { b1: 0xcb, b2: 0x06, size: 9 },
  M: { b1: 0xcc, b2: 0x06, size: 8 },
  N: { b1: 0xcd, b2: 0x06, size: 8 },
  O: { b1: 0xce, b2: 0x06, size: 9 },
  P: { b1: 0xcf, b2: 0x06, size: 9 },
  Q: { b1: 0xe0, b2: 0x06, size: 9 },
  R: { b1: 0xe1, b2: 0x06, size: 9 },
  S: { b1: 0xe2, b2: 0x06, size: 9 },
  T: { b1: 0xe3, b2: 0x06, size: 8 },
  U: { b1: 0xe4, b2: 0x06, size: 9 },
  V: { b1: 0xe5, b2: 0x06, size: 9 },
  W: { b1: 0xe6, b2: 0x06, size: 8 },
  X: { b1: 0xe7, b2: 0x06, size: 9 },
  Y: { b1: 0xe8, b2: 0x06, size: 9 },
  Z: { b1: 0xe9, b2: 0x06, size: 9 },
  0: { b1: 0xa0, b2: 0x06, size: 9 },
  1: { b1: 0xa1, b2: 0x06, size: 9 },
  2: { b1: 0xa2, b2: 0x06, size: 9 },
  3: { b1: 0xa3, b2: 0x06, size: 9 },
  4: { b1: 0xa4, b2: 0x06, size: 9 },
  5: { b1: 0xa5, b2: 0x06, size: 9 },
  6: { b1: 0xa6, b2: 0x06, size: 9 },
  7: { b1: 0xa7, b2: 0x06, size: 9 },
  8: { b1: 0xa8, b2: 0x06, size: 9 },
  9: { b1: 0xa9, b2: 0x06, size: 9 },
};

const BOTTOMS = {
  A: { b1: 0xd0, b2: 0x06, size: 9 },
  B: { b1: 0xd1, b2: 0x06, size: 9 },
  C: { b1: 0xd2, b2: 0x06, size: 9 },
  D: { b1: 0xd3, b2: 0x06, size: 9 },
  E: { b1: 0xd4, b2: 0x06, size: 9 },
  F: { b1: 0xd5, b2: 0x06, size: 9 },
  G: { b1: 0xd6, b2: 0x06, size: 9 },
  H: { b1: 0xd7, b2: 0x06, size: 9 },
  I: { b1: 0xd8, b2: 0x06, size: 7 },
  J: { b1: 0xd9, b2: 0x06, size: 9 },
  K: { b1: 0xda, b2: 0x06, size: 9 },
  L: { b1: 0xdb, b2: 0x06, size: 9 },
  M: { b1: 0xdc, b2: 0x06, size: 8 },
  N: { b1: 0xdd, b2: 0x06, size: 8 },
  O: { b1: 0xde, b2: 0x06, size: 9 },
  P: { b1: 0xdf, b2: 0x06, size: 9 },
  Q: { b1: 0xf0, b2: 0x06, size: 9 },
  R: { b1: 0xf1, b2: 0x06, size: 9 },
  S: { b1: 0xf2, b2: 0x06, size: 9 },
  T: { b1: 0xf3, b2: 0x06, size: 8 },
  U: { b1: 0xf4, b2: 0x06, size: 9 },
  V: { b1: 0xf5, b2: 0x06, size: 9 },
  W: { b1: 0xf6, b2: 0x06, size: 8 },
  X: { b1: 0xf7, b2: 0x06, size: 9 },
  Y: { b1: 0xf8, b2: 0x06, size: 9 },
  Z: { b1: 0xf9, b2: 0x06, size: 9 },
  '.': { b1: 0xfa, b2: 0x06, size: 7 },
  0: { b1: 0xb0, b2: 0x06, size: 9 },
  1: { b1: 0xb1, b2: 0x06, size: 9 },
  2: { b1: 0xb2, b2: 0x06, size: 9 },
  3: { b1: 0xb3, b2: 0x06, size: 9 },
  4: { b1: 0xb4, b2: 0x06, size: 9 },
  5: { b1: 0xb5, b2: 0x06, size: 9 },
  6: { b1: 0xb6, b2: 0x06, size: 9 },
  7: { b1: 0xb7, b2: 0x06, size: 9 },
  8: { b1: 0xb8, b2: 0x06, size: 9 },
  9: { b1: 0xb9, b2: 0x06, size: 9 },
};

// Two-char combinations that share a single top tile (b2=0x16 instead of 0x06)
// Each pair uses the TOP b1 of the first character but b2=0x16
function buildTopAndBottoms() {
  const pairs = {};
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  for (let i = 0; i < alphabet.length - 1; i++) {
    const ch1 = alphabet[i];
    const ch2 = alphabet[i + 1];
    // Skip Z→next and 9→next transitions
    if (ch1 === 'Z' || ch1 === '9') continue;

    const top1 = TOPS[ch1];
    const top2 = TOPS[ch2];
    if (top1 && top2) {
      pairs[ch1 + ch2] = {
        b1: top1.b1,
        b2: 0x16,
        size: top1.size + top2.size - 2,
      };
    }
  }
  // Special case: PA (not PQ)
  if (pairs['PQ']) {
    pairs['PA'] = pairs['PQ'];
    delete pairs['PQ'];
  }
  return pairs;
}

const TOP_AND_BOTTOMS = buildTopAndBottoms();

const SPACE_WIDTH = 3;
const MAX_WIDTH = 70;

/**
 * Get the cutLeft value for a character (kerning)
 */
function getCutLeft(char) {
  if (char === 'I') return 1;
  if (char === '.') return 2;
  return 0;
}

/**
 * Generate team name tile data from text
 * @param {string} text - Team name text (e.g., "BRAZIL", "S.KOREA")
 * @returns {Uint8Array} Serialized data [count, type, pos, b1, b2, ...]
 */
export function generateTeamNameData(text) {
  // Sanitize: uppercase, only valid chars
  text = text
    .toUpperCase()
    .replace(/[^A-Z0-9. ]/g, ' ')
    .trim();
  if (!text) return new Uint8Array([0]);

  // Build positioned parts
  const parts = []; // { position, isBottom, b1, b2 }
  let currentPosition = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    // Space
    if (ch === ' ') {
      currentPosition += SPACE_WIDTH;
      continue;
    }

    // Try two-char combination first (saves 3 entries per pair)
    if (i + 1 < text.length) {
      const pair = text[i] + text[i + 1];
      const topAndBottom = TOP_AND_BOTTOMS[pair];
      if (topAndBottom) {
        // Apply kerning
        if (parts.length > 0) {
          currentPosition -= getCutLeft(text[i]);
        }
        // Add the combined top+bottom part (uses top type 0xF1)
        parts.push({
          position: currentPosition,
          type: 0xf1,
          b1: topAndBottom.b1,
          b2: topAndBottom.b2,
        });
        currentPosition += topAndBottom.size;
        i++; // skip next char
        continue;
      }
    }

    // Single character
    if (parts.length > 0) {
      currentPosition -= getCutLeft(ch);
    }

    // Add bottom part FIRST (matches ISS Studio original order)
    const bottom = BOTTOMS[ch];
    if (bottom) {
      parts.push({
        position: currentPosition,
        type: 0xf9,
        b1: bottom.b1,
        b2: bottom.b2,
      });
    }

    // Add top part
    const top = TOPS[ch];
    if (top) {
      parts.push({
        position: currentPosition,
        type: 0xf1,
        b1: top.b1,
        b2: top.b2,
      });
    }

    currentPosition += (top || bottom)?.size || 9;
  }

  // Handle overflow: compress if too wide
  let totalWidth = currentPosition - 1;
  if (totalWidth > MAX_WIDTH && parts.length > 1) {
    // Simple compression: reduce spacing proportionally
    const scale = MAX_WIDTH / totalWidth;
    for (let i = 0; i < parts.length; i++) {
      parts[i].position = Math.round(parts[i].position * scale);
    }
    totalWidth = MAX_WIDTH;
  }

  // Center: shift all positions so the name is centered (position 0 = center)
  const halfWidth = Math.floor(totalWidth / 2);
  for (let i = 0; i < parts.length; i++) {
    parts[i].position -= halfWidth;
  }

  // Serialize
  const count = parts.length;
  const output = new Uint8Array(1 + count * 4);
  output[0] = count;

  // Sort by position only (preserve bottom-before-top insertion order within same position)
  parts.sort((a, b) => a.position - b.position);

  for (let i = 0; i < count; i++) {
    const p = parts[i];
    output[1 + i * 4] = p.type;
    output[1 + i * 4 + 1] = p.position & 0xff; // signed byte
    output[1 + i * 4 + 2] = p.b1;
    output[1 + i * 4 + 3] = p.b2;
  }

  return output;
}

/**
 * Get the maximum size available for a team name
 */
export const MAX_TEAM_NAME_SIZE = 0x49; // 73 bytes (largest seen in ROM)
