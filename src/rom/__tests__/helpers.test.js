import { describe, it, expect } from 'vitest';
import { medianCut, nearest, twoPalettes, toRaw, rgb5 } from '../quantize';
import { gameSpeed, withDerivedStats, clampStat, clampIndex } from '../playerStats';
import { FLAG_TEMPLATES } from '../flagTemplates';
import { HAIR_SKIN_TEMPLATES } from '../hairSkinTemplates';
import { SHOOTING_VALUES } from '../constants';
import { getModifiedFilename } from '../../utils/fileHelpers';
import { quantizeWithPalette, extractPalette } from '../../utils/imageToFlag';
import { fitSize, keyOutColor } from '../../utils/imageToLogo';

describe('quantize', () => {
  it('rgb5 / toRaw', () => {
    expect(rgb5(255, 128, 8)).toEqual([31, 16, 1]);
    expect(toRaw([31, 0, 1])).toBe(31 | (1 << 10));
  });

  it('medianCut keeps at most `max` unique colours, darkest first', () => {
    const colors = [
      [0, 0, 0],
      [0, 0, 1],
      [31, 31, 31],
      [30, 31, 31],
      [31, 0, 0],
      [30, 0, 0],
    ];
    const pal = medianCut(colors, 3);
    expect(pal.length).toBeLessThanOrEqual(3);
    const lum = pal.map((c) => c[0] + c[1] + c[2]);
    expect([...lum].sort((a, b) => a - b)).toEqual(lum);
    expect(medianCut([], 4)).toEqual([]);
  });

  it('nearest picks the closest palette entry', () => {
    const pal = [
      [0, 0, 0],
      [31, 31, 31],
    ];
    expect(nearest(pal, [2, 1, 3]).index).toBe(0);
    expect(nearest(pal, [29, 30, 31]).index).toBe(1);
  });

  it('twoPalettes splits blocks of different colours', () => {
    const red = { pixels: Array(8).fill([31, 0, 0]) };
    const blue = { pixels: Array(8).fill([0, 0, 31]) };
    const { pals, assign } = twoPalettes([red, blue, red], 4);
    expect(assign[0]).toBe(assign[2]);
    expect(assign[0]).not.toBe(assign[1]);
    expect(pals).toHaveLength(2);
  });
});

describe('playerStats', () => {
  it('clamps to the editor ranges', () => {
    expect(clampStat(0)).toBe(1);
    expect(clampStat(20)).toBe(16);
    expect(clampStat('x')).toBe(1);
    expect(clampIndex(-1)).toBe(0);
    expect(clampIndex(9)).toBe(7);
  });

  it('SPEED bar = (2 x start + top + dribble) / 4, like the game', () => {
    expect(gameSpeed({ acceleration: 16, topSpeed: 16, dribbleSpeed: 16 })).toBe(16);
    expect(gameSpeed({ acceleration: 1, topSpeed: 1, dribbleSpeed: 1 })).toBe(1);
    // nibbles 9, 5, 3 -> (18 + 5 + 3) >> 2 = 6 -> 7
    expect(gameSpeed({ acceleration: 10, topSpeed: 6, dribbleSpeed: 4 })).toBe(7);
  });

  it('withDerivedStats fills the read-only labels', () => {
    const p = withDerivedStats({ shootingIndex: 3, techniqueIndex: 7, gkKickIndex: 0 });
    expect(p.shooting).toBe(SHOOTING_VALUES[3]);
    expect(p.technique).toBe(SHOOTING_VALUES[7]);
    expect(p.gkKick).toBe(SHOOTING_VALUES[0]);
    expect(p.speed).toBeGreaterThanOrEqual(1);
  });
});

describe('templates', () => {
  it('every flag template draws a 24 x 16 grid of palette indexes 0-4', () => {
    expect(FLAG_TEMPLATES.length).toBeGreaterThan(5);
    for (const tpl of FLAG_TEMPLATES) {
      const grid = tpl.generate(24, 16);
      expect(grid, tpl.id).toHaveLength(16);
      grid.forEach((row) => {
        expect(row).toHaveLength(24);
        row.forEach((v) => expect(v >= 0 && v <= 4).toBe(true));
      });
      expect(new Set(FLAG_TEMPLATES.map((x) => x.id)).size).toBe(FLAG_TEMPLATES.length);
    }
  });

  it('hair/skin templates have 1+5 outfield and 1+3 goalkeeper 5-bit colours', () => {
    for (const tpl of HAIR_SKIN_TEMPLATES) {
      expect(tpl.outfield.hair).toHaveLength(1);
      expect(tpl.outfield.skin).toHaveLength(5);
      expect(tpl.goalkeeper.hair).toHaveLength(1);
      expect(tpl.goalkeeper.skin).toHaveLength(3);
      [...tpl.outfield.skin, ...tpl.goalkeeper.skin].forEach((c) => {
        expect(c.r).toBe(c.r5 * 8);
        expect(c.r5 >= 0 && c.r5 <= 31).toBe(true);
      });
    }
  });
});

describe('file and image helpers', () => {
  it('getModifiedFilename', () => {
    expect(getModifiedFilename('ISS.sfc')).toBe('ISS_Modified.sfc');
    expect(getModifiedFilename('rom')).toBe('rom_Modified');
    expect(getModifiedFilename('')).toBe('ISS_Modified.smc');
  });

  it('quantizeWithPalette maps pixels to the nearest flag colour (1-4), transparent to 0', () => {
    const data = new Uint8ClampedArray(24 * 16 * 4);
    for (let i = 0; i < 24 * 16; i++) data.set([250, 10, 10, 255], i * 4); // red
    data.set([0, 0, 0, 0], 0); // first pixel transparent
    data.set([10, 10, 250, 255], 4); // second pixel blue
    const colors = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 0, b: 255 },
      { r: 255, g: 255, b: 255 },
      { r: 0, g: 0, b: 0 },
    ];
    const grid = quantizeWithPalette({ data, width: 24, height: 16 }, colors);
    expect(grid[0][0]).toBe(0);
    expect(grid[0][1]).toBe(2);
    expect(grid[5][5]).toBe(1);
  });

  it('extractPalette always returns 4 colours', () => {
    const data = new Uint8ClampedArray(8 * 4);
    for (let i = 0; i < 8; i++) data.set([i * 30, 0, 0, 255], i * 4);
    expect(extractPalette({ data })).toHaveLength(4);
    expect(extractPalette({ data: new Uint8ClampedArray(16) })).toHaveLength(4);
  });

  it('fitSize keeps the aspect ratio inside the box; keyOutColor clears close colours', () => {
    expect(fitSize(200, 100, 100, 100)).toEqual({ width: 100, height: 50 });
    expect(fitSize(10, 10, 100, 50, 0.5)).toEqual({ width: 25, height: 25 });
    const px = new Uint8ClampedArray([0, 255, 0, 255, 200, 0, 0, 255]);
    keyOutColor(px, [0, 250, 0]);
    expect(px[3]).toBe(0);
    expect(px[7]).toBe(255);
  });
});
