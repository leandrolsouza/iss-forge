import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { TEAMS } from '../constants';
import { readFlagDesign } from '../readers/FlagDesignReader';
import { writeFlagDesign } from '../writers/FlagDesignWriter';
import { konamiCompress } from '../KonamiCodec';
import RomParser from '../RomParser';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);

/**
 * Create a mock ROM pre-populated with valid flag pointer table
 * and compressed tile data so the reader/writer can function.
 */
function createMockRomWithFlags() {
  const rom = new RomParser(new Uint8Array(1048576));

  // Set up pointer table at 0x941A (4 bytes per team: 2 for top, 2 for bottom)
  // Point all teams to a known address with valid compressed data
  // Use addresses within the valid flag region (0x44000 to 0x48A7F)
  const FLAG_POINTER_OFFSET = 0x941a;
  const FLAG_POINTER_STEP = 4;

  for (let i = 0; i < 27; i++) {
    // Top pointer for team i → 0x44000 + i * 0x100
    const topAddr = 0x44000 + i * 0x100;
    const bottomAddr = 0x44000 + i * 0x100 + 0x80;

    const topRelative = topAddr - 0x40000;
    const bottomRelative = bottomAddr - 0x40000;

    // Write pointer bytes (format: addr = 0x40000 + (b2<<8) + b1)
    rom.writeByte(FLAG_POINTER_OFFSET + i * FLAG_POINTER_STEP, topRelative & 0xff);
    rom.writeByte(FLAG_POINTER_OFFSET + i * FLAG_POINTER_STEP + 1, (topRelative >> 8) & 0xff);
    rom.writeByte(FLAG_POINTER_OFFSET + i * FLAG_POINTER_STEP + 2, bottomRelative & 0xff);
    rom.writeByte(FLAG_POINTER_OFFSET + i * FLAG_POINTER_STEP + 3, (bottomRelative >> 8) & 0xff);

    // Write valid compressed data at both addresses
    // A 96-byte all-zero tile block (8×24 grid, all transparent)
    const zeroTiles = new Uint8Array(96);
    const compressed = konamiCompress(zeroTiles, 1);
    rom.writeBytes(topAddr, compressed);
    rom.writeBytes(bottomAddr, compressed);
  }

  return rom;
}

describe('FlagDesignReader/FlagDesignWriter Roundtrip', () => {
  it('should read an all-zero (transparent) flag grid', () => {
    const rom = createMockRomWithFlags();
    const result = readFlagDesign(rom, 0);
    expect(result.grid).toHaveLength(16);
    expect(result.grid[0]).toHaveLength(24);
    // All should be 0 (transparent = mapped from palette index 0)
    result.grid.forEach((row) => row.forEach((pixel) => expect(pixel).toBe(0)));
  });

  it('should roundtrip a flag with solid color in top-left quadrant', () => {
    const rom = createMockRomWithFlags();

    // Create a 16×24 grid: top-left 8×12 = color 1, rest = 0
    const grid = Array.from({ length: 16 }, () => new Array(24).fill(0));
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 12; col++) {
        grid[row][col] = 1; // palette index 1
      }
    }

    writeFlagDesign(rom, 0, grid);
    const result = readFlagDesign(rom, 0);

    // Verify top-left quadrant is color 1
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 12; col++) {
        expect(result.grid[row][col]).toBe(1);
      }
    }
    // Verify rest is 0
    for (let row = 0; row < 8; row++) {
      for (let col = 12; col < 24; col++) {
        expect(result.grid[row][col]).toBe(0);
      }
    }
  });

  it('should roundtrip a flag using all 5 palette indices', () => {
    const rom = createMockRomWithFlags();

    // Create a striped flag: each row uses a different color (repeating)
    const grid = Array.from({ length: 16 }, (_, row) => new Array(24).fill(row % 5));

    writeFlagDesign(rom, 0, grid);
    const result = readFlagDesign(rom, 0);

    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 24; col++) {
        expect(result.grid[row][col]).toBe(row % 5);
      }
    }
  });

  it('should roundtrip a checkerboard pattern', () => {
    const rom = createMockRomWithFlags();

    const grid = Array.from({ length: 16 }, (_, row) =>
      Array.from({ length: 24 }, (_, col) => ((row + col) % 2 === 0 ? 1 : 2)),
    );

    writeFlagDesign(rom, 0, grid);
    const result = readFlagDesign(rom, 0);

    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 24; col++) {
        expect(result.grid[row][col]).toBe((row + col) % 2 === 0 ? 1 : 2);
      }
    }
  });

  it('should not corrupt other teams flag designs when writing', () => {
    const rom = createMockRomWithFlags();

    // Write distinct patterns to two teams
    const grid0 = Array.from({ length: 16 }, () => new Array(24).fill(1));
    const grid1 = Array.from({ length: 16 }, () => new Array(24).fill(2));

    writeFlagDesign(rom, 0, grid0); // Germany
    writeFlagDesign(rom, 1, grid1); // Italy

    const result0 = readFlagDesign(rom, 0);
    const result1 = readFlagDesign(rom, 1);

    expect(result0.grid[0][0]).toBe(1);
    expect(result1.grid[0][0]).toBe(2);
  });

  it('should handle the tricolor flag pattern (3 vertical stripes)', () => {
    const rom = createMockRomWithFlags();

    // Italian flag: green (1) | white (3) | red (4) in 3 equal vertical stripes
    const grid = Array.from({ length: 16 }, () => {
      const row = new Array(24).fill(0);
      for (let col = 0; col < 8; col++) row[col] = 1;
      for (let col = 8; col < 16; col++) row[col] = 3;
      for (let col = 16; col < 24; col++) row[col] = 4;
      return row;
    });

    writeFlagDesign(rom, 1, grid);
    const result = readFlagDesign(rom, 1);

    expect(result.grid[0][0]).toBe(1);
    expect(result.grid[0][8]).toBe(3);
    expect(result.grid[0][16]).toBe(4);
    expect(result.grid[15][4]).toBe(1);
    expect(result.grid[15][12]).toBe(3);
    expect(result.grid[15][20]).toBe(4);
  });
});

describe.skipIf(!existsSync(REAL_ROM))('flag design writes on the real ROM', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
  const noisy = (seed) =>
    Array.from({ length: 16 }, (_, y) =>
      Array.from({ length: 24 }, (_, x) => (x * 3 + y * 5 + ((x * y + seed) % 4)) % 5),
    );

  it('a bigger flag moves the blocks after it and keeps every other flag', () => {
    const rom = load();
    const brazil = TEAMS.findIndex((t) => t.id === 'BRAZIL');
    expect(rom.flagSharedWith(brazil)).toEqual([]); // own blocks: the relocation path
    const before = TEAMS.map((_, i) => rom.readFlagDesign(i).grid);
    const grid = noisy(1);
    expect(writeFlagDesign(rom, brazil, grid)).toBe(true);
    TEAMS.forEach((_, i) =>
      expect(rom.readFlagDesign(i).grid).toEqual(i === brazil ? grid : before[i]),
    );
  });

  it('refuses a flag when the area is full and leaves the ROM untouched', () => {
    const rom = load();
    let refused = false;
    for (let i = 0; i < TEAMS.length && !refused; i++) {
      const snap = rom.readFlagDesignBytes();
      if (!writeFlagDesign(rom, i, noisy(i + 7))) {
        refused = true;
        expect(rom.readFlagDesignBytes()).toEqual(snap);
      }
    }
    expect(refused).toBe(true);
  });
});
