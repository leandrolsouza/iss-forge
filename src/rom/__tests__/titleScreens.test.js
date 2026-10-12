import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  TITLE_CHARS,
  findInvalidTitleChars,
  titleLineWidths,
  checkTitleText,
  decodeTitleWords,
  readTitleText,
  buildTitleWords,
  writeTitleScreen,
  readTitleFontTiles,
  installedTitleGlyphs,
  titleFontNeeds,
  writeTitleFont,
} from '../titleScreens';
import { readScreenWords } from '../menuScreens';
import { konamiDecompress } from '../KonamiCodec';
import {
  SCREEN_TEXTS,
  TITLE_FONT,
  TITLE_FONT_DRAWN,
  TITLE_FONT_BLOCK,
  TITLE_LAYOUT,
} from '../constants';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);

const T = TITLE_LAYOUT;
const TB = TITLE_FONT_BLOCK;
const TITLE_FIELDS = SCREEN_TEXTS.find((s) => s.id === 'titles').fields;
const offsetOf = (id) => TITLE_FIELDS.find((f) => f.id === id).offset;

/** 32x32 tilemap with every cell blank */
const blankWords = () => new Uint16Array(T.COLUMNS * T.COLUMNS).fill(T.BLANK);

/** Draw a glyph (columns of TITLE_FONT) at a text row / column of a tilemap */
function drawGlyph(words, row, col, columns, palette = T.PALETTE) {
  columns.forEach((column, k) =>
    column.forEach((w, y) => {
      words[(row + y) * T.COLUMNS + col + k] = palette | w;
    }),
  );
}

describe('title font characters', () => {
  it('lists the original, built and drawn letters plus the digits 1 and 2', () => {
    expect(TITLE_CHARS).toBe('12ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(TITLE_CHARS).toBe(
      Object.keys({ ...TITLE_FONT, ...TITLE_FONT_DRAWN })
        .sort()
        .join(''),
    );
    // the space is accepted by the checks but is not part of the list
    expect(TITLE_CHARS).not.toContain(' ');
  });

  it('finds characters without a glyph (case-insensitive, once each)', () => {
    expect(findInvalidTitleChars('INTERNATIONAL CUP')).toEqual([]);
    expect(findInvalidTitleChars('copa\nmundial')).toEqual([]);
    expect(findInvalidTitleChars('KYZXQV 12')).toEqual([]);
    expect(findInvalidTitleChars('COPA 3')).toEqual(['3']);
    expect(findInvalidTitleChars('ÇÇ3!3')).toEqual(['Ç', '3', '!']);
    expect(findInvalidTitleChars('A-B.C')).toEqual(['-', '.']);
  });
});

describe('titleLineWidths', () => {
  it('counts I and 1 as 1 column, space 1 and every other letter 2', () => {
    expect(titleLineWidths('I')).toEqual([1]);
    expect(titleLineWidths('1')).toEqual([1]);
    expect(titleLineWidths('A')).toEqual([2]);
    expect(titleLineWidths('2')).toEqual([2]);
    expect(titleLineWidths('INTERNATIONAL\nCUP')).toEqual([24, 6]);
    expect(titleLineWidths('WORLD SERIES\n1ST  SEASON')).toEqual([22, 19]);
    expect(titleLineWidths('kyzxqv')).toEqual([12]);
  });

  it('drops trailing spaces but keeps leading and inner ones', () => {
    expect(titleLineWidths('AB   ')).toEqual([4]);
    expect(titleLineWidths('  AB')).toEqual([6]);
    expect(titleLineWidths('A  B')).toEqual([6]);
    expect(titleLineWidths('')).toEqual([0]);
    expect(titleLineWidths('A\n\nB')).toEqual([2, 0, 2]);
  });

  it('gives characters without a glyph no width (current behaviour)', () => {
    expect(titleLineWidths('A3B')).toEqual([4]);
  });
});

describe('checkTitleText', () => {
  it('accepts titles that fit', () => {
    expect(checkTitleText('COPA\nINTERNACIONAL')).toEqual({ invalid: [], widths: [8, 24] });
    expect(checkTitleText('A\nB\nC').error).toBeUndefined();
    expect(checkTitleText('').error).toBeUndefined();
    expect(checkTitleText('copa').error).toBeUndefined();
  });

  it('reports letters without a glyph first', () => {
    const res = checkTitleText('COPA\n3\nX\nY');
    expect(res.error).toBe('noGlyph');
    expect(res.invalid).toEqual(['3']);
  });

  it('reports more than 3 lines', () => {
    const res = checkTitleText('A\nB\nC\nD');
    expect(res.error).toBe('tooManyLines');
    expect(res.widths).toEqual([2, 2, 2, 2]);
  });

  it('ignores empty lines at the end (an Enter after the last line)', () => {
    expect(checkTitleText('A\nB\nC\n').error).toBeUndefined();
    expect(checkTitleText('A\nB\nC\n').widths).toEqual([2, 2, 2]);
    expect(checkTitleText('A\nB\n').error).toBeUndefined();
    // inner empty lines still count
    expect(checkTitleText('A\n\n\nB').error).toBe('tooManyLines');
  });

  it('reports lines wider than 32 columns', () => {
    expect(checkTitleText('ABCDEFGHJLMNOPRS').widths).toEqual([32]);
    expect(checkTitleText('ABCDEFGHJLMNOPRS').error).toBeUndefined();
    expect(checkTitleText('ABCDEFGHJLMNOPRST').error).toBe('tooWide');
    expect(checkTitleText('I'.repeat(32)).error).toBeUndefined();
    expect(checkTitleText('I'.repeat(33)).error).toBe('tooWide');
    expect(checkTitleText('COPA INTERNACIONAL').error).toBe('tooWide');
    // trailing spaces are free, leading ones are not
    expect(checkTitleText('ABCDEFGHJLMNOPRS    ').error).toBeUndefined();
    expect(checkTitleText(' ABCDEFGHJLMNOPRS').error).toBe('tooWide');
    expect(checkTitleText('A\nABCDEFGHJLMNOPRST').widths).toEqual([2, 34]);
  });
});

describe('decodeTitleWords', () => {
  it('reads an all-blank tilemap as an empty title', () => {
    expect(decodeTitleWords(blankWords())).toBe('');
  });

  it('reads letters drawn at the 3 text rows and trims the lines', () => {
    const words = blankWords();
    drawGlyph(words, T.ROWS[0], 3, TITLE_FONT.C);
    drawGlyph(words, T.ROWS[0], 5, TITLE_FONT.U);
    drawGlyph(words, T.ROWS[0], 7, TITLE_FONT.P);
    drawGlyph(words, T.ROWS[2], 20, TITLE_FONT.I);
    drawGlyph(words, T.ROWS[2], 22, TITLE_FONT_DRAWN.K);
    expect(decodeTitleWords(words)).toBe('CUP\n\nI K');
  });

  it('keeps inner blank columns as spaces', () => {
    const words = blankWords();
    drawGlyph(words, T.ROWS[1], 0, TITLE_FONT.A);
    drawGlyph(words, T.ROWS[1], 4, TITLE_FONT.B);
    expect(decodeTitleWords(words)).toBe('\nA  B');
  });

  it('ignores the palette and priority bits of the cells', () => {
    const words = blankWords();
    drawGlyph(words, T.ROWS[0], 10, TITLE_FONT.S, 0x2400);
    drawGlyph(words, T.ROWS[0], 12, TITLE_FONT.E, 0x0000);
    expect(decodeTitleWords(words)).toBe('SE');
  });

  it('matches wide glyphs before 1-column ones and tells look-alikes apart', () => {
    const words = blankWords();
    let c = 0;
    for (const ch of 'CGEFPRDBUJ') {
      drawGlyph(words, T.ROWS[0], c, { ...TITLE_FONT, ...TITLE_FONT_DRAWN }[ch]);
      c += 2;
    }
    drawGlyph(words, T.ROWS[0], c, TITLE_FONT.I);
    drawGlyph(words, T.ROWS[0], c + 1, TITLE_FONT[1]);
    expect(decodeTitleWords(words)).toBe('CGEFPRDBUJI1');
  });

  it('turns unknown columns into "?"', () => {
    const words = blankWords();
    drawGlyph(words, T.ROWS[0], 0, TITLE_FONT.A);
    words[T.ROWS[0] * T.COLUMNS + 2] = T.PALETTE | 0x3ff;
    expect(decodeTitleWords(words)).toBe('A?');
    // tile 0 is not the blank tile: a zeroed tilemap is all unknown
    const zero = decodeTitleWords(new Uint16Array(1024));
    expect(zero.split('\n')).toEqual(Array(3).fill('?'.repeat(32)));
  });

  it('does not read a glyph cut by the right edge', () => {
    const words = blankWords();
    drawGlyph(words, T.ROWS[0], 31, [TITLE_FONT.A[0]]);
    expect(decodeTitleWords(words)).toBe('?');
  });
});

describe.skipIf(!existsSync(REAL_ROM))('mode titles (real ROM)', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
  const withHeader = () => {
    const data = readFileSync(REAL_ROM);
    const out = new Uint8Array(data.length + 512);
    out.set(data, 512);
    return new RomParser(out);
  };

  const ORIGINAL = {
    cup: 'INTERNATIONAL\nCUP',
    cupFinal: 'INTERNATIONAL\nCUP\nFINAL',
    cupTournament: 'INTERNATIONAL\nCUP\nTOURNAMENT',
    championship: 'CHAMPION  SHIP',
    worldSeries1: 'WORLD SERIES\n1ST  SEASON',
    worldSeries2: 'WORLD SERIES\n2ND  SEASON',
    special: 'SPECIAL GAME',
  };

  it('reads the 7 original titles', () => {
    const rom = load();
    const read = Object.fromEntries(TITLE_FIELDS.map((f) => [f.id, readTitleText(rom, f.offset)]));
    expect(read).toEqual(ORIGINAL);
    for (const text of Object.values(ORIGINAL)) expect(checkTitleText(text).error).toBeUndefined();
  });

  it('reads the titles of a ROM with a copier header', () => {
    const rom = withHeader();
    expect(rom.headerOffset).toBe(512);
    expect(readTitleText(rom, offsetOf('worldSeries2'))).toBe(ORIGINAL.worldSeries2);
  });

  it('rebuilds every original tilemap exactly from its text', () => {
    const rom = load();
    for (const f of TITLE_FIELDS) {
      const words = buildTitleWords(rom, f.offset, ORIGINAL[f.id]);
      expect(Array.from(words), f.id).toEqual(Array.from(readScreenWords(rom, f.offset)));
    }
  });

  it('round-trips every glyph through buildTitleWords and decodeTitleWords', () => {
    const rom = load();
    const offset = offsetOf('cup');
    const text = 'ABCDEFGHIJKLMN\nOPQRSTUVWXYZ12\nI1 B J  K';
    expect(checkTitleText(text).error).toBeUndefined();
    expect(decodeTitleWords(buildTitleWords(rom, offset, text))).toBe(text);
    expect(decodeTitleWords(buildTitleWords(rom, offset, 'copa\n\nfinal'))).toBe('COPA\n\nFINAL');
    // trailing spaces and empty last lines are not kept
    expect(decodeTitleWords(buildTitleWords(rom, offset, 'GOL  \n\n'))).toBe('GOL');
  });

  it('centres each line and only touches the text rows', () => {
    const rom = load();
    const offset = offsetOf('special');
    const orig = readScreenWords(rom, offset);
    const words = buildTitleWords(rom, offset, 'I\n\nAB');
    const at = (r, c) => words[r * T.COLUMNS + c];
    // width 1: column ceil(31 / 2) = 16; width 4: column 14
    expect(at(T.ROWS[0], 16)).toBe(T.PALETTE | TITLE_FONT.I[0][0]);
    expect(at(T.ROWS[0], 15)).toBe(T.BLANK);
    expect(at(T.ROWS[0], 17)).toBe(T.BLANK);
    expect(at(T.ROWS[2], 14)).toBe(T.PALETTE | TITLE_FONT.A[0][0]);
    expect(at(T.ROWS[2], 16)).toBe(T.PALETTE | TITLE_FONT.B[0][0]);
    for (let c = 0; c < T.COLUMNS; c++) expect(at(T.ROWS[1], c)).toBe(T.BLANK);
    const first = T.ROWS[0] * T.COLUMNS;
    const end = (T.ROWS[2] + 4) * T.COLUMNS;
    expect(Array.from(words.slice(0, first))).toEqual(Array.from(orig.slice(0, first)));
    expect(Array.from(words.slice(end))).toEqual(Array.from(orig.slice(end)));
  });

  it('skips characters without a glyph as one blank column (current behaviour)', () => {
    const rom = load();
    expect(decodeTitleWords(buildTitleWords(rom, offsetOf('cup'), 'A3B'))).toBe('A B');
  });

  it('writes a title and reads it back', () => {
    const rom = load();
    const offset = offsetOf('cup');
    const res = writeTitleScreen(rom, offset, 'copa\nINTERNACIONAL');
    expect(res.ok).toBe(true);
    expect(res.size).toBeGreaterThan(0);
    expect(res.size).toBeLessThanOrEqual(res.capacity);
    expect(readTitleText(rom, offset)).toBe('COPA\nINTERNACIONAL');
    // the other titles are untouched
    for (const f of TITLE_FIELDS)
      if (f.id !== 'cup') expect(readTitleText(rom, f.offset), f.id).toBe(ORIGINAL[f.id]);
    // and the original text goes back
    expect(writeTitleScreen(rom, offset, ORIGINAL.cup).ok).toBe(true);
    expect(readTitleText(rom, offset)).toBe(ORIGINAL.cup);
  });

  it('writes 3-line titles and an empty title', () => {
    const rom = load();
    const offset = offsetOf('cupTournament');
    expect(writeTitleScreen(rom, offset, 'SERIE MUNDIAL\nTEMPORADA 1\nTORNEIO').ok).toBe(true);
    expect(readTitleText(rom, offset)).toBe('SERIE MUNDIAL\nTEMPORADA 1\nTORNEIO');
    expect(writeTitleScreen(rom, offset, '').ok).toBe(true);
    expect(readTitleText(rom, offset)).toBe('');
  });

  it('refuses invalid titles without writing anything', () => {
    const rom = load();
    const before = Array.from(rom.getRomData());
    const offset = offsetOf('special');
    expect(writeTitleScreen(rom, offset, 'COPA 3')).toEqual({ ok: false, error: 'noGlyph' });
    expect(writeTitleScreen(rom, offset, 'A\nB\nC\nD')).toEqual({
      ok: false,
      error: 'tooManyLines',
    });
    expect(writeTitleScreen(rom, offset, 'COPA INTERNACIONAL')).toEqual({
      ok: false,
      error: 'tooWide',
    });
    expect(Array.from(rom.getRomData())).toEqual(before);
    expect(readTitleText(rom, offset)).toBe(ORIGINAL.special);
  });

  it('reads the 105 original font tiles from the block the pointer gives', () => {
    const rom = load();
    const tiles = readTitleFontTiles(rom);
    expect(tiles.length).toBe(TB.tiles * 32);
    expect(Array.from(tiles)).toEqual(Array.from(konamiDecompress(rom.getRomData(), TB.offset)));
    // tiles 0x59-0x5F are free (all zero) in the original set
    expect(tiles.slice(0x59 * 32, 0x60 * 32).every((b) => b === 0)).toBe(true);
    expect(Array.from(readTitleFontTiles(withHeader()))).toEqual(Array.from(tiles));
  });

  it('has none of the drawn letters installed in the original ROM', () => {
    expect(installedTitleGlyphs(load())).toEqual([]);
    expect(installedTitleGlyphs(withHeader())).toEqual([]);
  });

  it('lists the drawn letters a set of titles needs', () => {
    expect(titleFontNeeds(Object.values(ORIGINAL))).toEqual([]);
    expect(titleFontNeeds([])).toEqual([]);
    expect(titleFontNeeds(['viva', 'XUXA', 'KAKA'])).toEqual(['V', 'K', 'X']);
    // in TITLE_FONT_DRAWN order, each letter once
    expect(titleFontNeeds(['QZYXKV QQ'])).toEqual(['V', 'Y', 'K', 'Z', 'X', 'Q']);
    expect(titleFontNeeds(['BJ'])).toEqual([]);
  });

  it('installs drawn letters and keeps the original tiles', () => {
    const rom = load();
    const orig = readTitleFontTiles(rom);
    const res = writeTitleFont(rom, ['V', 'K', 'X']);
    expect(res.ok).toBe(true);
    expect(res.capacity).toBe(TB.capacity);
    expect(res.size).toBeLessThanOrEqual(TB.capacity);
    expect(installedTitleGlyphs(rom)).toEqual(['V', 'K', 'X']);
    const tiles = readTitleFontTiles(rom);
    // X ends at tile 0x76: the block grows up to it
    expect(tiles.length).toBe(0x77 * 32);
    expect(Array.from(tiles.slice(0, 0x59 * 32))).toEqual(Array.from(orig.slice(0, 0x59 * 32)));
    // the letter texture (0x60-0x68) is kept too
    expect(Array.from(tiles.slice(0x60 * 32, 0x69 * 32))).toEqual(
      Array.from(orig.slice(0x60 * 32, 0x69 * 32)),
    );
    // the rest of the block is 0xFF padding
    const block = rom.readBytes(TB.offset + res.size, TB.capacity - res.size);
    expect(block.every((b) => b === 0xff)).toBe(true);
  });

  it('installs each drawn letter on its own', () => {
    for (const ch of Object.keys(TITLE_FONT_DRAWN)) {
      const rom = load();
      expect(writeTitleFont(rom, [ch]).ok, ch).toBe(true);
      expect(installedTitleGlyphs(rom), ch).toEqual([ch]);
    }
  });

  it('replaces the installed letters instead of adding to them', () => {
    const rom = load();
    const orig = readTitleFontTiles(rom);
    expect(writeTitleFont(rom, ['Z']).ok).toBe(true);
    expect(installedTitleGlyphs(rom)).toEqual(['Z']);
    expect(writeTitleFont(rom, ['Q']).ok).toBe(true);
    expect(installedTitleGlyphs(rom)).toEqual(['Q']);
    expect(writeTitleFont(rom, []).ok).toBe(true);
    expect(installedTitleGlyphs(rom)).toEqual([]);
    expect(Array.from(readTitleFontTiles(rom))).toEqual(Array.from(orig));
  });

  it('works from the current block when the ROM has no original copy', () => {
    const rom = load();
    const orig = readTitleFontTiles(rom);
    expect(writeTitleFont(rom, ['K']).ok).toBe(true);
    const bare = {
      headerOffset: 0,
      readByte: (a) => rom.readByte(a),
      writeBytes: (a, b) => rom.writeBytes(a, b),
      getRomData: () => rom.getRomData(),
    };
    // K's tiles after the 105 original ones (0x69+) are dropped
    expect(writeTitleFont(bare, ['X']).ok).toBe(true);
    expect(installedTitleGlyphs(rom)).toEqual(['X']);
    expect(writeTitleFont(bare, []).ok).toBe(true);
    const tiles = readTitleFontTiles(rom);
    expect(tiles.length).toBe(TB.tiles * 32);
    expect(Array.from(tiles.slice(0, 0x59 * 32))).toEqual(Array.from(orig.slice(0, 0x59 * 32)));
    expect(Array.from(tiles.slice(0x60 * 32))).toEqual(Array.from(orig.slice(0x60 * 32)));
  });

  it('keeps stale drawn tiles 0x59-0x5F without an original copy (current behaviour)', () => {
    // Suspected bug: the fallback base is the current block, so tiles drawn in the free
    // slots 0x59-0x5F are never cleared and V (all its new tiles are there) stays "installed"
    const rom = load();
    const orig = readTitleFontTiles(rom);
    const bare = {
      headerOffset: 0,
      readByte: (a) => rom.readByte(a),
      writeBytes: (a, b) => rom.writeBytes(a, b),
      getRomData: () => rom.getRomData(),
    };
    expect(writeTitleFont(bare, ['V']).ok).toBe(true);
    expect(writeTitleFont(bare, []).ok).toBe(true);
    expect(installedTitleGlyphs(rom)).toEqual(['V']);
    expect(Array.from(readTitleFontTiles(rom))).not.toEqual(Array.from(orig));
    // with the original copy (RomParser) the same steps clear it
    const full = load();
    writeTitleFont(full, ['V']);
    writeTitleFont(full, []);
    expect(installedTitleGlyphs(full)).toEqual([]);
  });

  it('installs letters in a ROM with a copier header', () => {
    const rom = withHeader();
    expect(writeTitleFont(rom, ['K']).ok).toBe(true);
    expect(installedTitleGlyphs(rom)).toEqual(['K']);
    expect(readTitleText(rom, offsetOf('cup'))).toBe(ORIGINAL.cup);
  });

  it('fits about 3 drawn letters and refuses more without writing', () => {
    const rom = load();
    expect(writeTitleFont(rom, ['V', 'Y', 'K']).ok).toBe(true);
    expect(installedTitleGlyphs(rom)).toEqual(['V', 'Y', 'K']);
    const before = Array.from(rom.getRomData());
    for (const letters of [
      ['V', 'Y', 'K', 'X'],
      ['K', 'Z'],
      ['V', 'Y', 'K', 'Z', 'X', 'Q'],
    ]) {
      const res = writeTitleFont(rom, letters);
      expect(res.ok, letters.join('')).toBe(false);
      expect(res.error).toBeUndefined(); // no error code: the caller reports titleFontFull
      expect(res.capacity).toBe(TB.capacity);
      expect(res.size).toBeGreaterThan(TB.capacity);
    }
    expect(Array.from(rom.getRomData())).toEqual(before);
    expect(installedTitleGlyphs(rom)).toEqual(['V', 'Y', 'K']);
  });
});
