import { describe, it, expect } from 'vitest';
import {
  konamiCompress,
  konamiDecompress,
  encodeSnes4bppTiles,
  decodeSnes4bppTiles,
} from '../KonamiCodec';

/**
 * Stress tests for KonamiCodec with larger and more complex data patterns.
 * These tests exercise codepaths (LZ window, RLE boundaries) that small
 * data (8-32 bytes) may never reach.
 */

// Seeded pseudo-random for deterministic tests
function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0xffffffff;
  };
}

function randomBytes(length, seed = 42) {
  const rng = seededRandom(seed);
  const data = new Uint8Array(length);
  for (let i = 0; i < length; i++) data[i] = Math.floor(rng() * 256);
  return data;
}

describe('KonamiCodec Stress Tests', () => {
  describe('Compress/Decompress roundtrip with larger data', () => {
    it('should roundtrip 96 bytes (flag tile size)', () => {
      const original = randomBytes(96, 1);
      const compressed = konamiCompress(original, 1);
      const decompressed = konamiDecompress(compressed, 0, 1);
      expect(decompressed.length).toBe(96);
      for (let i = 0; i < 96; i++) {
        expect(decompressed[i]).toBe(original[i]);
      }
    });

    it('should roundtrip 64 bytes (team name tile size)', () => {
      const original = randomBytes(64, 2);
      const compressed = konamiCompress(original, 1);
      const decompressed = konamiDecompress(compressed, 0, 1);
      expect(decompressed.length).toBe(64);
      for (let i = 0; i < 64; i++) {
        expect(decompressed[i]).toBe(original[i]);
      }
    });

    it('should roundtrip 256 bytes (large block)', () => {
      const original = randomBytes(256, 3);
      const compressed = konamiCompress(original, 1);
      const decompressed = konamiDecompress(compressed, 0, 1);
      expect(decompressed.length).toBe(256);
      for (let i = 0; i < 256; i++) {
        expect(decompressed[i]).toBe(original[i]);
      }
    });

    it('should roundtrip 512 bytes', () => {
      const original = randomBytes(512, 4);
      const compressed = konamiCompress(original, 1);
      const decompressed = konamiDecompress(compressed, 0, 1);
      expect(decompressed.length).toBe(512);
      for (let i = 0; i < 512; i++) {
        expect(decompressed[i]).toBe(original[i]);
      }
    });

    it('should roundtrip data with long zero runs (exercises RLE_E0)', () => {
      const original = new Uint8Array(200);
      // Zero from 0..49, data from 50..99, zero from 100..149, data from 150..199
      for (let i = 50; i < 100; i++) original[i] = 0xaa;
      for (let i = 150; i < 200; i++) original[i] = 0xbb;

      const compressed = konamiCompress(original, 1);
      const decompressed = konamiDecompress(compressed, 0, 1);
      expect(decompressed.length).toBe(200);
      for (let i = 0; i < 200; i++) {
        expect(decompressed[i]).toBe(original[i]);
      }
    });

    it('should roundtrip data with repeated byte patterns (exercises RLE_C0)', () => {
      const original = new Uint8Array(150);
      // 40 repetitions of 0x42, then 30 of 0xFF, then mixed
      for (let i = 0; i < 40; i++) original[i] = 0x42;
      for (let i = 40; i < 70; i++) original[i] = 0xff;
      for (let i = 70; i < 150; i++) original[i] = i & 0xff;

      const compressed = konamiCompress(original, 1);
      const decompressed = konamiDecompress(compressed, 0, 1);
      expect(decompressed.length).toBe(150);
      for (let i = 0; i < 150; i++) {
        expect(decompressed[i]).toBe(original[i]);
      }
    });

    it('should roundtrip data at RLE boundary (exactly 33 repetitions)', () => {
      // MAX_LENGTH = 33 for RLE — test boundary
      const original = new Uint8Array(66);
      for (let i = 0; i < 33; i++) original[i] = 0xaa;
      for (let i = 33; i < 66; i++) original[i] = 0xbb;

      const compressed = konamiCompress(original, 1);
      const decompressed = konamiDecompress(compressed, 0, 1);
      expect(decompressed.length).toBe(66);
      for (let i = 0; i < 33; i++) expect(decompressed[i]).toBe(0xaa);
      for (let i = 33; i < 66; i++) expect(decompressed[i]).toBe(0xbb);
    });

    it('should roundtrip data at zero-run boundary (exactly 257 zeros)', () => {
      // MAX_ZERO_LENGTH = 257 for gameType=1
      const original = new Uint8Array(260);
      // 257 zeros then 3 bytes of data
      original[257] = 0xde;
      original[258] = 0xad;
      original[259] = 0xbe;

      const compressed = konamiCompress(original, 1);
      const decompressed = konamiDecompress(compressed, 0, 1);
      expect(decompressed.length).toBe(260);
      for (let i = 0; i < 257; i++) expect(decompressed[i]).toBe(0);
      expect(decompressed[257]).toBe(0xde);
      expect(decompressed[258]).toBe(0xad);
      expect(decompressed[259]).toBe(0xbe);
    });

    it('should roundtrip data with alternating patterns', () => {
      const original = new Uint8Array(100);
      for (let i = 0; i < 100; i++) original[i] = i % 2 === 0 ? 0xaa : 0x55;

      const compressed = konamiCompress(original, 1);
      const decompressed = konamiDecompress(compressed, 0, 1);
      expect(decompressed.length).toBe(100);
      for (let i = 0; i < 100; i++) {
        expect(decompressed[i]).toBe(original[i]);
      }
    });

    it('should compress data smaller than original (RLE-friendly)', () => {
      // 100 zeros should compress to much less than 100 bytes
      const original = new Uint8Array(100);
      const compressed = konamiCompress(original, 1);
      // Compressed should be smaller (2 byte header + minimal RLE)
      expect(compressed.length).toBeLessThan(original.length);
    });

    it('should handle multiple random seeds without failure', () => {
      for (let seed = 10; seed < 20; seed++) {
        const original = randomBytes(96, seed);
        const compressed = konamiCompress(original, 1);
        const decompressed = konamiDecompress(compressed, 0, 1);
        expect(decompressed.length).toBe(96);
        for (let i = 0; i < 96; i++) {
          expect(decompressed[i]).toBe(original[i]);
        }
      }
    });
  });

  describe('4bpp Tile roundtrip with realistic flag data', () => {
    it('should roundtrip a full 96-byte tile block (3 tiles)', () => {
      const original = randomBytes(96, 100);
      const grid = decodeSnes4bppTiles(original);
      const reencoded = encodeSnes4bppTiles(grid);
      expect(reencoded.length).toBe(96);
      for (let i = 0; i < 96; i++) {
        expect(reencoded[i]).toBe(original[i]);
      }
    });

    it('should roundtrip a grid with all 16 palette colors', () => {
      // Create a grid where each column uses a different color (cycling 0-15)
      const grid = Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 24 }, (_, col) => (row * 24 + col) % 16),
      );
      const encoded = encodeSnes4bppTiles(grid);
      const decoded = decodeSnes4bppTiles(encoded);
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 24; col++) {
          expect(decoded[row][col]).toBe(grid[row][col]);
        }
      }
    });

    it('should roundtrip a diagonal gradient pattern', () => {
      const grid = Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 24 }, (_, col) => (row + col) % 16),
      );
      const encoded = encodeSnes4bppTiles(grid);
      const decoded = decodeSnes4bppTiles(encoded);
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 24; col++) {
          expect(decoded[row][col]).toBe(grid[row][col]);
        }
      }
    });
  });
});
