import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  buildMenuBackground,
  buildMenuBackgroundFitting,
  readMenuBackground,
  readMenuBackgroundMap,
  readMenuBackgroundTiles,
  readMenuBackgroundColors,
  writeMenuBackground,
  readMenuScroll,
  writeMenuScroll,
} from '../menuBackground';
import { packScreenWords, screenLocation } from '../menuScreens';
import { konamiCompress } from '../KonamiCodec';
import { renderScreenView, SCREEN_VIEWS } from '../screenView';
import { applyTexts } from '../../utils/textsExport';
import { MENU_BACKGROUND, MENU_SCREENS, MATCH_PALETTES } from '../constants';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const PT_BR = fileURLToPath(new URL('../../../game-translations/PT-BR.json', import.meta.url));
const hasRealRom = existsSync(REAL_ROM);
const M = MENU_BACKGROUND;
const mapScreen = MENU_SCREENS.find((s) => s.id === 'menuBgMap');
const tileScreen = MENU_SCREENS.find((s) => s.id === 'menuBgTiles');

function image(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const c = paint(x, y);
      if (c) data.set([...c, 255], (y * width + x) * 4);
    }
  return { width, height, data };
}
const copyOf = (rom) => () => {
  const work = new RomParser(rom.getRomData());
  work.originalData = rom.getOriginalData();
  return work;
};
const pointerTarget = (rom, p) =>
  (rom.readByte(p + 2) & 0x7f) * 0x8000 + ((rom.readByte(p) | (rom.readByte(p + 1) << 8)) - 0x8000);
/** Deterministic pseudo-random numbers (31 bits) */
const random = (seed) => () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 8;
/** a 2-colour checker texture: red / yellow 8x8 squares */
const checker = (size) =>
  image(size, size, (x, y) => (((x >> 3) + (y >> 3)) % 2 ? [248, 0, 0] : [248, 248, 0]));

// --- Synthetic ROM: the load-list pointers, a 3-tile block and both map copies ---

function writePointer(data, p, fileOffset) {
  const addr = (fileOffset & 0x7fff) | 0x8000;
  data[p] = addr & 0xff;
  data[p + 1] = addr >> 8;
  data[p + 2] = (fileOffset >> 15) | 0x80;
}

function syntheticRom(header = 0) {
  const data = new Uint8Array(0x100000 + header);
  const tiles = new Uint8Array(3 * 32);
  tiles.fill(0xff, 32, 64); // tile 1: colour 15
  tiles.fill(0x55, 64, 96); // tile 2: stripes
  const tileBlock = konamiCompress(tiles);
  const words = new Uint16Array(1024).map((_, i) => (0x101 + (i % 2)) | (M.PALETTE << 10));
  const mapBlock = packScreenWords(words);
  data.set(tileBlock, M.TILES + header);
  data.set(mapBlock, M.MAP + header);
  data.set(mapBlock, M.MAP_COPY + header);
  tileScreen.pointers.forEach((p) => writePointer(data, p + header, M.TILES));
  mapScreen.pointers.forEach((p) =>
    writePointer(data, p + header, M.MAP_COPY_POINTERS.includes(p) ? M.MAP_COPY : M.MAP),
  );
  // colours 1-15 of BG palette 2
  for (let i = 0; i < 15; i++) data[M.COLORS + header + i * 2] = i + 1;
  return new RomParser(data);
}

describe('menu background (synthetic ROM)', () => {
  it('reads the original state', () => {
    const rom = syntheticRom();
    expect(readMenuBackground(rom)).toMatchObject({
      state: 'original',
      tileCount: 3,
      moved: false,
    });
    expect(readMenuBackgroundMap(rom)[1]).toBe(0x102 | (M.PALETTE << 10));
    expect(readMenuBackgroundColors(rom)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it('keeps the colours in MATCH_PALETTES clear of the other palettes', () => {
    const ranges = MATCH_PALETTES.map((p) => [p.offset, p.offset + p.count * 2]).sort(
      (a, b) => a[0] - b[0],
    );
    for (let i = 1; i < ranges.length; i++)
      expect(ranges[i][0]).toBeGreaterThanOrEqual(ranges[i - 1][1]);
  });

  it.each([0, 512])(
    'imports a texture and puts every map pointer on one block (header %i)',
    (h) => {
      const rom = syntheticRom(h);
      const built = buildMenuBackground(rom, { mode: 'texture', image: checker(16) });
      expect(built.ok).toBe(true);
      expect(built.tileCount).toBe(3); // blank + red + yellow
      expect(rom.importMenuBackground(built).ok).toBe(true);
      const at = screenLocation(rom, mapScreen);
      mapScreen.pointers.forEach((p) => expect(pointerTarget(rom, p)).toBe(at));
      const words = readMenuBackgroundMap(rom);
      // 16 x 16 texture: the pattern repeats every 2 cells, palette 2, tiles 0x101-0x102
      expect(words[2]).toBe(words[0]);
      expect(words[64]).toBe(words[0]);
      expect(words[1]).not.toBe(words[0]);
      expect(words.every((w) => w >> 10 === M.PALETTE && (w & 0x3ff) >= 0x101)).toBe(true);
      expect(readMenuBackground(rom).state).toBe('custom');
      expect(readMenuBackgroundColors(rom)).toEqual(built.colors);
      expect(built.colors).toContain(31); // red
      expect(built.colors).toContain(31 | (31 << 5)); // yellow
    },
  );

  it(
    'goes back to the exact original bytes, second map copy and its pointers included',
    () => {
      const rom = syntheticRom();
      const before = rom.getRomData().slice();
      rom.importMenuBackground(buildMenuBackground(rom, { mode: 'texture', image: checker(32) }));
      expect(rom.getRomData()).not.toEqual(before);
      const res = rom.importMenuBackground(buildMenuBackground(rom, { mode: 'original' }));
      expect(res.ok).toBe(true);

      expect(rom.getRomData()).toEqual(before);
      expect(readMenuBackground(rom).state).toBe('original');
    },
    15000,
  );

  it('rejects wrong sizes, empty images and more than 255 tiles', () => {
    const rom = syntheticRom();
    const err = (spec) => buildMenuBackground(rom, spec).error;
    expect(err({ mode: 'texture', image: checker(24) })).toBe('mbgErrSize');
    expect(err({ mode: 'texture', image: image(16, 32, () => [8, 8, 8]) })).toBe('mbgErrSize');
    expect(err({ mode: 'image', image: checker(128) })).toBe('mbgErrSize');
    expect(err({ mode: 'image', image: image(256, 256, () => null) })).toBe('mbgErrEmpty');
    // black and white noise: about 1024 different tiles
    const rnd = random(3);
    const many = image(256, 256, () => (rnd() & 1 ? [248, 248, 248] : [0, 0, 120]));
    expect(err({ mode: 'image', image: many })).toBe('mbgErrTooManyTiles');
  });

  it('leaves the ROM untouched when the blocks do not fit', () => {
    const rom = syntheticRom();
    const before = rom.getRomData().slice();
    // noise: 255 distinct tiles that barely compress
    const rnd = random(7);
    const tiles = new Uint8Array(256 * 32).map(() => rnd() & 0xff);
    const built = {
      ok: true,
      mode: 'image',
      words: new Uint16Array(1024).map((_, i) => 0x100 + (i % 256)),
      tiles,
      colors: null,
    };
    const res = writeMenuBackground(rom, built);
    expect(res).toMatchObject({ ok: false, error: 'mbgErrNoSpace' });
    expect(rom.getRomData()).toEqual(before);
  });
});

describe.skipIf(!hasRealRom)('menu background (real ROM)', () => {
  const load = () => new RomParser(readFileSync(REAL_ROM));
  const view = (id) => SCREEN_VIEWS.find((v) => v.id === id);
  /** BG2 alone, without the window darkening */
  const bg2 = (rom, id) =>
    renderScreenView(rom, view(id), {
      layers: { bg1: false, bg3: false, obj: false, math: false },
    }).data;

  it('reads the original pattern: 50 tiles, palette 2, blank first tile', () => {
    const rom = load();
    expect(readMenuBackground(rom)).toMatchObject({ state: 'original', tileCount: 50 });
    const words = readMenuBackgroundMap(rom);
    expect(words.every((w) => ((w >> 10) & 7) === M.PALETTE)).toBe(true);
    expect(Math.min(...words.map((w) => w & 0x3ff))).toBe(0x101);
    expect(
      readMenuBackgroundTiles(rom)
        .slice(0, 32)
        .every((b) => b === 0),
    ).toBe(true);
  });

  it('rebuilds the original byte for byte', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    const built = buildMenuBackground(rom, { mode: 'original' });
    expect(rom.importMenuBackground(built).ok).toBe(true);
    expect(rom.getRomData()).toEqual(before);
  });

  it('shows an imported texture on every menu screen and restores the original', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    const built = buildMenuBackgroundFitting(
      rom,
      { mode: 'texture', image: checker(64) },
      copyOf(rom),
    );
    expect(built.ok).toBe(true);
    expect(rom.importMenuBackground(built).ok).toBe(true);
    const [yellow, red] = [built.colors.indexOf(31 | (31 << 5)), built.colors.indexOf(31)];
    expect(yellow).toBeGreaterThanOrEqual(0);
    expect(red).toBeGreaterThanOrEqual(0);
    for (const v of SCREEN_VIEWS.filter((s) => s.loads)) {
      const data = bg2(rom, v.id);
      const px = (x, y) => Array.from(data.slice((y * 256 + x) * 4, (y * 256 + x) * 4 + 3));
      // the scroll of each recipe is 0: the first cell is yellow, the next one red
      expect(px(2, 2), v.id).toEqual([248, 248, 0]);
      expect(px(10, 2), v.id).toEqual([248, 0, 0]);
    }
    rom.importMenuBackground(buildMenuBackground(rom, { mode: 'original' }));
    expect(rom.getRomData()).toEqual(before);
  });

  it('fits a simple 256 x 256 image (a disc on a plain colour)', () => {
    const rom = load();
    const disc = image(256, 256, (x, y) =>
      (x - 128) ** 2 + (y - 128) ** 2 < 60 ** 2 ? [240, 240, 240] : [0, 80, 40],
    );
    const res = buildMenuBackgroundFitting(rom, { mode: 'image', image: disc }, copyOf(rom));
    expect(res.ok).toBe(true);
    expect(res.tileCount).toBeLessThanOrEqual(M.MAX_TILES + 1);
    expect(rom.importMenuBackground(res).ok).toBe(true);
    const words = readMenuBackgroundMap(rom);
    // the plain corners share a single tile
    expect(words[0]).toBe(words[31]);
    expect(words[0]).toBe(words[31 * 32]);
  });

  it('reports a photo-like image that cannot fit and changes nothing', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    const rnd = random(11);
    const noise = image(256, 256, () => [rnd() % 248, rnd() % 248, rnd() % 248]);
    const res = buildMenuBackgroundFitting(rom, { mode: 'image', image: noise }, copyOf(rom));
    expect(res.ok).toBe(false);
    expect(['mbgErrTooManyTiles', 'mbgErrNoSpace']).toContain(res.error);
    expect(rom.getRomData()).toEqual(before);
  });

  it.skipIf(!existsSync(PT_BR))('coexists with the PT-BR translation in the free space', () => {
    const rom = load();
    const res = applyTexts(rom, JSON.parse(readFileSync(PT_BR, 'utf8')));
    expect(res.ok).toBe(true);
    const menusBefore = rom.readMenuScreens().map((s) => s.runs.map((r) => r.text));
    const built = buildMenuBackgroundFitting(
      rom,
      { mode: 'texture', image: checker(32) },
      copyOf(rom),
    );
    expect(built.ok).toBe(true);
    expect(rom.importMenuBackground(built).ok).toBe(true);
    expect(rom.readMenuScreens().map((s) => s.runs.map((r) => r.text))).toEqual(menusBefore);
    expect(readMenuBackground(rom).state).toBe('custom');
  });
});

/** The scroll routine $85:A2C3 as in the original ROM (its 28 bytes, nothing else) */
function scrollRom() {
  const data = new Uint8Array(0x100000);
  // prettier-ignore
  data.set([
    0xad, 0x60, 0x19, 0x89, 0x00, 0x01, 0xd0, 0x13, // LDA $1960 / BIT #$0100 / BNE end
    0xad, 0x0e, 0x19, 0x18, 0x69, 0x00, 0x80, 0x8d, 0x0e, 0x19, // $190E += $8000
    0xad, 0x10, 0x19, 0x69, 0x00, 0x00, 0x8d, 0x10, 0x19, 0x6b, // $1910 += carry / RTL
  ], M.SCROLL.ROUTINE[0]);
  return new RomParser(data);
}

describe('menu background scroll (code patch)', () => {
  it('reads the original speed and switches between the options', () => {
    const rom = scrollRom();
    const before = rom.getRomData().slice();
    expect(readMenuScroll(rom)).toBe('normal');
    for (const speed of ['fixed', 'slow', 'fast', 'normal']) {
      expect(writeMenuScroll(rom, speed).ok).toBe(true);
      expect(readMenuScroll(rom)).toBe(speed);
    }
    // back to normal: the exact original bytes
    expect(rom.getRomData()).toEqual(before);
  });

  it('fixes the scroll at 0: loads zero instead of the current value, with a zero step', () => {
    const rom = scrollRom();
    writeMenuScroll(rom, 'fixed');
    const S = M.SCROLL;
    const at = (a, n) => Array.from(rom.readBytes(a, n));
    expect(at(S.LOAD_FRAC, 3)).toEqual([0xa9, 0x00, 0x00]);
    expect(at(S.LOAD_PIXELS, 3)).toEqual([0xa9, 0x00, 0x00]);
    expect(at(S.FRAC, 2)).toEqual([0, 0]);
    expect(at(S.PIXELS, 2)).toEqual([0, 0]);
    // the rest of the routine (and the code around it) is untouched
    expect(at(S.ROUTINE[0], 8)).toEqual(S.PATTERN.slice(0, 8));
    expect(rom.readByte(S.ROUTINE[1] - 1)).toBe(0x6b); // RTL
    expect(rom.readByte(S.ROUTINE[1])).toBe(0);
  });

  it('refuses to patch code it does not recognise and reports a custom speed', () => {
    const rom = scrollRom();
    rom.writeBytes(M.SCROLL.FRAC, [0x00, 0x20]); // a hack with another speed
    expect(readMenuScroll(rom)).toBe('custom');
    rom.writeByte(M.SCROLL.ROUTINE[0], 0xea); // the routine itself changed
    const before = rom.getRomData().slice();
    expect(readMenuScroll(rom)).toBeNull();
    expect(writeMenuScroll(rom, 'fixed')).toMatchObject({ ok: false, error: 'mbgErrScrollCode' });
    expect(writeMenuScroll(scrollRom(), 'turbo').ok).toBe(false);
    expect(rom.getRomData()).toEqual(before);
  });

  it.skipIf(!hasRealRom)('matches the routine of the real ROM', () => {
    const rom = new RomParser(readFileSync(REAL_ROM));
    expect(readMenuScroll(rom)).toBe('normal');
    expect(Array.from(rom.readBytes(M.SCROLL.ROUTINE[0], 28))).toEqual(
      Array.from(scrollRom().readBytes(M.SCROLL.ROUTINE[0], 28)),
    );
  });
});
