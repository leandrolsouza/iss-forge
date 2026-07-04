import { describe, it, expect } from 'vitest';
import {
  konamiDecompress,
  konamiCompress,
  decodeSnes4bppTiles,
  encodeSnes4bppTiles,
} from '../KonamiCodec';

describe('KonamiCodec', () => {
  describe('decodeSnes4bppTiles / encodeSnes4bppTiles roundtrip', () => {
    it('should decode and re-encode to identical data', () => {
      // Create a known 96-byte tile data (3 tiles, 4bpp)
      const original = new Uint8Array(96);
      // Fill with a test pattern: tile 0 = all color 12 (0b1100)
      // bp0=0, bp1=0, bp2=1, bp3=1
      for (let row = 0; row < 8; row++) {
        original[row * 2] = 0x00; // bp0
        original[row * 2 + 1] = 0x00; // bp1
        original[16 + row * 2] = 0xff; // bp2
        original[16 + row * 2 + 1] = 0xff; // bp3
      }

      const grid = decodeSnes4bppTiles(original);

      // All pixels in tile 0 should be 12 (0b1100)
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          expect(grid[row][col]).toBe(12);
        }
      }

      // Re-encode
      const reencoded = encodeSnes4bppTiles(grid);
      expect(reencoded.length).toBe(96);

      // First 32 bytes (tile 0) should match
      for (let i = 0; i < 32; i++) {
        expect(reencoded[i]).toBe(original[i]);
      }
    });

    it('should decode transparent pixels (all zeros) correctly', () => {
      const data = new Uint8Array(96); // all zeros
      const grid = decodeSnes4bppTiles(data);

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 24; col++) {
          expect(grid[row][col]).toBe(0);
        }
      }
    });

    it('should handle mixed pixel values', () => {
      const data = new Uint8Array(96);
      // Tile 0, row 0: set bp0 bit 7 = pixel 0 has bit 0 set → value 1
      data[0] = 0x80; // bp0 row 0: MSB set
      data[1] = 0x00; // bp1 row 0
      data[16] = 0x00; // bp2 row 0
      data[17] = 0x00; // bp3 row 0

      const grid = decodeSnes4bppTiles(data);
      expect(grid[0][0]).toBe(1); // pixel at col 0 has bit0=1
      expect(grid[0][1]).toBe(0); // pixel at col 1 has all zeros
    });
  });

  describe('konamiCompress / konamiDecompress roundtrip', () => {
    it('should compress and decompress simple data', () => {
      const original = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0xaa, 0xbb]);

      const compressed = konamiCompress(original, 1);
      expect(compressed.length).toBeGreaterThan(0);
      expect(compressed.length).toBeLessThan(original.length + 10); // reasonable overhead

      // Build a fake "ROM" with compressed data at offset 0
      const fakeRom = compressed;
      const decompressed = konamiDecompress(fakeRom, 0, 1);

      expect(decompressed.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(decompressed[i]).toBe(original[i]);
      }
    });

    it('should handle all-zeros data', () => {
      const original = new Uint8Array(32).fill(0x00);

      const compressed = konamiCompress(original, 1);
      const fakeRom = compressed;
      const decompressed = konamiDecompress(fakeRom, 0, 1);

      expect(decompressed.length).toBe(32);
      for (let i = 0; i < 32; i++) {
        expect(decompressed[i]).toBe(0);
      }
    });

    it('should handle repeated byte pattern', () => {
      const original = new Uint8Array(20).fill(0x42);

      const compressed = konamiCompress(original, 1);
      const decompressed = konamiDecompress(compressed, 0, 1);

      expect(decompressed.length).toBe(20);
      for (let i = 0; i < 20; i++) {
        expect(decompressed[i]).toBe(0x42);
      }
    });
  });
});
