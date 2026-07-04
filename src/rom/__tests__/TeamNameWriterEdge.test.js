import { describe, it, expect } from 'vitest';
import { writeTeamNameMenu, getSlotMaxChars } from '../writers/TeamNameWriter';
import { readTeamNameText } from '../readers/TeamNameReader';
import { generateTeamNameData } from '../TeamNameGenerator';
import RomParser from '../RomParser';

/**
 * Edge case tests for TeamNameWriter:
 * - Slot overflow and truncation
 * - Data integrity after shifts
 * - Boundary conditions
 */

function createMockRomWithTeamNames() {
  const rom = new RomParser(new Uint8Array(1048576));

  const POINTER_OFFSET = 0x39dae;
  const DATA_BASE = 0x43ed5;

  const ordinalNames = [
    'GERMANY',
    'ITALY',
    'HOLLAND',
    'SPAIN',
    'ENGLAND',
    'SCOTLND',
    'WALES',
    'FRANCE',
    'DNMARK',
    'SWEDEN',
    'NORWAY',
    'IRELAND',
    'BELGIUM',
    'AUSTRIA',
    'SWITZ',
    'ROMANIA',
    'BLGARIA',
    'RUSSIA',
    'ARGNTNA',
    'BRAZIL',
    'COLMBIA',
    'MEXICO',
    'U.S.A',
    'NIGERIA',
    'CAMROON',
    'S.KOREA',
    'ALLSTAR',
  ];

  let currentAddr = DATA_BASE;
  for (let ordinal = 0; ordinal < 27; ordinal++) {
    const relative = currentAddr - 0x40000;
    const b1 = relative & 0xff;
    const b2 = ((relative >> 8) & 0xff) + 0x80;
    rom.writeByte(POINTER_OFFSET + ordinal * 2, b1);
    rom.writeByte(POINTER_OFFSET + ordinal * 2 + 1, b2);
    const nameData = generateTeamNameData(ordinalNames[ordinal]);
    rom.writeBytes(currentAddr, nameData);
    currentAddr += nameData.length;
  }

  // Apply shared pointer patches
  const SHARED_PTR_PATCH_39D78 = new Uint8Array([
    0x00, 0x10, 0x30, 0x10, 0x60, 0x10, 0x90, 0x10, 0xc0, 0x10, 0x00, 0x12, 0x30, 0x12, 0x60, 0x12,
    0x90, 0x12, 0xc0, 0x12, 0x00, 0x14, 0x30, 0x14, 0x60, 0x14, 0x90, 0x14, 0xc0, 0x14, 0x00, 0x16,
    0x30, 0x16, 0x60, 0x16, 0x90, 0x16, 0xc0, 0x16, 0x00, 0x18, 0x30, 0x18, 0x60, 0x18, 0x90, 0x18,
    0xc0, 0x18, 0x00, 0x1a, 0x30, 0x1a,
  ]);
  rom.writeBytes(0x39d78, SHARED_PTR_PATCH_39D78);

  return rom;
}

describe('TeamNameWriter Edge Cases', () => {
  describe('Slot size and truncation', () => {
    it('should not corrupt adjacent team names when expanding', () => {
      const rom = createMockRomWithTeamNames();

      // Read all names before
      const namesBefore = [];
      for (let i = 0; i < 27; i++) {
        namesBefore.push(readTeamNameText(rom, i));
      }

      // Write a longer name to team 0 (Germany → longer name)
      writeTeamNameMenu(rom, 0, 'LONGNAME');

      // Check that all other teams still read correctly
      for (let i = 1; i < 27; i++) {
        const nameAfter = readTeamNameText(rom, i);
        expect(nameAfter).toBe(namesBefore[i]);
      }
    });

    it('should not corrupt adjacent team names when shrinking', () => {
      const rom = createMockRomWithTeamNames();

      const namesBefore = [];
      for (let i = 0; i < 27; i++) {
        namesBefore.push(readTeamNameText(rom, i));
      }

      // Write a shorter name to team 0 (GERMANY → AB)
      writeTeamNameMenu(rom, 0, 'AB');

      for (let i = 1; i < 27; i++) {
        const nameAfter = readTeamNameText(rom, i);
        expect(nameAfter).toBe(namesBefore[i]);
      }
    });

    it('should handle multiple sequential writes without corruption', () => {
      const rom = createMockRomWithTeamNames();

      // Write different sized names to several teams
      writeTeamNameMenu(rom, 0, 'ABCDEFGH');
      writeTeamNameMenu(rom, 5, 'XY');
      writeTeamNameMenu(rom, 18, 'BRASIL');

      expect(readTeamNameText(rom, 0)).toBe('ABCDEFGH');
      expect(readTeamNameText(rom, 5)).toBe('XY');
      expect(readTeamNameText(rom, 18)).toBe('BRASIL');
    });

    it('should handle writing the same name multiple times (idempotent)', () => {
      const rom = createMockRomWithTeamNames();

      writeTeamNameMenu(rom, 0, 'TEST');
      writeTeamNameMenu(rom, 0, 'TEST');
      writeTeamNameMenu(rom, 0, 'TEST');

      expect(readTeamNameText(rom, 0)).toBe('TEST');

      // Other teams should be fine
      expect(readTeamNameText(rom, 18)).toBe('BRAZIL');
    });

    it('should handle replacing with same-size name (no shift needed)', () => {
      const rom = createMockRomWithTeamNames();

      // GERMANY and IRELAND are both 7 chars — similar data sizes
      const namesBefore = [];
      for (let i = 1; i < 27; i++) {
        namesBefore.push(readTeamNameText(rom, i));
      }

      writeTeamNameMenu(rom, 0, 'WAKANDA'); // 7 chars like GERMANY

      for (let i = 1; i < 27; i++) {
        expect(readTeamNameText(rom, i)).toBe(namesBefore[i - 1]);
      }
    });
  });

  describe('getSlotMaxChars', () => {
    it('should return a positive number for each team', () => {
      const rom = createMockRomWithTeamNames();
      for (let i = 0; i < 27; i++) {
        const maxChars = getSlotMaxChars(rom, i);
        expect(maxChars).toBeGreaterThan(0);
        expect(maxChars).toBeLessThanOrEqual(10);
      }
    });

    it('should reflect slot size after writing a shorter name', () => {
      const rom = createMockRomWithTeamNames();
      const originalMax = getSlotMaxChars(rom, 0);

      // After writing a shorter name, the slot shrinks
      writeTeamNameMenu(rom, 0, 'AB');
      const newMax = getSlotMaxChars(rom, 0);

      // The new max should be <= original (slot was shrunk)
      expect(newMax).toBeLessThanOrEqual(originalMax);
    });
  });

  describe('Boundary: very short names', () => {
    it('should handle single character name', () => {
      const rom = createMockRomWithTeamNames();
      writeTeamNameMenu(rom, 0, 'A');
      const name = readTeamNameText(rom, 0);
      expect(name).toBe('A');
    });

    it('should handle two character name', () => {
      const rom = createMockRomWithTeamNames();
      writeTeamNameMenu(rom, 0, 'UK');
      const name = readTeamNameText(rom, 0);
      expect(name).toBe('UK');
    });
  });

  describe('Boundary: names with consecutive chars (pair optimization)', () => {
    it('should handle AB pair (combined top tile)', () => {
      const rom = createMockRomWithTeamNames();
      writeTeamNameMenu(rom, 0, 'AB');
      const name = readTeamNameText(rom, 0);
      expect(name).toBe('AB');
    });

    it('should handle multiple consecutive pairs', () => {
      const rom = createMockRomWithTeamNames();
      writeTeamNameMenu(rom, 0, 'ABCDEF');
      const name = readTeamNameText(rom, 0);
      expect(name).toBe('ABCDEF');
    });

    it('should handle non-consecutive chars (no pair optimization)', () => {
      const rom = createMockRomWithTeamNames();
      writeTeamNameMenu(rom, 0, 'AXZ');
      const name = readTeamNameText(rom, 0);
      expect(name).toBe('AXZ');
    });
  });

  describe('Data integrity across all 27 teams', () => {
    it('should write unique names to all 27 teams and read them all back', () => {
      const rom = createMockRomWithTeamNames();
      const testNames = [
        'ALFA',
        'BETA',
        'GAMA',
        'DELTA',
        'OMEGA',
        'PRIME',
        'TITAN',
        'ATLAS',
        'ZEUS',
        'HERA',
        'ARES',
        'APOLO',
        'HERMES',
        'NIKE',
        'ISIS',
        'ODIN',
        'THOR',
        'LOKI',
        'FREYA',
        'TYR',
        'FENRIR',
        'MJOLNR',
        'VALKYR',
        'SIGURD',
        'RAGNA',
        'BIFROST',
        'ASGARD',
      ];

      // Write all
      for (let i = 0; i < 27; i++) {
        writeTeamNameMenu(rom, i, testNames[i]);
      }

      // Read all and verify
      for (let i = 0; i < 27; i++) {
        const name = readTeamNameText(rom, i);
        expect(name).toBe(testNames[i]);
      }
    });
  });
});
