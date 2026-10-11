/**
 * Main menu sprite texts: text <-> sprite lists built from the big OBJ font.
 *
 * See MENU_SPRITE_FONT in constants.js and research/game-texts.md (section 5).
 */
import { MENU_SPRITE_FONT, MENU_SPRITE_LAYOUT } from './constants';

const L = MENU_SPRITE_LAYOUT;
const s8 = (b) => (b > 127 ? b - 256 : b);

/** Letters available in the font (plus space) */
export const MENU_SPRITE_CHARS = Object.keys(MENU_SPRITE_FONT).sort().join('');

/** Characters of a text that have no glyph (lower case is accepted as upper case) */
export function findInvalidSpriteChars(text) {
  const bad = new Set();
  for (const ch of String(text).toUpperCase()) if (ch !== ' ' && !MENU_SPRITE_FONT[ch]) bad.add(ch);
  return [...bad];
}

/**
 * Lay out a text as sprite entries.
 * @returns {{ entries: {dx,dy,tile,big}[], right: number, error?: string, invalid: string[] }}
 */
export function layoutSpriteText(text, { row, start = L.START, maxRight = L.MAX_RIGHT }) {
  const value = String(text ?? '')
    .toUpperCase()
    .trim();
  const invalid = findInvalidSpriteChars(value);
  let best = null;
  // letters touch (ink to ink); tighten by 1-2 pixels when the text is too wide
  for (const gap of [0, -1, -2]) {
    const letters = [];
    let prev = null;
    let space = 0;
    for (const ch of value) {
      if (ch === ' ') {
        space += L.SPACE;
        continue;
      }
      const g = MENU_SPRITE_FONT[ch];
      if (!g) continue;
      const origin =
        prev === null ? start : prev.origin + prev.g.ink[1] + 1 + gap + space - g.ink[0];
      letters.push({ g, origin });
      prev = { g, origin };
      space = 0;
    }
    const right = prev ? prev.origin + prev.g.ink[1] : start;
    best = { letters, right };
    if (right <= maxRight) break;
  }
  // Right-most letters first: their sprites are drawn over the shadow of the previous one
  const entries = [];
  for (const { g, origin } of [...best.letters].reverse()) {
    for (const [dx, dy, tile, big] of g.pieces) {
      entries.push({ dx: origin + dx, dy: row + dy, tile, big: Boolean(big) });
    }
  }
  const res = { entries, right: best.right, invalid };
  if (best.right > maxRight) res.error = 'tooWide';
  else if (!spriteLinesOk(entries, row)) res.error = 'tooManySprites';
  return res;
}

/** Sprites and 8-pixel slivers on the two 8-line bands of a row (PPU limits) */
export function spriteLineUsage(entries, row) {
  const bands = [0, 8].map((band) => {
    let sprites = 0;
    let slivers = 0;
    for (const e of entries) {
      const top = e.dy - row;
      const covers = e.big ? top <= band && band < top + 16 : top === band;
      if (!covers) continue;
      sprites++;
      slivers += e.big ? 2 : 1;
    }
    return { sprites, slivers };
  });
  return {
    sprites: Math.max(...bands.map((b) => b.sprites)),
    slivers: Math.max(...bands.map((b) => b.slivers)),
  };
}

const spriteLinesOk = (entries, row) => {
  const u = spriteLineUsage(entries, row);
  return u.sprites <= L.MAX_SPRITES && u.slivers <= L.MAX_SLIVERS;
};

/** Sprite list bytes: count + [dy, dx, tile, attr] */
export function encodeSpriteEntries(entries) {
  const bytes = [entries.length];
  for (const e of entries) {
    const attr = 0x0c | (e.big ? 0x10 : 0) | ((e.tile >> 8) & 1);
    bytes.push(e.dy & 0xff, e.dx & 0xff, e.tile & 0xff, attr);
  }
  return bytes;
}

/** Read a sprite list from the ROM */
export function readSpriteEntries(rom, addr) {
  const n = rom.readByte(addr);
  const entries = [];
  for (let i = 0; i < n; i++) {
    const [dy, dx, t, attr] = rom.readBytes(addr + 1 + i * 4, 4);
    entries.push({ dy: s8(dy), dx: s8(dx), tile: ((attr & 1) << 8) | t, big: (attr & 0x10) !== 0 });
  }
  return entries;
}

// Longest glyphs first, so I (2 pieces) does not steal the stem of U or L
const GLYPHS = Object.entries(MENU_SPRITE_FONT).sort(
  (a, b) => b[1].pieces.length - a[1].pieces.length,
);

/** Sprite list -> text (unknown pieces become "?"; gaps of 4+ pixels become a space) */
export function decodeSpriteEntries(entries) {
  if (!entries.length) return '';
  const row = Math.min(...entries.map((e) => e.dy));
  const left = [...entries].sort((a, b) => a.dx - b.dx || a.dy - b.dy);
  const letters = [];
  while (left.length) {
    const first = left[0];
    let found = null;
    for (const [ch, g] of GLYPHS) {
      const used = [];
      const ok = g.pieces.every(([dx, dy, tile, big]) => {
        const k = left.findIndex(
          (e, i) =>
            !used.includes(i) &&
            e.dx === first.dx + dx &&
            e.dy === row + dy &&
            e.tile === tile &&
            e.big === Boolean(big),
        );
        if (k >= 0) used.push(k);
        return k >= 0;
      });
      if (ok && used.includes(0)) {
        found = { ch, g, used };
        break;
      }
    }
    if (found) {
      letters.push({ ch: found.ch, origin: first.dx, g: found.g });
      found.used.sort((a, b) => b - a).forEach((k) => left.splice(k, 1));
    } else {
      letters.push({ ch: '?', origin: first.dx, g: { ink: [0, 7] } });
      left.splice(0, 1);
    }
  }
  let text = '';
  letters.forEach((l, i) => {
    if (i > 0) {
      const p = letters[i - 1];
      const gap = l.origin + l.g.ink[0] - (p.origin + p.g.ink[1] + 1);
      if (gap >= 4) text += ' ';
    }
    text += l.ch;
  });
  return text;
}
