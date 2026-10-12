import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import { TITLE_SCREEN, MENU_SCREENS, MENU_FREE_SPACE } from '../constants';
import {
  TITLE_COPYRIGHT_CHARS,
  TITLE_PRESS_CHARS,
  checkTitleTexts,
  readTitleTexts,
  writeTitleTexts,
  pressStartAt,
} from '../titleScreenText';
import { readScreenWords, screenLocation } from '../menuScreens';
import { konamiDecompress } from '../KonamiCodec';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const hasRealRom = existsSync(REAL_ROM);
const X = TITLE_SCREEN.TEXT;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ORIGINAL = {
  copyright: '©1995 KONAMI\nALL RIGHT RESERVED.\nLICENCED BY NINTENDO',
  pressStart: 'PRESS START',
};

/** Konami (shaded) font tile of a letter: A = 1 ... Z = 26 */
const letter = (ch) => ch.charCodeAt(0) - 64;
const ptr = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
const screenOf = (offset) => MENU_SCREENS.find((s) => s.offset === offset);

describe('title screen character sets', () => {
  it('TITLE_PRESS_CHARS is the shaded Konami font: space, A-Z, ".", "1", "5", "9", "©"', () => {
    expect([...TITLE_PRESS_CHARS].sort().join('')).toBe(` .159${LETTERS}©`);
    expect(new Set(TITLE_PRESS_CHARS).size).toBe(TITLE_PRESS_CHARS.length);
    for (const ch of '0234678-,!:@a') expect(TITLE_PRESS_CHARS).not.toContain(ch);
  });

  it('TITLE_COPYRIGHT_CHARS adds the plain font 0x21-0x5F (without "@"), sorted', () => {
    const plain = Array.from({ length: 0x3f }, (_, i) => String.fromCharCode(0x21 + i))
      .filter((ch) => ch !== '@')
      .join('');
    expect(TITLE_COPYRIGHT_CHARS).toBe(` ${plain}©`);
    expect(TITLE_COPYRIGHT_CHARS).toHaveLength(64);
    expect([...TITLE_COPYRIGHT_CHARS].sort().join('')).toBe(TITLE_COPYRIGHT_CHARS);
    for (const ch of TITLE_PRESS_CHARS) expect(TITLE_COPYRIGHT_CHARS).toContain(ch);
    for (const ch of '@`{|}~abcÇ\t') expect(TITLE_COPYRIGHT_CHARS).not.toContain(ch);
  });
});

describe('checkTitleTexts', () => {
  it('returns no error and an empty invalid list for valid texts', () => {
    expect(checkTitleTexts({ copyright: ORIGINAL.copyright, pressStart: 'PRESS START' })).toEqual({
      invalid: [],
    });
    expect(checkTitleTexts({ copyright: '100% [ISS] #1 <2026>?', pressStart: '©1995.' })).toEqual({
      invalid: [],
    });
  });

  it('checks nothing when no text is given', () => {
    expect(checkTitleTexts({})).toEqual({ invalid: [] });
  });

  it('accepts lower case (checked as upper case)', () => {
    expect(checkTitleTexts({ copyright: 'konami', pressStart: 'press start' })).toEqual({
      invalid: [],
    });
  });

  it('reports noGlyph with every invalid character once, upper-cased', () => {
    expect(checkTitleTexts({ copyright: 'çãÇ @ OK @' })).toEqual({
      error: 'noGlyph',
      invalid: ['Ç', 'Ã', '@'],
    });
    expect(checkTitleTexts({ pressStart: 'PRESS-2 START!' })).toEqual({
      error: 'noGlyph',
      invalid: ['-', '2', '!'],
    });
  });

  it('merges the invalid characters of both texts', () => {
    expect(checkTitleTexts({ copyright: '@ 2', pressStart: '2 @ 3' })).toEqual({
      error: 'noGlyph',
      invalid: ['@', '2', '3'],
    });
  });

  it('gives noGlyph priority over the other errors', () => {
    expect(checkTitleTexts({ copyright: 'A\nB\nC\n@' }).error).toBe('noGlyph');
    expect(checkTitleTexts({ copyright: '@'.repeat(40) }).error).toBe('noGlyph');
    expect(checkTitleTexts({ copyright: 'OK', pressStart: '2'.repeat(40) }).error).toBe('noGlyph');
  });

  it('reports tooManyLines above 3 copyright lines', () => {
    expect(checkTitleTexts({ copyright: 'A\nB\nC' }).error).toBeUndefined();
    expect(checkTitleTexts({ copyright: 'A\nB\nC\nD' })).toEqual({
      error: 'tooManyLines',
      invalid: [],
    });
    // inner empty lines count; empty lines at the end (an Enter after the last line) do not
    expect(checkTitleTexts({ copyright: 'A\n\n\nB' }).error).toBe('tooManyLines');
    expect(checkTitleTexts({ copyright: 'A\n\n\n' }).error).toBeUndefined();
    expect(checkTitleTexts({ copyright: 'A\nB\nC\n' }).error).toBeUndefined();
  });

  it('accepts Windows line endings (lines are trimmed)', () => {
    expect(checkTitleTexts({ copyright: 'A\r\nB\r\nC' })).toEqual({ invalid: [] });
  });

  it('reports tooWide above 32 letters (after trimming)', () => {
    expect(checkTitleTexts({ copyright: 'X'.repeat(32) }).error).toBeUndefined();
    expect(checkTitleTexts({ copyright: `  ${'X'.repeat(32)}  ` }).error).toBeUndefined();
    expect(checkTitleTexts({ copyright: `OK\n${'X'.repeat(33)}` })).toEqual({
      error: 'tooWide',
      invalid: [],
    });
    expect(checkTitleTexts({ pressStart: 'X'.repeat(32) }).error).toBeUndefined();
    expect(checkTitleTexts({ pressStart: 'X'.repeat(33) }).error).toBe('tooWide');
  });

  it('reports empty for a blank PRESS START, but accepts an empty copyright', () => {
    expect(checkTitleTexts({ pressStart: '' }).error).toBe('empty');
    expect(checkTitleTexts({ pressStart: '  \t ' }).error).toBe('empty');
    expect(checkTitleTexts({ copyright: '' })).toEqual({ invalid: [] });
  });

  it('keeps the first structural error (copyright before PRESS START)', () => {
    expect(checkTitleTexts({ copyright: 'A\nB\nC\nD', pressStart: '' }).error).toBe('tooManyLines');
    expect(checkTitleTexts({ copyright: 'X'.repeat(33), pressStart: '' }).error).toBe('tooWide');
    expect(checkTitleTexts({ copyright: 'OK', pressStart: '' }).error).toBe('empty');
  });
});

describe.skipIf(!hasRealRom)('title screen texts on the real ROM', () => {
  const load = () => new RomParser(readFileSync(REAL_ROM));

  /** Addresses that differ between two buffers */
  const diff = (a, b) => {
    const out = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.push(i);
    return out;
  };

  /** Size of the original slot of a block (block + trailing 0xFF), like menuScreens */
  const slot = (rom, offset) => {
    let n = ptr(rom, offset) & 0x7fff;
    while (n < 0x1000 && rom.readByte(offset + n) === 0xff) n++;
    return [offset, offset + n];
  };

  const fontNow = (rom) =>
    konamiDecompress(rom.getRomData(), screenLocation(rom, screenOf(X.FONT)));

  it('reads the original copyright lines and PRESS START', () => {
    const rom = load();
    expect(readTitleTexts(rom)).toEqual(ORIGINAL);
  });

  it('pressStartAt follows the second LDX pointer (original: $81:8645)', () => {
    const rom = load();
    expect(pressStartAt(rom)).toBe(X.PRESS_HOME);
    X.PRESS_POINTERS.forEach((p) => expect(ptr(rom, p)).toBe(X.PRESS_HOME));
    // original string: VRAM $5DCA (row 14, column 10) + "PRESS START" + 0xFF
    expect(Array.from(rom.readBytes(X.PRESS_HOME, 14))).toEqual([
      0xca,
      0x5d,
      ...[...'PRESS START'].map((ch) => (ch === ' ' ? 0 : letter(ch))),
      0xff,
    ]);
    rom.writeByte(X.PRESS_POINTERS[1], 0xdd);
    rom.writeByte(X.PRESS_POINTERS[1] + 1, 0xff);
    expect(pressStartAt(rom)).toBe(0xffdd);
  });

  it('changes no byte when the original texts (or nothing) are written', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    expect(writeTitleTexts(rom, {})).toEqual({ ok: true });
    expect(writeTitleTexts(rom, ORIGINAL)).toEqual({ ok: true });
    expect(diff(rom.getRomData(), before)).toEqual([]);
  });

  it('writes lower case as upper case', () => {
    const rom = load();
    const res = writeTitleTexts(rom, {
      copyright: 'iss forge\nfan edition 2026',
      pressStart: 'push start',
    });
    expect(res).toEqual({ ok: true });
    expect(readTitleTexts(rom)).toEqual({
      copyright: 'ISS FORGE\nFAN EDITION 2026',
      pressStart: 'PUSH START',
    });
  });

  it('writes 3 centred copyright lines and leaves the rest of the map alone', () => {
    const rom = load();
    const orig = readScreenWords(rom, X.MAP);
    const text = 'LINE ONE\nLINE 2: TWO\nLINE #1.5';
    expect(writeTitleTexts(rom, { copyright: text }).ok).toBe(true);
    expect(readTitleTexts(rom)).toEqual({ copyright: text, pressStart: 'PRESS START' });
    const words = readScreenWords(rom, X.MAP);
    const at = (r, c) => words[r * 32 + c];
    // ceil((32 - length) / 2): 8 -> 12, 11 -> 11, 9 -> 12
    expect(at(24, 11)).toBe(X.ATTR);
    expect(at(24, 12)).toBe(X.ATTR | letter('L'));
    expect(at(24, 19)).toBe(X.ATTR | letter('E'));
    expect(at(24, 20)).toBe(X.ATTR);
    expect(at(25, 11)).toBe(X.ATTR | letter('L'));
    expect(at(25, 16)).toBe(X.ATTR | 0x32); // "2": plain font tile (ASCII)
    expect(at(25, 17)).toBe(X.ATTR | 0x3a); // ":"
    expect(at(26, 12)).toBe(X.ATTR | letter('L'));
    expect(at(26, 17)).toBe(X.ATTR | 0x23); // "#"
    expect(at(26, 18)).toBe(X.ATTR | 0x1c); // "1": shaded font tile
    expect(at(26, 19)).toBe(X.ATTR | 0x1b); // ".": shaded font tile
    expect(at(26, 20)).toBe(X.ATTR | 0x1d); // "5": shaded font tile
    // every cell of the copyright rows has the copyright attribute
    for (const r of X.MAP_ROWS) for (let c = 0; c < 32; c++) expect(at(r, c) & ~0x3ff).toBe(X.ATTR);
    // rows outside the copyright are kept
    for (let i = 0; i < 1024; i++) {
      if (!X.MAP_ROWS.includes(Math.floor(i / 32))) expect(words[i]).toBe(orig[i]);
    }
  });

  it('keeps empty lines in the middle, internal spaces and an empty copyright', () => {
    const rom = load();
    expect(writeTitleTexts(rom, { copyright: '  TOP  \n\nBOTTOM  A  B' }).ok).toBe(true);
    expect(readTitleTexts(rom).copyright).toBe('TOP\n\nBOTTOM  A  B');
    expect(writeTitleTexts(rom, { copyright: '' }).ok).toBe(true);
    expect(readTitleTexts(rom).copyright).toBe('');
    const words = readScreenWords(rom, X.MAP);
    for (const r of X.MAP_ROWS) for (let c = 0; c < 32; c++) expect(words[r * 32 + c]).toBe(X.ATTR);
  });

  it('writes a 32-letter copyright line from column 0', () => {
    const rom = load();
    const line = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
    expect(writeTitleTexts(rom, { copyright: line }).ok).toBe(true);
    expect(readTitleTexts(rom).copyright).toBe(line);
    expect(readScreenWords(rom, X.MAP)[24 * 32] & 0x3ff).toBe(letter('A'));
  });

  it('redraws only the extra characters, with the shaded row colours', () => {
    const rom = load();
    const base = fontNow(rom);
    expect(writeTitleTexts(rom, { copyright: '2-2 (C)' }).ok).toBe(true);
    const font = fontNow(rom);
    expect(font).toHaveLength(base.length);
    const redrawn = ['2', '-', '(', 'C', ')']
      .filter((ch) => ch !== 'C') // C is a shaded font letter: its plain tile stays
      .map((ch) => ch.charCodeAt(0));
    for (let t = 0; t < base.length / 16; t++) {
      for (let y = 0; y < 8; y++) {
        const [p0, p1] = [font[t * 16 + y * 2], font[t * 16 + y * 2 + 1]];
        if (!redrawn.includes(t)) {
          expect([p0, p1]).toEqual([base[t * 16 + y * 2], base[t * 16 + y * 2 + 1]]);
          continue;
        }
        const ink = base[t * 16 + y * 2] | base[t * 16 + y * 2 + 1];
        const colour = X.GLYPH_ROW_COLORS[y];
        expect(p0).toBe(colour & 1 ? ink : 0);
        expect(p1).toBe(colour & 2 ? ink : 0);
      }
    }
  });

  it('draws the extra characters from the original font every time', () => {
    const rom = load();
    const base = fontNow(rom);
    writeTitleTexts(rom, { copyright: '2026' });
    writeTitleTexts(rom, { copyright: '-' });
    const font = fontNow(rom);
    const tile = (f, ch) => Array.from(f.slice(ch.charCodeAt(0) * 16, ch.charCodeAt(0) * 16 + 16));
    expect(tile(font, '2')).toEqual(tile(base, '2')); // no longer used: original again
    expect(tile(font, '-')).not.toEqual(tile(base, '-'));
  });

  it('only touches the map/font slots, free space and their pointers for the copyright', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    const areas = [
      slot(rom, X.MAP),
      slot(rom, X.FONT),
      ...MENU_FREE_SPACE,
      ...[X.MAP, X.FONT].flatMap((o) => screenOf(o).pointers.map((p) => [p, p + 3])),
    ];
    const res = writeTitleTexts(rom, {
      copyright: 'HELLO, WORLD! 2026\n(C) 2026 FOO & BAR <ISS>\n100% #1 [TEST] ^_^ $0.99?',
    });
    expect(res.ok).toBe(true);
    const changed = diff(rom.getRomData(), before);
    expect(changed.length).toBeGreaterThan(0);
    const outside = changed.filter((a) => !areas.some(([s, e]) => a >= s && a < e));
    expect(outside).toEqual([]);
  });

  it('keeps a PRESS START of up to 11 letters in its slot, centred with spaces', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    expect(writeTitleTexts(rom, { pressStart: '  start ' })).toEqual({ ok: true });
    expect(pressStartAt(rom)).toBe(X.PRESS_HOME);
    expect(readTitleTexts(rom).pressStart).toBe('START');
    // 11 cells from column 10, "START" in the middle (3 spaces before, 3 after)
    expect(Array.from(rom.readBytes(X.PRESS_HOME, 14))).toEqual([
      0xca,
      0x5d,
      0,
      0,
      0,
      ...[...'START'].map(letter),
      0,
      0,
      0,
      0xff,
    ]);
    expect(writeTitleTexts(rom, { pressStart: 'HELLO WORLD' }).ok).toBe(true);
    expect(pressStartAt(rom)).toBe(X.PRESS_HOME);
    expect(readTitleTexts(rom).pressStart).toBe('HELLO WORLD');
    const changed = diff(rom.getRomData(), before);
    expect(changed.every((a) => a >= X.PRESS_HOME + 2 && a < X.PRESS_HOME + 13)).toBe(true);
  });

  it('moves a PRESS START of 12-32 letters to the end of bank $81', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    const long = 'PRESS BUTTON';
    expect(writeTitleTexts(rom, { pressStart: long }).ok).toBe(true);
    expect(pressStartAt(rom)).toBe(X.PRESS_SPARE);
    X.PRESS_POINTERS.forEach((p) => expect(ptr(rom, p)).toBe(X.PRESS_SPARE));
    expect(readTitleTexts(rom).pressStart).toBe(long);
    // floor((32 - 12) / 2) = column 10
    expect(ptr(rom, X.PRESS_SPARE)).toBe(0x5c00 + 14 * 32 + 10);
    expect(rom.readByte(X.PRESS_SPARE + 2 + long.length)).toBe(0xff);
    // the full 32 letters fill the reserved area up to the end of the bank
    const max = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ.159 ©';
    expect(writeTitleTexts(rom, { pressStart: max }).ok).toBe(true);
    expect(readTitleTexts(rom).pressStart).toBe(max);
    expect(ptr(rom, X.PRESS_SPARE)).toBe(0x5c00 + 14 * 32);
    expect(rom.readByte(0xffff)).toBe(0xff);
    // a shorter long text clears the rest of the area
    expect(writeTitleTexts(rom, { pressStart: long }).ok).toBe(true);
    const tail = Array.from(rom.readBytes(X.PRESS_SPARE + 3 + long.length, 32 - long.length));
    expect(tail.every((b) => b === 0xff)).toBe(true);
    // only the string areas and the two LDX operands change
    const areas = [
      [X.PRESS_HOME, X.PRESS_HOME + 14],
      [X.PRESS_SPARE, 0x10000],
      ...X.PRESS_POINTERS.map((p) => [p, p + 2]),
    ];
    const changed = diff(rom.getRomData(), before);
    expect(changed.every((a) => areas.some(([s, e]) => a >= s && a < e))).toBe(true);
  });

  it('rejects invalid texts without writing anything', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    expect(writeTitleTexts(rom, { copyright: 'OK 2026', pressStart: 'PRESS 2' })).toEqual({
      ok: false,
      error: 'noGlyph',
      invalid: ['2'],
    });
    expect(writeTitleTexts(rom, { copyright: 'A\nB\nC\nD' })).toEqual({
      ok: false,
      error: 'tooManyLines',
      invalid: [],
    });
    expect(writeTitleTexts(rom, { copyright: 'X'.repeat(33) })).toMatchObject({
      ok: false,
      error: 'tooWide',
    });
    expect(writeTitleTexts(rom, { pressStart: ' ' })).toMatchObject({ ok: false, error: 'empty' });
    expect(diff(rom.getRomData(), before)).toEqual([]);
  });

  it('fails with noSpace when the reserved area is in use, rolling back the copyright', () => {
    const rom = load();
    rom.writeByte(X.PRESS_SPARE + 5, 0x00); // something else lives there
    const before = rom.getRomData().slice();
    const res = writeTitleTexts(rom, { copyright: 'NEW 2026', pressStart: 'PRESSIONE START' });
    expect(res).toEqual({ ok: false, error: 'noSpace' });
    expect(diff(rom.getRomData(), before)).toEqual([]);
    expect(readTitleTexts(rom)).toEqual(ORIGINAL);
  });

  it('clears the reserved area when a short PRESS START is written (current behaviour)', () => {
    // The area is reserved for this text (MENU_FREE_SPACE stops before it), so a short
    // PRESS START overwrites it with 0xFF without checking what is there.
    const rom = load();
    rom.writeByte(X.PRESS_SPARE + 5, 0x00);
    expect(writeTitleTexts(rom, { pressStart: 'START' }).ok).toBe(true);
    expect(rom.readByte(X.PRESS_SPARE + 5)).toBe(0xff);
  });

  it('works the same on a ROM with a 512-byte copier header', () => {
    const plain = load();
    const raw = readFileSync(REAL_ROM);
    const withHeader = new Uint8Array(raw.length + 512);
    withHeader.set(raw, 512);
    const rom = new RomParser(withHeader);
    expect(rom.headerOffset).toBe(512);
    expect(readTitleTexts(rom)).toEqual(ORIGINAL);
    const texts = { copyright: '©2026 ISS FORGE\n(V1.0)', pressStart: 'PRESSIONE START' };
    expect(writeTitleTexts(plain, texts).ok).toBe(true);
    expect(writeTitleTexts(rom, texts).ok).toBe(true);
    expect(readTitleTexts(rom)).toEqual(readTitleTexts(plain));
    expect(diff(rom.getRomData().subarray(512), plain.getRomData())).toEqual([]);
    expect(Array.from(rom.getRomData().subarray(0, 512)).every((b) => b === 0)).toBe(true);
  });

  it('round-trips without an original copy (no getOriginalData)', () => {
    const parser = load();
    const rom = {
      headerOffset: 0,
      readByte: (a) => parser.readByte(a),
      writeByte: (a, v) => parser.writeByte(a, v),
      readBytes: (a, n) => parser.readBytes(a, n),
      writeBytes: (a, b) => parser.writeBytes(a, b),
      getRomData: () => parser.getRomData(),
    };
    expect(readTitleTexts(rom)).toEqual(ORIGINAL);
    const texts = { copyright: '2026 FORGE\nALL RIGHTS: OK', pressStart: 'GO' };
    expect(writeTitleTexts(rom, texts)).toEqual({ ok: true });
    expect(readTitleTexts(rom)).toEqual(texts);
  });
});
