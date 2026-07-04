/**
 * Team name text reader
 * Reads positional tile data and reconstructs the team name string
 */
import { TEAMS } from '../constants';

const TEAM_NAME_POINTER_OFFSET = 0x39dae;
const TEAM_NAME_POINTER_STEP = 2;

// Maps our TEAMS array index to ISS Studio enum ordinal (pointer table position)
const TEAM_NAME_ORDINALS = [
  0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 5, 25, 26,
];

export function readTeamNameText(rom, teamIndex) {
  try {
    const ordinal = TEAM_NAME_ORDINALS[teamIndex];
    const ptrOffset = TEAM_NAME_POINTER_OFFSET + ordinal * TEAM_NAME_POINTER_STEP;
    const dataAddr = readTeamNamePointer(rom, ptrOffset);

    const count = rom.readByte(dataAddr);
    if (count === 0 || count > 40) return TEAMS[teamIndex].name.toUpperCase();

    const totalBytes = count * 4;
    const data = rom.readBytes(dataAddr + 1, totalBytes);

    const charParts = [];
    for (let i = 0; i < count; i++) {
      const type = data[i * 4];
      const pos = toInt8(data[i * 4 + 1]);
      const b1 = data[i * 4 + 2];
      const b2 = data[i * 4 + 3];

      // Only process top-half entries (type=0xF1)
      if (type === 0xf1) {
        const firstChar = tileToChar(b1);
        if (!firstChar) continue;

        if (b2 === 0x16) {
          // Combined pair: b1 is first char's top tile, second char is next in sequence
          const secondChar = getNextChar(firstChar);
          charParts.push({ pos, char: firstChar + (secondChar || '') });
        } else {
          charParts.push({ pos, char: firstChar });
        }
      }
    }

    charParts.sort((a, b) => a.pos - b.pos);

    // Reconstruct text with space detection (same logic as ISS Studio)
    // Space threshold adapts: 10px per character in previous entry
    let text = '';
    let lastPos = -128;
    let lastLen = 1;
    for (let i = 0; i < charParts.length; i++) {
      const gap = charParts[i].pos - lastPos;
      if (i > 0 && gap >= 10 * lastLen) text += ' ';
      text += charParts[i].char;
      lastPos = charParts[i].pos;
      lastLen = charParts[i].char.length;
    }

    return text || TEAMS[teamIndex].name.toUpperCase();
  } catch (e) {
    console.warn('Failed to read team name for team', teamIndex, e);
    return TEAMS[teamIndex].name.toUpperCase();
  }
}

function readTeamNamePointer(rom, pointerOffset) {
  const b1 = rom.readByte(pointerOffset);
  const b2 = rom.readByte(pointerOffset + 1);
  return 0x40000 + ((b2 - 0x80) << 8) + b1;
}

function toInt8(byte) {
  return byte > 127 ? byte - 256 : byte;
}

function tileToChar(b1) {
  // Top tiles: A-P = 0xC0-0xCF, Q-Z = 0xE0-0xE9
  if (b1 >= 0xc0 && b1 <= 0xcf) return String.fromCharCode('A'.charCodeAt(0) + (b1 - 0xc0));
  if (b1 >= 0xe0 && b1 <= 0xe9) return String.fromCharCode('Q'.charCodeAt(0) + (b1 - 0xe0));
  // Digits: 0-9 = 0xA0-0xA9
  if (b1 >= 0xa0 && b1 <= 0xa9) return String.fromCharCode('0'.charCodeAt(0) + (b1 - 0xa0));
  // Dot
  if (b1 === 0xfa) return '.';
  return '';
}

/**
 * Get next character in sequence for combined pair decoding.
 * Combined pairs are consecutive: AB, BC, CD, ..., NO, OP, ..., YZ, 01, 12, ..., 89
 * Special case: P's pair is PA (not PQ) — matches ISS Studio's buildTopAndBottoms
 */
function getNextChar(char) {
  if (char === 'P') return 'A'; // Special case: PA pair replaces PQ
  if (char >= 'A' && char < 'Z') return String.fromCharCode(char.charCodeAt(0) + 1);
  if (char >= '0' && char < '9') return String.fromCharCode(char.charCodeAt(0) + 1);
  return null;
}
