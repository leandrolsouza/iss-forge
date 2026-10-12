import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import { TEAMS, MENU_SCREENS } from '../constants';
import {
  readCgramBlob,
  buildTextVram,
  boxWords,
  fixedWords,
  renderBoxText,
  renderFixedText,
  renderMenuText,
  TEXT_PALETTES,
  BOX_FONT_TABLE,
} from '../textRender';
import { encodeScenarioText } from '../scenario';
import { layoutFixed, encodeIss } from '../gameTexts';
import { readScreenWords, buildScreenWords, readMenuScreens } from '../menuScreens';
import { encodeTeamDescription, readTeamDescriptionRaw } from '../teamDescription';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const idx = (id) => TEAMS.findIndex((t) => t.id === id);

/** Minimal ROM: font table entries for 'A' and 'B' */
function fakeRom() {
  const data = new Uint8Array(0x20000);
  data[BOX_FONT_TABLE + 0x41] = 0x70;
  data[BOX_FONT_TABLE + 0x42] = 0x71;
  data[BOX_FONT_TABLE + 0x20] = 0x00;
  return new RomParser(data);
}

describe('text layout (tilemap words)', () => {
  it('boxWords: FE colour, FD new line, wrap at the column limit, FF end', () => {
    const rom = fakeRom();
    const w = boxWords(
      rom,
      [0xfe, 0x2c, 0x41, 0xfe, 0x20, 0xfd, 0x41, 0x42, 0x41, 0xff, 0x42],
      3,
      2,
    );
    expect(w[0]).toBe(0x70 | 0x2c00); // palette 3
    expect(w[1]).toBe(0x2000); // rest of line 1 blank
    expect([w[2], w[3]]).toEqual([0x70 | 0x2000, 0x71 | 0x2000]);
    expect(w[4]).toBe(0x70 | 0x2000); // wrapped to line 3
    expect(w[5]).toBe(0x2000); // FF: nothing after it
  });

  it('fixedWords: 2 rows per line, code 0 blank', () => {
    const rom = fakeRom();
    const w = fixedWords(rom, [0, 0x6c], 1, 2);
    expect(w).toHaveLength(4);
    expect(w[0]).toBe(0x2000);
    expect(w[1] & 0x3ff).toBeGreaterThan(0);
    expect(w[3] & 0x3ff).toBeGreaterThan(0);
  });
});

describe.skipIf(!existsSync(REAL_ROM))('text rendering (real ROM)', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
  const opaque = (img) => {
    let n = 0;
    for (let i = 3; i < img.data.length; i += 4) n += img.data[i] ? 1 : 0;
    return n;
  };
  const distinct = (img) => {
    const s = new Set();
    for (let i = 0; i < img.data.length; i += 4)
      s.add((img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]);
    return s.size;
  };

  it('reads the selection screen palettes seen in the CGRAM dumps', () => {
    const cg = readCgramBlob(load(), TEXT_PALETTES.selection);
    expect(Array.from(cg.slice(0, 8))).toEqual([
      0x1804, 0x7bfe, 0x7690, 0x7940, 0x2dd2, 0x73fc, 0x4f8c, 0x05a0,
    ]);
    expect(Array.from(cg.slice(13, 16))).toEqual([0x7f9f, 0x665f, 0x3016]); // palette 3 (pink)
    expect(Array.from(cg.slice(17, 20))).toEqual([0x7f9e, 0x7a39, 0x5c11]); // row 1: colour 0 skipped
  });

  it('loads the 8x8 and 8x16 fonts into VRAM', () => {
    const vram = buildTextVram(load());
    const tile = (t) => vram.slice(0x8000 + t * 16, 0x8000 + t * 16 + 16);
    expect(tile(0x70).some(Boolean)).toBe(true); // 8x8 "A"
    expect(tile(0xb4).some(Boolean)).toBe(true); // 8x16 font
    expect(tile(0).some(Boolean)).toBe(false); // blank
  });

  it('draws box texts, fixed texts and menu screens', () => {
    const rom = load();
    const scen = rom.readScenarios()[0];
    const box = renderBoxText(rom, encodeScenarioText(scen.text, 23).bytes, {
      lines: 8,
      columns: 23,
    });
    expect([box.width, box.height]).toEqual([23 * 8 + 8, 8 * 8 + 8]);
    expect(distinct(box)).toBeGreaterThanOrEqual(4); // background + 3 glyph colours

    const fixed = renderFixedText(rom, layoutFixed('LEVEL 1', 1, 8).codes, {
      lines: 1,
      columns: 8,
    });
    expect(fixed.height).toBe(16 + 8);
    expect(distinct(fixed)).toBeGreaterThanOrEqual(3);

    const menu = renderMenuText(rom, readScreenWords(rom, MENU_SCREENS[0].offset));
    expect([menu.width, menu.height]).toEqual([256, 224]);
    expect(opaque(menu)).toBe(256 * 224);
  });

  it('a menu preview follows the draft texts', () => {
    const rom = load();
    const screen = readMenuScreens(rom)[0];
    const words = buildScreenWords(rom, screen.offset, { 0: 'ABC' });
    const before = readScreenWords(rom, screen.offset);
    expect(words).not.toEqual(before);
    const a = renderMenuText(rom, words);
    const b = renderMenuText(rom, before);
    expect(a.data.every((v, i) => v === b.data[i])).toBe(false);
    expect(encodeIss('ABC').invalid).toEqual([]);
  });

  it('team description: title colour from FE xx and colours inside the body', () => {
    const rom = load();
    const desc = rom.readTeamDescription(idx('GERMANY'));
    const words = boxWords(rom, encodeTeamDescription(desc), 8, 15);
    expect((words[0] >> 10) & 7).toBe(1); // "Defensive": palette 1
    expect((words[2 * 15] >> 10) & 7).toBe(0); // body: palette 0
    // an original with coloured names keeps them in the exact bytes
    const coloured = TEAMS.map((_, i) => readTeamDescriptionRaw(rom, i)).find(
      (raw) => raw.filter((b) => b === 0xfe).length > 2,
    );
    const pals = new Set(Array.from(boxWords(rom, coloured, 8, 15)).map((w) => (w >> 10) & 7));
    expect(pals.size).toBeGreaterThanOrEqual(3);
  });
});
