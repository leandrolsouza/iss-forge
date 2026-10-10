import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  rawToRgb,
  rgbToRaw,
  rawToHex,
  hexToRaw,
  adjustPalette,
  shadeRamp,
  GRASS_PRESETS,
} from '../palettes';
import { MATCH_PALETTES } from '../constants';
import { rgbToSnesBytes } from '../writers/UniformWriter';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const hasRealRom = existsSync(REAL_ROM);
const c = (r, g, b) => r | (g << 5) | (b << 10);

describe('palette helpers', () => {
  it('converts between raw SNES, RGB and hex losslessly for 5-bit values', () => {
    for (const raw of [0, 0x7fff, c(15, 19, 10), c(31, 0, 7)]) {
      expect(rgbToRaw(rawToRgb(raw))).toBe(raw);
      expect(hexToRaw(rawToHex(raw))).toBe(raw);
    }
    expect(rawToHex(c(31, 0, 0))).toBe('#f80000');
    expect(hexToRaw('#ffffff')).toBe(0x7fff); // 255 must clamp to 31, not wrap to 0
    expect(hexToRaw('nope')).toBeNull();
  });

  it('adjustPalette keeps greys and shifts hues', () => {
    const grey = c(16, 16, 16);
    const green = c(10, 20, 6);
    const [g2, gr2] = adjustPalette([grey, green], { hue: 120 });
    expect(g2).toBe(grey);
    const { r, g, b } = rawToRgb(gr2);
    expect(b).toBeGreaterThan(g); // green rotated towards blue
    expect(b).toBeGreaterThan(r);
    expect(adjustPalette([green], {})).toEqual([green]);
  });

  it('shadeRamp goes from dark to the base colour', () => {
    const ramp = shadeRamp(c(31, 31, 0), 3);
    expect(ramp).toHaveLength(3);
    const lum = ramp.map((raw) => {
      const { r, g, b } = rawToRgb(raw);
      return r + g + b;
    });
    expect(lum[0]).toBeLessThan(lum[1]);
    expect(lum[1]).toBeLessThan(lum[2]);
    expect(ramp[2]).toBe(c(31, 31, 0));
  });

  it('every grass preset id is unique', () => {
    expect(new Set(GRASS_PRESETS.map((p) => p.id)).size).toBe(GRASS_PRESETS.length);
  });

  it('palette blocks do not overlap each other', () => {
    const ranges = MATCH_PALETTES.map((p) => [p.offset, p.offset + p.count * 2]).sort(
      (a, b) => a[0] - b[0],
    );
    for (let i = 1; i < ranges.length; i++)
      expect(ranges[i][0]).toBeGreaterThanOrEqual(ranges[i - 1][1]);
  });

  it('uniform/flag colour writer clamps white instead of wrapping it to black', () => {
    expect(rgbToSnesBytes({ r: 255, g: 255, b: 255 })).toEqual([0xff, 0x7f]);
    expect(rgbToSnesBytes({ r: 0, g: 0, b: 0 })).toEqual([0, 0]);
    expect(rgbToSnesBytes({ r: 252, g: 0, b: 0 })).toEqual([31, 0]);
  });
});

describe.skipIf(!hasRealRom)('match palettes on the real ROM', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));

  it('reads the known original colours', () => {
    const p = load().readMatchPalettes();
    expect(p.grassB_sunny.slice(0, 3)).toEqual([c(15, 19, 10), c(14, 17, 9), c(18, 21, 11)]);
    expect(p.referee.slice(6, 9)).toEqual([c(3, 3, 3), c(9, 9, 9), c(15, 15, 15)]); // black shirt
    expect(p.ball[0]).toBe(c(6, 6, 6));
    expect(p.ball[8]).toBe(c(31, 31, 29));
    // Rain palettes for type B and A/C start with the same colour
    expect(p.grassAC_rain[0]).toBe(p.grassB_rain[0]);
  });

  it('writes only the target block', () => {
    const rom = load();
    const before = new Uint8Array(rom.getRomData());
    const colors = rom.readMatchPalettes().referee.map(() => c(31, 31, 0));
    rom.writeMatchPalette('referee', colors);
    expect(rom.readMatchPalettes().referee).toEqual(colors);
    const data = rom.getRomData();
    const { offset, count } = MATCH_PALETTES.find((x) => x.id === 'referee');
    for (let i = 0; i < data.length; i++) {
      if (i >= offset && i < offset + count * 2) continue;
      if (data[i] !== before[i]) throw new Error(`changed 0x${i.toString(16)}`);
    }
  });

  it('restoreMatchPalettes undoes changes', () => {
    const rom = load();
    const original = rom.readMatchPalettes();
    rom.writeMatchPalette('grassB_sunny', adjustPalette(original.grassB_sunny, { hue: 90 }));
    rom.writeMatchPalette(
      'ball',
      original.ball.map(() => 0),
    );
    rom.restoreMatchPalettes(original);
    expect(rom.readMatchPalettes()).toEqual(original);
  });

  it('rejects wrong colour counts', () => {
    expect(() => load().writeMatchPalette('ball', [1, 2, 3])).toThrow();
  });
});
