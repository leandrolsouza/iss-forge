/**
 * Main menu sprite texts: text <-> sprite lists built from the big OBJ font.
 *
 * The font block can hold extra letters (MENU_SPRITE_EXTRA_GLYPHS) drawn over the
 * tiles of a letter the menu does not use (H takes the place of K).
 *
 * See MENU_SPRITE_FONT in constants.js and research/game-texts.md (section 5).
 */
import {
  MENU_SPRITE_FONT,
  MENU_SPRITE_LAYOUT,
  MENU_SPRITE_EXTRA_GLYPHS,
  MENU_FONT_BLOCK,
} from './constants';
import { konamiDecompress, konamiCompress } from './KonamiCodec';

const L = MENU_SPRITE_LAYOUT;
const B = MENU_FONT_BLOCK;
const s8 = (b) => (b > 127 ? b - 256 : b);

/** Every letter the editor can write: the original ones plus the extra ones */
export const MENU_SPRITE_ALL = (() => {
  const all = { ...MENU_SPRITE_FONT };
  for (const [ch, x] of Object.entries(MENU_SPRITE_EXTRA_GLYPHS)) {
    all[ch] = { pieces: MENU_SPRITE_FONT[x.replaces].pieces, ink: x.ink };
  }
  return all;
})();

/** Letters available (plus space) */
export const MENU_SPRITE_CHARS = Object.keys(MENU_SPRITE_ALL).sort().join('');

/** Glyph table with the given extra letters installed (they replace their slot letter) */
export function menuSpriteFont(installed = []) {
  const font = { ...MENU_SPRITE_FONT };
  for (const ch of installed) {
    delete font[MENU_SPRITE_EXTRA_GLYPHS[ch].replaces];
    font[ch] = MENU_SPRITE_ALL[ch];
  }
  return font;
}

/** Characters of a text that have no glyph (lower case is accepted as upper case) */
export function findInvalidSpriteChars(text) {
  const bad = new Set();
  for (const ch of String(text).toUpperCase()) if (ch !== ' ' && !MENU_SPRITE_ALL[ch]) bad.add(ch);
  return [...bad];
}

/**
 * Extra letters needed by a set of texts, and conflicts (an extra letter and the
 * letter whose tiles it reuses both used).
 * @returns {{ install: string[], conflicts: [string, string][] }}
 */
export function menuFontNeeds(texts) {
  const used = new Set(
    texts
      .join('')
      .toUpperCase()
      .replace(/[^A-Z]/g, ''),
  );
  const install = [];
  const conflicts = [];
  for (const [ch, x] of Object.entries(MENU_SPRITE_EXTRA_GLYPHS)) {
    if (!used.has(ch)) continue;
    install.push(ch);
    if (used.has(x.replaces)) conflicts.push([ch, x.replaces]);
  }
  return { install, conflicts };
}

/**
 * Lay out a text as sprite entries (every letter, original or extra, is allowed).
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
      const g = MENU_SPRITE_ALL[ch];
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

/** Sprite list -> text (unknown pieces become "?"; gaps of 4+ pixels become a space) */
export function decodeSpriteEntries(entries, font = MENU_SPRITE_FONT) {
  if (!entries.length) return '';
  // Longest glyphs first, so I (2 pieces) does not steal the stem of U or L
  const glyphs = Object.entries(font).sort((a, b) => b[1].pieces.length - a[1].pieces.length);
  const row = Math.min(...entries.map((e) => e.dy));
  const left = [...entries].sort((a, b) => a.dx - b.dx || a.dy - b.dy);
  const letters = [];
  while (left.length) {
    const first = left[0];
    let found = null;
    for (const [ch, g] of glyphs) {
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

// --- Font tiles (compressed block) ---

const blockAddress = (rom) => {
  const lo = rom.readByte(B.pointer);
  const hi = rom.readByte(B.pointer + 1);
  const bank = rom.readByte(B.pointer + 2) & 0x7f;
  return bank * 0x8000 + ((lo | (hi << 8)) - 0x8000);
};

const romBytes = (rom) => (rom.getRomData ? rom.getRomData() : rom.data);

/** Decompressed font tiles (32 bytes per tile, first = tile 0x100) */
export function readMenuFontTiles(rom) {
  return konamiDecompress(romBytes(rom), blockAddress(rom) + (rom.headerOffset || 0));
}

/** 4bpp tile bytes of a 16x16 glyph drawn as 16 rows of colour indices */
export function glyphTileBytes(pixels) {
  const tiles = [];
  for (const [ox, oy] of [
    [0, 0],
    [8, 0],
    [0, 8],
    [8, 8],
  ]) {
    const out = new Uint8Array(32);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const ch = pixels[oy + y][ox + x];
        const p = ch === '.' ? 0 : parseInt(ch, 16);
        for (let b = 0; b < 4; b++)
          if ((p >> b) & 1) out[(b >> 1) * 16 + y * 2 + (b & 1)] |= 0x80 >> x;
      }
    tiles.push(out);
  }
  return tiles;
}

/** The 4 tiles (top-left, top-right, bottom-left, bottom-right) of a 16x16 sprite */
const bigTiles = (tile) => [tile, tile + 1, tile + 16, tile + 17];
const slotTile = (ch) => MENU_SPRITE_FONT[MENU_SPRITE_EXTRA_GLYPHS[ch].replaces].pieces[0][2];

/** Extra letters currently drawn in the font block */
export function installedMenuGlyphs(rom) {
  const tiles = readMenuFontTiles(rom);
  return Object.entries(MENU_SPRITE_EXTRA_GLYPHS)
    .filter(([ch, x]) => {
      const mine = glyphTileBytes(x.pixels);
      return bigTiles(slotTile(ch)).every((t, i) => {
        const at = (t - B.firstTile) * 32;
        return mine[i].every((b, k) => tiles[at + k] === b);
      });
    })
    .map(([ch]) => ch);
}

/**
 * Draw the given extra letters in the font block (and put back the original
 * tiles of the others). The block is recompressed in place.
 * @returns {{ ok: boolean, size: number, capacity: number }}
 */
export function writeMenuFont(rom, install) {
  const tiles = readMenuFontTiles(rom);
  const orig = rom.getOriginalData
    ? readMenuFontTiles({
        getRomData: () => rom.getOriginalData(),
        headerOffset: rom.headerOffset,
        readByte: (a) => rom.getOriginalData()[a + (rom.headerOffset || 0)],
      })
    : tiles;
  for (const [ch, x] of Object.entries(MENU_SPRITE_EXTRA_GLYPHS)) {
    const mine = install.includes(ch) ? glyphTileBytes(x.pixels) : null;
    bigTiles(slotTile(ch)).forEach((t, i) => {
      const at = (t - B.firstTile) * 32;
      tiles.set(mine ? mine[i] : orig.slice(at, at + 32), at);
    });
  }
  const packed = konamiCompress(tiles);
  if (packed.length > B.capacity) return { ok: false, size: packed.length, capacity: B.capacity };
  const at = blockAddress(rom);
  const room = new Uint8Array(B.capacity).fill(0xff);
  room.set(packed);
  rom.writeBytes(at, room);
  return { ok: true, size: packed.length, capacity: B.capacity };
}
