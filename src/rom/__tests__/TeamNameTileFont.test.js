import { describe, it, expect } from 'vitest';
import { renderTextToPixels, encode2bppTiles } from '../TeamNameTileFont';

describe('TeamNameTileFont', () => {
  describe('renderTextToPixels', () => {
    it('should return an 8×32 grid', () => {
      const grid = renderTextToPixels('A');
      expect(grid).toHaveLength(8);
      grid.forEach((row) => expect(row).toHaveLength(32));
    });

    it('should only contain valid color values (0-3)', () => {
      const grid = renderTextToPixels('BRAZIL');
      grid.forEach((row) =>
        row.forEach((pixel) => {
          expect(pixel).toBeGreaterThanOrEqual(0);
          expect(pixel).toBeLessThanOrEqual(3);
        }),
      );
    });

    it('should produce non-empty output for valid text', () => {
      const grid = renderTextToPixels('ABC');
      const hasNonZero = grid.some((row) => row.some((pixel) => pixel !== 0));
      expect(hasNonZero).toBe(true);
    });

    it('should produce all-zero output for empty string', () => {
      const grid = renderTextToPixels('');
      grid.forEach((row) => row.forEach((pixel) => expect(pixel).toBe(0)));
    });

    it('should handle single character', () => {
      const grid = renderTextToPixels('I');
      const hasNonZero = grid.some((row) => row.some((pixel) => pixel !== 0));
      expect(hasNonZero).toBe(true);
    });

    it('should handle digits', () => {
      const grid = renderTextToPixels('123');
      const hasNonZero = grid.some((row) => row.some((pixel) => pixel !== 0));
      expect(hasNonZero).toBe(true);
    });

    it('should handle dot character', () => {
      const grid = renderTextToPixels('A.B');
      const hasNonZero = grid.some((row) => row.some((pixel) => pixel !== 0));
      expect(hasNonZero).toBe(true);
    });

    it('should handle space between letters', () => {
      const grid = renderTextToPixels('A B');
      const hasNonZero = grid.some((row) => row.some((pixel) => pixel !== 0));
      expect(hasNonZero).toBe(true);
    });

    it('should strip invalid characters', () => {
      const gridClean = renderTextToPixels('ABC');
      const gridDirty = renderTextToPixels('A@B#C!');
      // After stripping, both should render "ABC"
      expect(gridClean).toEqual(gridDirty);
    });

    it('should produce different output for different text', () => {
      const grid1 = renderTextToPixels('ABC');
      const grid2 = renderTextToPixels('XYZ');
      expect(grid1).not.toEqual(grid2);
    });

    it('should center text horizontally (short text has leading zeros)', () => {
      const grid = renderTextToPixels('I');
      // "I" is narrow, first column should be 0 (transparent = centering padding)
      expect(grid[0][0]).toBe(0);
    });

    it('should handle maximum width text (ABCDEFGH) without crashing', () => {
      const grid = renderTextToPixels('ABCDEFGH');
      expect(grid).toHaveLength(8);
      grid.forEach((row) => expect(row).toHaveLength(32));
    });

    it('should be deterministic', () => {
      const grid1 = renderTextToPixels('WAKANDA');
      const grid2 = renderTextToPixels('WAKANDA');
      expect(grid1).toEqual(grid2);
    });
  });

  describe('encode2bppTiles', () => {
    it('should return 64 bytes (4 tiles × 16 bytes)', () => {
      const grid = renderTextToPixels('TEST');
      const tiles = encode2bppTiles(grid);
      expect(tiles).toBeInstanceOf(Uint8Array);
      expect(tiles.length).toBe(64);
    });

    it('should encode all-zero grid as all-zero bytes', () => {
      const grid = Array.from({ length: 8 }, () => new Array(32).fill(0));
      const tiles = encode2bppTiles(grid);
      tiles.forEach((byte) => expect(byte).toBe(0));
    });

    it('should encode all-3 grid as all-FF bytes', () => {
      // Color 3 = both bitplanes set = 0xFF for both bp0 and bp1
      const grid = Array.from({ length: 8 }, () => new Array(32).fill(3));
      const tiles = encode2bppTiles(grid);
      tiles.forEach((byte) => expect(byte).toBe(0xff));
    });

    it('should encode color 1 as bp0=FF, bp1=00 per row', () => {
      // Color 1 = bit 0 set, bit 1 clear
      const grid = Array.from({ length: 8 }, () => new Array(32).fill(1));
      const tiles = encode2bppTiles(grid);
      // Each tile: 16 bytes = 8 rows × 2 bytes (bp0, bp1)
      for (let t = 0; t < 4; t++) {
        for (let row = 0; row < 8; row++) {
          expect(tiles[t * 16 + row * 2]).toBe(0xff); // bp0 = all set
          expect(tiles[t * 16 + row * 2 + 1]).toBe(0x00); // bp1 = all clear
        }
      }
    });

    it('should encode color 2 as bp0=00, bp1=FF per row', () => {
      // Color 2 = bit 0 clear, bit 1 set
      const grid = Array.from({ length: 8 }, () => new Array(32).fill(2));
      const tiles = encode2bppTiles(grid);
      for (let t = 0; t < 4; t++) {
        for (let row = 0; row < 8; row++) {
          expect(tiles[t * 16 + row * 2]).toBe(0x00); // bp0 = all clear
          expect(tiles[t * 16 + row * 2 + 1]).toBe(0xff); // bp1 = all set
        }
      }
    });

    it('should produce non-zero output for rendered text', () => {
      const grid = renderTextToPixels('GOAL');
      const tiles = encode2bppTiles(grid);
      const hasNonZero = tiles.some((b) => b !== 0);
      expect(hasNonZero).toBe(true);
    });

    it('should produce deterministic output', () => {
      const grid = renderTextToPixels('WAK');
      const tiles1 = encode2bppTiles(grid);
      const tiles2 = encode2bppTiles(grid);
      expect(tiles1).toEqual(tiles2);
    });
  });
});
