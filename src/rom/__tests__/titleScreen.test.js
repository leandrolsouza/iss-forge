import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  readTitleScreen,
  writeTitleColors,
  writeTitleTeam,
  applyTitleScreenUpdates,
  readTitleScreenBytes,
  restoreTitleScreenBytes,
  renderTitleScreen,
  TITLE_COLOR_IDS,
} from '../titleScreen';
import { TITLE_SCREEN, TEAMS } from '../constants';
import { readTitleTexts, writeTitleTexts, checkTitleTexts, pressStartAt } from '../titleScreenText';
import { readScreenWords } from '../menuScreens';
import { konamiDecompress } from '../KonamiCodec';
import { readLogoSprites } from '../titleLogo';
import { TITLE_LOGO_SPRITES } from '../titleScreenLayout';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const hasRealRom = existsSync(REAL_ROM);
const c = (r, g, b) => r | (g << 5) | (b << 10);
const team = (id) => TEAMS.findIndex((tm) => tm.id === id);
const word = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);

/** Blank 1 MB ROM with the title-screen palette words of the original */
function fakeRom() {
  const rom = new RomParser(new Uint8Array(0x100000));
  const put = (a, v) => {
    rom.writeByte(a, v & 0xff);
    rom.writeByte(a + 1, v >> 8);
  };
  put(0x2d49e, 0x739c); // sky
  for (let i = 0; i < 14; i++) put(0x2d4c0 + i * 2, c(31, 31 - i, 31)); // logoTop 1-14
  put(0x2d4dc, 0x8001); // logoTop outline: "1 x black" command
  for (let i = 0; i < 14; i++) put(0x2d4de + i * 2, c(31, 31 - i * 2, 0));
  put(0x2d4fa, 0x8001);
  // flash steps: brighter copies
  TITLE_SCREEN.LOGO_FLASH.forEach((base, k) => {
    for (let i = 0; i < 30; i++) put(base + i * 2, c(20 + k * 3, 20 + k * 3, 20 + k * 3));
  });
  for (let i = 0; i < 15; i++) put(0x2d5f4 + i * 2, 0x739c);
  rom.writeByte(TITLE_SCREEN.TEAM_LEFT, 2); // Italy (ordinal 1)
  rom.writeByte(TITLE_SCREEN.TEAM_RIGHT, 0x26); // Brazil (ordinal 19)
  return rom;
}

describe('title screen colours', () => {
  it('reads command words as black and the teams from the code bytes', () => {
    const s = readTitleScreen(fakeRom());
    expect(Object.keys(s.colors)).toEqual(TITLE_COLOR_IDS);
    expect(s.colors.sky).toEqual([0x739c]);
    expect(s.colors.logoTop).toHaveLength(15);
    expect(s.colors.logoTop[14]).toBe(0);
    expect(s.teams).toEqual({ left: team('ITALY'), right: team('BRAZIL') });
  });

  it('keeps command words that still match and replaces the ones that change', () => {
    const rom = fakeRom();
    const top = readTitleScreen(rom).colors.logoTop;
    writeTitleColors(
      rom,
      'logoTop',
      top.map((v, i) => (i === 0 ? c(1, 2, 3) : v)),
    );
    expect(word(rom, 0x2d4c0)).toBe(c(1, 2, 3));
    expect(word(rom, 0x2d4dc)).toBe(0x8001); // outline unchanged → command kept
    writeTitleColors(
      rom,
      'logoTop',
      top.map((v, i) => (i === 14 ? c(31, 31, 31) : v)),
    );
    expect(word(rom, 0x2d4dc)).toBe(0x7fff);
  });

  it('copies the sky colour into the fade-in fill', () => {
    const rom = fakeRom();
    writeTitleColors(rom, 'sky', [c(4, 8, 20)]);
    for (let i = 0; i < 15; i++) expect(word(rom, 0x2d5f4 + i * 2)).toBe(c(4, 8, 20));
  });

  it('moves the logo flash steps by the same difference', () => {
    const rom = fakeRom();
    const bottom = readTitleScreen(rom).colors.logoBottom;
    const before = bottom[0]; // (31, 31, 0)
    const flash = word(rom, TITLE_SCREEN.LOGO_FLASH[1] + 15 * 2); // bottom part, colour 1
    writeTitleColors(
      rom,
      'logoBottom',
      bottom.map((v, i) => (i === 0 ? c(0, 10, 31) : v)),
    );
    const ch = (v) => [v & 31, (v >> 5) & 31, v >> 10];
    const expected = ch(c(0, 10, 31)).map((n, k) =>
      Math.max(0, Math.min(31, n + ch(flash)[k] - ch(before)[k])),
    );
    expect(ch(word(rom, TITLE_SCREEN.LOGO_FLASH[1] + 15 * 2))).toEqual(expected);
    // the top part of the flash is untouched
    expect(word(rom, TITLE_SCREEN.LOGO_FLASH[1])).toBe(c(23, 23, 23));
  });

  it('rejects unknown groups and wrong sizes', () => {
    const rom = fakeRom();
    expect(() => writeTitleColors(rom, 'nope', [0])).toThrow();
    expect(() => writeTitleColors(rom, 'sky', [0, 0])).toThrow();
  });

  it('writes the teams as ordinal x 2', () => {
    const rom = fakeRom();
    writeTitleTeam(rom, 'left', team('SCOTLAND')); // ordinal 5
    writeTitleTeam(rom, 'right', team('SUPERSTAR')); // ordinal 26
    expect(rom.readByte(TITLE_SCREEN.TEAM_LEFT)).toBe(10);
    expect(rom.readByte(TITLE_SCREEN.TEAM_RIGHT)).toBe(52);
    expect(readTitleScreen(rom).teams).toEqual({
      left: team('SCOTLAND'),
      right: team('SUPERSTAR'),
    });
    expect(() => writeTitleTeam(rom, 'left', 99)).toThrow();
  });

  it('restores the exact bytes from a snapshot', () => {
    const rom = fakeRom();
    const snap = readTitleScreenBytes(rom);
    const before = Array.from(rom.getRomData());
    applyTitleScreenUpdates(rom, {
      sky: [c(1, 1, 1)],
      logoTop: Array(15).fill(c(31, 0, 0)),
      'team:left': team('GERMANY'),
    });
    expect(Array.from(rom.getRomData())).not.toEqual(before);
    restoreTitleScreenBytes(rom, snap);
    expect(Array.from(rom.getRomData())).toEqual(before);
  });
});

describe.skipIf(!hasRealRom)('title screen (real ROM)', () => {
  const load = () => new RomParser(readFileSync(REAL_ROM));

  it('decodes the logo sprite list exactly as the game puts it in the OAM', () => {
    expect(readLogoSprites(load())).toEqual(TITLE_LOGO_SPRITES);
  });

  it('reads the original colours and teams', () => {
    const s = readTitleScreen(load());
    expect(s.colors.sky).toEqual([c(28, 28, 28)]);
    expect(s.colors.copyright).toEqual([c(31, 26, 0), c(31, 22, 0), c(31, 31, 0)]);
    expect(s.colors.stroke[14]).toBe(c(31, 0, 0));
    expect(s.colors.logoTop[0]).toBe(c(31, 31, 31));
    expect(s.colors.logoTop[14]).toBe(0); // outline command
    expect(s.colors.grass[0]).toBe(c(15, 19, 10));
    expect(s.teams).toEqual({ left: team('ITALY'), right: team('BRAZIL') });
  });

  it('renders the screen like the game (spot checks)', () => {
    const rom = load();
    const { width, height, data } = renderTitleScreen(rom);
    expect([width, height]).toEqual([256, 224]);
    const px = (x, y) => Array.from(data.slice((y * 256 + x) * 4, (y * 256 + x) * 4 + 3));
    expect(px(0, 0)).toEqual([224, 224, 224]); // sky
    // the brush stroke covers a big area behind the logo
    const s0 = readTitleScreen(rom);
    const magenta = renderTitleScreen(rom, {
      ...s0,
      colors: { ...s0.colors, stroke: Array(15).fill(c(31, 0, 31)) },
    });
    let strokePx = 0;
    for (let i = 0; i < magenta.data.length; i += 4)
      if (magenta.data[i] === 248 && magenta.data[i + 1] === 0 && magenta.data[i + 2] === 248)
        strokePx++;
    expect(strokePx).toBeGreaterThan(1500);
    // edits show up in the preview without touching the ROM
    const s = readTitleScreen(rom);
    const blue = renderTitleScreen(rom, { ...s, colors: { ...s.colors, sky: [c(0, 0, 31)] } });
    expect(Array.from(blue.data.slice(0, 3))).toEqual([0, 0, 248]);
    expect(readTitleScreen(rom).colors.sky).toEqual([c(28, 28, 28)]);
  });

  it('only touches the snapshot ranges', () => {
    const rom = load();
    const s = readTitleScreen(rom);
    const before = rom.getRomData().slice();
    applyTitleScreenUpdates(rom, {
      ...Object.fromEntries(TITLE_COLOR_IDS.map((id) => [id, s.colors[id].map(() => c(9, 9, 9))])),
      'team:left': team('GERMANY'),
      'team:right': team('ARGENTINA'),
    });
    const after = rom.getRomData();
    const inRanges = (a) => TITLE_SCREEN.RANGES.some(([s0, e]) => a >= s0 && a < e);
    for (let a = 0; a < after.length; a++)
      if (after[a] !== before[a]) expect(inRanges(a)).toBe(true);
  });
});

describe('title screen texts (checks)', () => {
  it('accepts the Konami font in PRESS START and more characters in the copyright', () => {
    expect(checkTitleTexts({ pressStart: 'APERTE START' }).error).toBeUndefined();
    expect(checkTitleTexts({ pressStart: 'PRESS 2' })).toMatchObject({
      error: 'noGlyph',
      invalid: ['2'],
    });
    expect(checkTitleTexts({ pressStart: '   ' }).error).toBe('empty');
    expect(checkTitleTexts({ copyright: '©2026 ISS FORGE (V1.0)!' }).error).toBeUndefined();
    expect(checkTitleTexts({ copyright: 'A\nB\nC\nD' }).error).toBe('tooManyLines');
    expect(checkTitleTexts({ copyright: 'X'.repeat(33) }).error).toBe('tooWide');
    expect(checkTitleTexts({ copyright: 'ÇÃO' })).toMatchObject({ error: 'noGlyph' });
    // lower case is written as upper case
    expect(checkTitleTexts({ copyright: 'konami', pressStart: 'start' }).error).toBeUndefined();
  });
});

describe.skipIf(!hasRealRom)('title screen texts (real ROM)', () => {
  const load = () => new RomParser(readFileSync(REAL_ROM));
  const X = TITLE_SCREEN.TEXT;
  const ptr = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);

  it('reads the original texts', () => {
    expect(readTitleTexts(load())).toEqual({
      copyright: '©1995 KONAMI\nALL RIGHT RESERVED.\nLICENCED BY NINTENDO',
      pressStart: 'PRESS START',
    });
  });

  it('writes the copyright, drawing extra characters in the shaded style', () => {
    const rom = load();
    const res = writeTitleTexts(rom, { copyright: '©1995-2026 KONAMI\nTRADUCAO: ISS FORGE' });
    expect(res.ok).toBe(true);
    expect(readTitleTexts(rom).copyright).toBe('©1995-2026 KONAMI\nTRADUCAO: ISS FORGE');
    // centred: 17 letters start at column 8
    const words = readScreenWords(rom, X.MAP);
    expect(words[24 * 32 + 8] & 0x3ff).toBe(0x1f); // ©
    expect(words[24 * 32 + 13] & 0x3ff).toBe(0x2d); // "-" = plain font tile
    expect(words[26 * 32 + 10] & 0x3ff).toBe(0); // third line cleared
    // "2" (tile 0x32) now uses colour 2 on its first row, like the Konami letters
    const lo = rom.readByte(0x10050) | (rom.readByte(0x10051) << 8);
    const at = (rom.readByte(0x10052) & 0x7f) * 0x8000 + (lo - 0x8000);
    const font = konamiDecompress(rom.getRomData(), at);
    expect(font[0x32 * 16]).toBe(0); // plane 0 empty on row 0
    expect(font[0x32 * 16 + 1]).not.toBe(0); // plane 1 = ink
  });

  it('goes back to the original bytes when the original texts are written again', () => {
    const rom = load();
    const orig = readTitleTexts(rom);
    const h = (a, n) => Array.from(rom.readBytes(a, n));
    const mapBefore = h(X.MAP, 225);
    const fontBefore = h(X.FONT, 504);
    const pressBefore = h(X.PRESS_HOME, 14);
    writeTitleTexts(rom, { copyright: '2026\n#1', pressStart: 'APERTE O START' });
    writeTitleTexts(rom, orig);
    expect(readTitleTexts(rom)).toEqual(orig);
    expect(h(X.MAP, 225)).toEqual(mapBefore);
    expect(h(X.FONT, 504)).toEqual(fontBefore);
    expect(h(X.PRESS_HOME, 14)).toEqual(pressBefore);
    X.PRESS_POINTERS.forEach((p) => expect(ptr(rom, p)).toBe(0x8645));
    expect(h(X.PRESS_SPARE, 0x10000 - X.PRESS_SPARE).every((b) => b === 0xff)).toBe(true);
  });

  it('moves a long PRESS START to the end of bank $81 and back', () => {
    const rom = load();
    expect(writeTitleTexts(rom, { pressStart: 'PRESSIONE START' }).ok).toBe(true);
    expect(pressStartAt(rom)).toBe(X.PRESS_SPARE);
    X.PRESS_POINTERS.forEach((p) => expect(ptr(rom, p)).toBe(X.PRESS_SPARE));
    expect(readTitleTexts(rom).pressStart).toBe('PRESSIONE START');
    // centred on row 14: (32 - 15) / 2 = 8
    expect(ptr(rom, X.PRESS_SPARE)).toBe(0x5c00 + 14 * 32 + 8);
    expect(writeTitleTexts(rom, { pressStart: 'START' }).ok).toBe(true);
    expect(pressStartAt(rom)).toBe(X.PRESS_HOME);
    expect(readTitleTexts(rom).pressStart).toBe('START');
  });

  it('leaves the ROM untouched when a text is rejected', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    expect(writeTitleTexts(rom, { copyright: 'OK', pressStart: 'NO 2' }).ok).toBe(false);
    expect(rom.getRomData()).toEqual(before);
  });
});
