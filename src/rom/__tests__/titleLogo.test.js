import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  medianCut,
  buildLogo,
  buildLogoAuto,
  writeLogo,
  readLogoSprites,
  isOriginalLogo,
  originalTmTiles,
  logoTileDest,
  LOGO_CAPACITY,
} from '../titleLogo';
import { readTitleScreen, renderTitleScreen } from '../titleScreen';
import { TITLE_SCREEN } from '../constants';
import { TITLE_LOGO_SPRITES } from '../titleScreenLayout';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const hasRealRom = existsSync(REAL_ROM);
const L = TITLE_SCREEN.LOGO;

/** RGBA image: `paint(x, y)` returns [r, g, b] or null (transparent) */
function image(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const c = paint(x, y);
      if (c) data.set([...c, 255], (y * width + x) * 4);
    }
  return { width, height, data };
}

describe('logo conversion', () => {
  it('median cut keeps at most the requested colours', () => {
    const colors = Array.from({ length: 200 }, (_, i) => [i % 32, (i * 7) % 32, (i * 13) % 32]);
    expect(medianCut(colors, 15).length).toBeLessThanOrEqual(15);
    expect(medianCut([[1, 2, 3]], 15)).toEqual([[1, 2, 3]]);
    expect(medianCut([], 15)).toEqual([]);
  });

  it('cuts a solid rectangle into 16x16 sprites centred in the logo room', () => {
    const built = buildLogo(image(64, 32, () => [248, 0, 0]));
    expect(built.ok).toBe(true);
    expect(built.sprites).toBe(8); // 4 x 2 blocks of 16x16
    // all blocks are identical: one 16x16 slot (4 tiles) is enough
    expect(built.tileCount).toBe(18); // tiles 0, 1, 16 and 17 of the sheet
    const n = built.list[1];
    expect(Array.from(built.list.slice(0, 4))).toEqual([1, n, 0, n]);
    // first sprite: top-left corner of the image (centre 128,60 → 96,44), relative to (128,112)
    const dx = (built.list[4] << 24) >> 24;
    const dy = (built.list[4 + n] << 24) >> 24;
    expect([128 + dx, 112 + dy]).toEqual([96, 44]);
    expect(built.list[4 + 3 * n] & 0x10).toBe(0x10); // 16x16
    // palette: pure red is in it
    expect(built.palettes[0]).toContain(31);
  });

  it('uses 8x8 sprites for blocks with one or two cells and adds the TM', () => {
    const tm = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2)];
    const built = buildLogo(
      image(8, 8, () => [0, 0, 248]),
      { tm },
    );
    expect(built.ok).toBe(true);
    expect(built.sprites).toBe(3); // one 8x8 + the 2 TM sprites
    const n = built.sprites;
    expect(built.list[4 + 3 * n] & 0x10).toBe(0); // 8x8
    expect((built.list[4 + 3 * n + 1] >> 1) & 7).toBe(7); // TM palette
  });

  it('splits two very different colour areas into the two palettes', () => {
    // left half red shades, right half blue shades: 2 x 15 colours are needed
    const built = buildLogo(
      image(64, 16, (x, y) => (x < 32 ? [128 + y * 8, 0, 0] : [0, 0, 128 + y * 8])),
    );
    expect(built.ok).toBe(true);
    const pal = (i) => (built.list[4 + 3 * built.sprites + i] >> 1) & 7;
    const pals = new Set(Array.from({ length: built.sprites }, (_, i) => pal(i)));
    expect([...pals].sort()).toEqual([2, 3]);
  });

  it('rejects empty or oversized images', () => {
    expect(buildLogo(image(16, 16, () => null)).error).toBe('logoEmpty');
    expect(buildLogo(image(L.MAX_WIDTH + 1, 8, () => [1, 1, 1])).error).toBe('logoSize');
  });

  it('lowers the colours until a busy image fits (or reports the size)', () => {
    // noise compresses badly: needs fewer colours
    let seed = 1;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const noisy = image(160, 64, () => [rnd() * 255, rnd() * 255, rnd() * 255]);
    const res = buildLogoAuto(noisy);
    if (res.ok) {
      expect(res.size).toBeLessThanOrEqual(LOGO_CAPACITY);
      expect(res.colors).toBeLessThan(15);
    } else {
      expect(res.error).toBe('logoNoSpace');
      expect(res.size).toBeGreaterThan(LOGO_CAPACITY);
    }
  });
});

describe.skipIf(!hasRealRom)('logo in the ROM', () => {
  const load = () => new RomParser(readFileSync(REAL_ROM));

  it('reads the original logo', () => {
    const rom = load();
    expect(readLogoSprites(rom)).toEqual(TITLE_LOGO_SPRITES);
    expect(isOriginalLogo(rom)).toBe(true);
    expect(logoTileDest(rom)).toBe(L.ORIGINAL_DEST);
    expect(originalTmTiles(rom).map((t) => t.length)).toEqual([32, 32]);
  });

  it('imports a logo, previews it and restores the original exactly', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    const built = buildLogo(
      image(120, 40, (x, y) => (((x >> 3) + (y >> 3)) % 2 ? [248, 200, 0] : [0, 80, 248])),
      { tm: originalTmTiles(rom) },
    );
    expect(built.ok).toBe(true);
    const res = rom.importTitleLogo(built, { hideStroke: true });
    expect(res.ok).toBe(true);
    expect(isOriginalLogo(rom)).toBe(false);
    expect(logoTileDest(rom)).toBe(0x6000 + L.FIRST_TILE * 16);
    const sprites = readLogoSprites(rom);
    expect(sprites).toHaveLength(built.sprites);
    // drawn in reverse list order; the first list sprite is the top-left block
    expect(sprites[sprites.length - 1].slice(0, 2)).toEqual([68, 40]);
    const s = readTitleScreen(rom);
    expect(s.logo).toEqual({ original: false, sprites: built.sprites });
    expect(s.colors.logoTop).toEqual(built.palettes[0]);
    expect(s.colors.stroke.every((c) => c === s.colors.sky[0])).toBe(true);
    // the preview draws the new logo (yellow pixels where the original had none)
    const { data } = renderTitleScreen(rom, s, { pressStart: false });
    const at = (x, y) => Array.from(data.slice((y * 256 + x) * 4, (y * 256 + x) * 4 + 3));
    expect(at(68, 40)).not.toEqual([224, 224, 224]);

    rom.restoreTitleLogo();
    expect(isOriginalLogo(rom)).toBe(true);
    expect(rom.getRomData()).toEqual(before);
  });

  it('refuses a logo that does not fit and leaves the ROM untouched', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    let seed = 7;
    const big = {
      tiles: new Uint8Array(9000).map(
        () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 16,
      ),
      list: new Uint8Array(8),
    };
    expect(writeLogo(rom, big)).toMatchObject({ ok: false, error: 'logoNoSpace' });
    expect(rom.getRomData()).toEqual(before);
  });
});
