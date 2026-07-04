import { describe, it, expect } from 'vitest';
import {
  readUniformColors,
  readHairSkinColors,
  readFlagColors,
  parseSnesColor,
} from '../readers/UniformReader';
import { writeUniformColor, writeHairSkinColor, writeFlagColor } from '../writers/UniformWriter';
import RomParser from '../RomParser';

function createMockRom(size = 1048576) {
  return new RomParser(new Uint8Array(size));
}

describe('UniformReader/UniformWriter Roundtrip', () => {
  describe('SNES Color Encoding', () => {
    it('should encode and decode pure red', () => {
      const rom = createMockRom();
      const color = { r: 248, g: 0, b: 0 }; // r=248 → r5=31
      writeUniformColor(rom, 0, 'home', 'shirt', 0, color);
      const result = readUniformColors(rom, 0);
      expect(result.home.shirt[0].r5).toBe(31);
      expect(result.home.shirt[0].g5).toBe(0);
      expect(result.home.shirt[0].b5).toBe(0);
    });

    it('should encode and decode pure green', () => {
      const rom = createMockRom();
      const color = { r: 0, g: 248, b: 0 }; // g=248 → g5=31
      writeUniformColor(rom, 0, 'home', 'shirt', 0, color);
      const result = readUniformColors(rom, 0);
      expect(result.home.shirt[0].r5).toBe(0);
      expect(result.home.shirt[0].g5).toBe(31);
      expect(result.home.shirt[0].b5).toBe(0);
    });

    it('should encode and decode pure blue', () => {
      const rom = createMockRom();
      const color = { r: 0, g: 0, b: 248 }; // b=248 → b5=31
      writeUniformColor(rom, 0, 'home', 'shirt', 0, color);
      const result = readUniformColors(rom, 0);
      expect(result.home.shirt[0].r5).toBe(0);
      expect(result.home.shirt[0].g5).toBe(0);
      expect(result.home.shirt[0].b5).toBe(31);
    });

    it('should round-trip a mixed color (quantized to 5-bit)', () => {
      const rom = createMockRom();
      // 120 / 8 = 15, 200 / 8 = 25, 80 / 8 = 10
      const color = { r: 120, g: 200, b: 80 };
      writeUniformColor(rom, 0, 'home', 'shirt', 0, color);
      const result = readUniformColors(rom, 0);
      expect(result.home.shirt[0].r5).toBe(15);
      expect(result.home.shirt[0].g5).toBe(25);
      expect(result.home.shirt[0].b5).toBe(10);
      // Re-expanded values (5-bit * 8)
      expect(result.home.shirt[0].r).toBe(120);
      expect(result.home.shirt[0].g).toBe(200);
      expect(result.home.shirt[0].b).toBe(80);
    });
  });

  describe('Home Kit Colors', () => {
    it('should roundtrip all 3 shirt colors', () => {
      const rom = createMockRom();
      const colors = [
        { r: 248, g: 0, b: 0 },
        { r: 0, g: 248, b: 0 },
        { r: 0, g: 0, b: 248 },
      ];
      colors.forEach((c, i) => writeUniformColor(rom, 0, 'home', 'shirt', i, c));
      const result = readUniformColors(rom, 0);
      expect(result.home.shirt[0].r5).toBe(31);
      expect(result.home.shirt[1].g5).toBe(31);
      expect(result.home.shirt[2].b5).toBe(31);
    });

    it('should roundtrip all 3 shorts colors', () => {
      const rom = createMockRom();
      const colors = [
        { r: 64, g: 128, b: 192 },
        { r: 32, g: 96, b: 160 },
        { r: 16, g: 48, b: 80 },
      ];
      colors.forEach((c, i) => writeUniformColor(rom, 0, 'home', 'shorts', i, c));
      const result = readUniformColors(rom, 0);
      expect(result.home.shorts[0].r5).toBe(8);
      expect(result.home.shorts[0].g5).toBe(16);
      expect(result.home.shorts[0].b5).toBe(24);
    });

    it('should roundtrip 2 socks colors', () => {
      const rom = createMockRom();
      writeUniformColor(rom, 0, 'home', 'socks', 0, { r: 248, g: 248, b: 248 });
      writeUniformColor(rom, 0, 'home', 'socks', 1, { r: 0, g: 0, b: 0 });
      const result = readUniformColors(rom, 0);
      expect(result.home.socks[0].r5).toBe(31);
      expect(result.home.socks[0].g5).toBe(31);
      expect(result.home.socks[1].r5).toBe(0);
    });
  });

  describe('Away Kit Colors', () => {
    it('should roundtrip away shirt colors independently of home', () => {
      const rom = createMockRom();
      writeUniformColor(rom, 0, 'home', 'shirt', 0, { r: 248, g: 0, b: 0 });
      writeUniformColor(rom, 0, 'away', 'shirt', 0, { r: 0, g: 0, b: 248 });
      const result = readUniformColors(rom, 0);
      expect(result.home.shirt[0].r5).toBe(31);
      expect(result.away.shirt[0].b5).toBe(31);
    });
  });

  describe('Goalkeeper Kit Colors', () => {
    it('should roundtrip goalkeeper shirtAndSocks colors', () => {
      const rom = createMockRom();
      for (let i = 0; i < 5; i++) {
        writeUniformColor(rom, 0, 'goalkeeper', 'shirtAndSocks', i, {
          r: i * 40,
          g: i * 40,
          b: i * 40,
        });
      }
      const result = readUniformColors(rom, 0);
      expect(result.goalkeeper.shirtAndSocks).toHaveLength(5);
      expect(result.goalkeeper.shirtAndSocks[0].r5).toBe(0);
      expect(result.goalkeeper.shirtAndSocks[4].r5).toBe(20);
    });

    it('should roundtrip goalkeeper shorts color', () => {
      const rom = createMockRom();
      writeUniformColor(rom, 0, 'goalkeeper', 'shorts', 0, { r: 120, g: 200, b: 80 });
      const result = readUniformColors(rom, 0);
      expect(result.goalkeeper.shorts[0].r5).toBe(15);
      expect(result.goalkeeper.shorts[0].g5).toBe(25);
    });
  });

  describe('Cross-team isolation', () => {
    it('should not corrupt another teams colors when writing', () => {
      const rom = createMockRom();
      // Team 0 = Germany (Range1), Team 18 = Brazil (Range1 pos 12)
      writeUniformColor(rom, 0, 'home', 'shirt', 0, { r: 248, g: 248, b: 248 });
      writeUniformColor(rom, 18, 'home', 'shirt', 0, { r: 0, g: 248, b: 0 });

      const germany = readUniformColors(rom, 0);
      const brazil = readUniformColors(rom, 18);
      expect(germany.home.shirt[0].r5).toBe(31);
      expect(brazil.home.shirt[0].g5).toBe(31);
      expect(brazil.home.shirt[0].r5).toBe(0);
    });
  });

  describe('Hair and Skin Colors', () => {
    it('should roundtrip outfield hair color', () => {
      const rom = createMockRom();
      writeHairSkinColor(rom, 0, 'first', 'hair', 0, { r: 80, g: 48, b: 16 });
      const result = readHairSkinColors(rom, 0);
      expect(result.first.hair[0].r5).toBe(10);
      expect(result.first.hair[0].g5).toBe(6);
      expect(result.first.hair[0].b5).toBe(2);
    });

    it('should roundtrip outfield skin colors (5 colors)', () => {
      const rom = createMockRom();
      for (let i = 0; i < 5; i++) {
        writeHairSkinColor(rom, 0, 'first', 'skin', i, { r: i * 48, g: i * 32, b: i * 16 });
      }
      const result = readHairSkinColors(rom, 0);
      expect(result.first.skin).toHaveLength(5);
      expect(result.first.skin[0].r5).toBe(0);
      expect(result.first.skin[4].r5).toBe(24);
    });

    it('should roundtrip goalkeeper hair and skin independently', () => {
      const rom = createMockRom();
      writeHairSkinColor(rom, 0, 'goalkeeper', 'hair', 0, { r: 200, g: 160, b: 80 });
      writeHairSkinColor(rom, 0, 'goalkeeper', 'skin', 0, { r: 176, g: 128, b: 80 });
      const result = readHairSkinColors(rom, 0);
      expect(result.goalkeeper.hair[0].r5).toBe(25);
      expect(result.goalkeeper.skin[0].r5).toBe(22);
    });

    it('should keep first and second kit hair/skin independent', () => {
      const rom = createMockRom();
      writeHairSkinColor(rom, 0, 'first', 'hair', 0, { r: 248, g: 0, b: 0 });
      writeHairSkinColor(rom, 0, 'second', 'hair', 0, { r: 0, g: 248, b: 0 });
      const result = readHairSkinColors(rom, 0);
      expect(result.first.hair[0].r5).toBe(31);
      expect(result.second.hair[0].g5).toBe(31);
    });
  });

  describe('Flag Colors', () => {
    it('should roundtrip all 4 flag colors', () => {
      const rom = createMockRom();
      const flagColors = [
        { r: 0, g: 248, b: 0 }, // green
        { r: 248, g: 248, b: 0 }, // yellow
        { r: 0, g: 0, b: 248 }, // blue
        { r: 248, g: 248, b: 248 }, // white
      ];
      flagColors.forEach((c, i) => writeFlagColor(rom, 0, i, c));
      const result = readFlagColors(rom, 0);
      expect(result).toHaveLength(4);
      expect(result[0].g5).toBe(31);
      expect(result[1].r5).toBe(31);
      expect(result[1].g5).toBe(31);
      expect(result[2].b5).toBe(31);
      expect(result[3].r5).toBe(31);
    });

    it('should not corrupt other teams flag colors', () => {
      const rom = createMockRom();
      // Team 0 = Germany (FLAG_RANGE1 pos 0), Team 18 = Brazil (FLAG_RANGE1 pos 11)
      writeFlagColor(rom, 0, 0, { r: 0, g: 0, b: 0 });
      writeFlagColor(rom, 18, 0, { r: 248, g: 248, b: 248 });

      const germany = readFlagColors(rom, 0);
      const brazil = readFlagColors(rom, 18);
      expect(germany[0].r5).toBe(0);
      expect(brazil[0].r5).toBe(31);
    });
  });
});
