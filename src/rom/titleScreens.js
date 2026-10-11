/**
 * Mode titles ("INTERNATIONAL CUP", "WORLD SERIES 1ST SEASON"...): tilemaps
 * built from the big title font. The text is decoded from the tilemap and a new
 * tilemap is generated, compressed and placed like a menu screen.
 *
 * See TITLE_FONT in constants.js and research/game-texts.md (section 5).
 */
import { TITLE_FONT, TITLE_LAYOUT } from './constants';
import { readScreenWords, packScreenWords, placeScreenBlock } from './menuScreens';

const T = TITLE_LAYOUT;
const LETTER_ROWS = 4;
const FLIP_TILE = 0xc3ff;

/** Letters of the title font (plus space) */
export const TITLE_CHARS = Object.keys(TITLE_FONT).sort().join('');

const glyphWidth = (ch) => (ch === ' ' ? 1 : (TITLE_FONT[ch]?.length ?? 0));

export function findInvalidTitleChars(text) {
  const bad = new Set();
  for (const ch of String(text).toUpperCase().replace(/\n/g, ''))
    if (ch !== ' ' && !TITLE_FONT[ch]) bad.add(ch);
  return [...bad];
}

/** Lines of a title (upper case, trailing spaces removed, at most one blank line kept) */
const titleLines = (text) =>
  String(text ?? '')
    .toUpperCase()
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''));

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
const GLYPHS = Object.entries(TITLE_FONT).sort((a, b) => b[1].length - a[1].length);

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
      if (ch === ' ' || !TITLE_FONT[ch]) {
        c++;
        continue;
      }
      for (const col of TITLE_FONT[ch]) {
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
