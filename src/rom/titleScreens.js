/**
 * Mode titles ("INTERNATIONAL CUP", "WORLD SERIES 1ST SEASON"...): tilemaps
 * built from the big title font. The text is decoded from the tilemap and a new
 * tilemap is generated, compressed and placed like a menu screen.
 *
 * See TITLE_FONT in constants.js and research/game-texts.md (section 5).
 */
import {
  TITLE_FONT,
  TITLE_FONT_DRAWN,
  TITLE_NEW_TILES,
  TITLE_FONT_BLOCK,
  TITLE_LAYOUT,
} from './constants';
import { readScreenWords, packScreenWords, placeScreenBlock } from './menuScreens';
import { konamiDecompress, konamiCompress } from './KonamiCodec';

const T = TITLE_LAYOUT;
const LETTER_ROWS = 4;
const FLIP_TILE = 0xc3ff;

/** Every letter: the original ones and the ones drawn by ISS Forge */
const TITLE_ALL = { ...TITLE_FONT, ...TITLE_FONT_DRAWN };

/** Letters of the title font (space is also accepted) */
export const TITLE_CHARS = Object.keys(TITLE_ALL).sort().join('');

const glyphWidth = (ch) => (ch === ' ' ? 1 : (TITLE_ALL[ch]?.length ?? 0));

export function findInvalidTitleChars(text) {
  const bad = new Set();
  for (const ch of String(text).toUpperCase().replace(/\n/g, ''))
    if (ch !== ' ' && !TITLE_ALL[ch]) bad.add(ch);
  return [...bad];
}

/** Lines of a title (upper case, trailing spaces removed; empty lines at the end are dropped) */
const titleLines = (text) => {
  const lines = String(text ?? '')
    .toUpperCase()
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''));
  while (lines.length > 1 && !lines[lines.length - 1]) lines.pop();
  return lines;
};

/** Width of each line in tile columns */
export const titleLineWidths = (text) =>
  titleLines(text).map((l) => [...l].reduce((n, ch) => n + glyphWidth(ch), 0));

/**
 * Problems of a title text: noGlyph, tooManyLines, tooWide
 * @returns {{ error?: string, invalid: string[], widths: number[] }}
 */
export function checkTitleText(text) {
  const invalid = findInvalidTitleChars(text);
  const widths = titleLineWidths(text);
  const res = { invalid, widths };
  if (invalid.length) res.error = 'noGlyph';
  else if (titleLines(text).length > T.ROWS.length) res.error = 'tooManyLines';
  else if (widths.some((w) => w > T.COLUMNS)) res.error = 'tooWide';
  return res;
}

// Wider glyphs first, so a 1-column glyph never matches the start of a 2-column one
const GLYPHS = Object.entries(TITLE_ALL).sort((a, b) => b[1].length - a[1].length);

/** Text of a title tilemap (unknown columns become "?") */
export function decodeTitleWords(words) {
  const cell = (r, c) => words[r * T.COLUMNS + c] & FLIP_TILE;
  const column = (r, c) => Array.from({ length: LETTER_ROWS }, (_, k) => cell(r + k, c));
  const blankColumn = (r, c) => column(r, c).every((w) => (w & 0x3ff) === (T.BLANK & 0x3ff));
  const lines = T.ROWS.map((r) => {
    let s = '';
    let c = 0;
    while (c < T.COLUMNS) {
      if (blankColumn(r, c)) {
        s += ' ';
        c++;
        continue;
      }
      const hit = GLYPHS.find(([, cols]) =>
        cols.every((col, k) => c + k < T.COLUMNS && col.every((w, y) => w === cell(r + y, c + k))),
      );
      if (hit) {
        s += hit[0];
        c += hit[1].length;
      } else {
        s += '?';
        c++;
      }
    }
    return s.trim();
  });
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  // inner spacing is kept as in the tilemap ("1ST  SEASON" has two blank columns)
  return lines.join('\n');
}

export function readTitleText(rom, offset) {
  return decodeTitleWords(readScreenWords(rom, offset));
}

/** New tilemap: the current one with the text rows cleared and the lines drawn centred */
export function buildTitleWords(rom, offset, text) {
  const words = readScreenWords(rom, offset);
  const lastRow = T.ROWS[T.ROWS.length - 1] + LETTER_ROWS;
  for (let r = T.ROWS[0]; r < lastRow; r++)
    for (let c = 0; c < T.COLUMNS; c++) words[r * T.COLUMNS + c] = T.BLANK;
  titleLines(text).forEach((line, i) => {
    const row = T.ROWS[i];
    if (row === undefined) return;
    const width = [...line].reduce((n, ch) => n + glyphWidth(ch), 0);
    let c = Math.ceil((T.COLUMNS - width) / 2);
    for (const ch of line) {
      if (ch === ' ' || !TITLE_ALL[ch]) {
        c++;
        continue;
      }
      for (const col of TITLE_ALL[ch]) {
        col.forEach((w, y) => {
          // a blank cell of a glyph (L foot column) keeps the blank tile
          words[(row + y) * T.COLUMNS + c] = T.PALETTE | w;
        });
        c++;
      }
    }
  });
  return words;
}

/**
 * Write a title. The tilemap is compressed and placed like a menu screen (in
 * its slot, in free space or after re-arranging the movable screens).
 * @returns {{ ok: boolean, error?: string, size?: number, capacity?: number, moved?: boolean }}
 */
export function writeTitleScreen(rom, offset, text) {
  const check = checkTitleText(text);
  if (check.error) return { ok: false, error: check.error };
  return placeScreenBlock(rom, offset, packScreenWords(buildTitleWords(rom, offset, text)));
}

// --- Title font tiles (letters drawn by ISS Forge) ---

const TB = TITLE_FONT_BLOCK;

/** New tiles (index >= 0x59) used by a drawn letter */
const newTilesOf = (ch) =>
  [...new Set(TITLE_FONT_DRAWN[ch].flat().map((w) => w & 0x3ff))].filter((t) => TITLE_NEW_TILES[t]);

/** 4bpp bytes of a new tile: "#" = letter (colour 0, the texture shows through), "." = colour 1 */
function newTileBytes(t) {
  const out = new Uint8Array(32);
  TITLE_NEW_TILES[t].forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') out[y * 2] |= 0x80 >> x;
    }),
  );
  return out;
}

function fontBlockAddress(rom) {
  const lo = rom.readByte(TB.pointer);
  const hi = rom.readByte(TB.pointer + 1);
  const bank = rom.readByte(TB.pointer + 2) & 0x7f;
  return bank * 0x8000 + ((lo | (hi << 8)) - 0x8000);
}

/** Decompressed title font tiles */
export function readTitleFontTiles(rom) {
  const data = rom.getRomData ? rom.getRomData() : rom.data;
  return konamiDecompress(data, fontBlockAddress(rom) + (rom.headerOffset || 0));
}

/** Drawn letters present in the title font block */
export function installedTitleGlyphs(rom) {
  const tiles = readTitleFontTiles(rom);
  return Object.keys(TITLE_FONT_DRAWN).filter((ch) =>
    newTilesOf(ch).every((t) => {
      const want = newTileBytes(t);
      return t * 32 + 32 <= tiles.length && want.every((b, k) => tiles[t * 32 + k] === b);
    }),
  );
}

/** Drawn letters used by a set of title texts */
export const titleFontNeeds = (texts) => {
  const used = new Set(texts.join('').toUpperCase());
  return Object.keys(TITLE_FONT_DRAWN).filter((ch) => used.has(ch));
};

/**
 * Put the tiles of the given drawn letters in the title font block (the original
 * 105 tiles always stay; the block grows up to the last tile needed). In place.
 * @returns {{ ok: boolean, size: number, capacity: number }}
 */
export function writeTitleFont(rom, letters) {
  const orig = rom.getOriginalData ? rom.getOriginalData() : null;
  const h = rom.headerOffset || 0;
  const base = orig
    ? readTitleFontTiles({ getRomData: () => orig, headerOffset: h, readByte: (a) => orig[a + h] })
    : readTitleFontTiles(rom).slice(0, TB.tiles * 32);
  const needed = letters.flatMap(newTilesOf);
  const count = Math.max(TB.tiles, ...needed.map((t) => t + 1));
  const tiles = new Uint8Array(count * 32);
  tiles.set(base.slice(0, TB.tiles * 32));
  for (const t of needed) tiles.set(newTileBytes(t), t * 32);
  const packed = konamiCompress(tiles);
  if (packed.length > TB.capacity) return { ok: false, size: packed.length, capacity: TB.capacity };
  const room = new Uint8Array(TB.capacity).fill(0xff);
  room.set(packed);
  rom.writeBytes(fontBlockAddress(rom), room);
  return { ok: true, size: packed.length, capacity: TB.capacity };
}
