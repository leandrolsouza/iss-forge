import { describe, it, expect } from 'vitest';
import { validateRomFile, quickValidate } from '../romValidator';

/**
 * Helper: build a fake 1MB SNES ROM with a valid LoROM header
 */
function buildFakeRom({ title = 'INTERNATIONAL SS     ', mapMode = 0x20, withHeader = false } = {}) {
  const romSize = 1024 * 1024;
  const totalSize = romSize + (withHeader ? 512 : 0);
  const data = new Uint8Array(totalSize);
  const headerOffset = withHeader ? 512 : 0;

  // Write internal title at LoROM header (0x7FC0)
  const titleBytes = title.padEnd(21, ' ');
  for (let i = 0; i < 21; i++) {
    data[headerOffset + 0x7fc0 + i] = titleBytes.charCodeAt(i);
  }

  // Map mode at 0x7FD5
  data[headerOffset + 0x7fc0 + 0x15] = mapMode;

  // ROM size indicator at 0x7FD7 (10 = 1MB)
  data[headerOffset + 0x7fc0 + 0x17] = 10;

  // Calculate checksum (sum of all ROM bytes)
  let sum = 0;
  for (let i = headerOffset; i < data.length; i++) {
    sum = (sum + data[i]) & 0xffff;
  }

  // Write checksum at 0x7FDE-0x7FDF
  data[headerOffset + 0x7fc0 + 0x1e] = sum & 0xff;
  data[headerOffset + 0x7fc0 + 0x1f] = (sum >> 8) & 0xff;

  // Write complement at 0x7FDC-0x7FDD
  const complement = (0xffff - sum) & 0xffff;
  data[headerOffset + 0x7fc0 + 0x1c] = complement & 0xff;
  data[headerOffset + 0x7fc0 + 0x1d] = (complement >> 8) & 0xff;

  // Recalculate because we changed bytes after initial sum
  let finalSum = 0;
  for (let i = headerOffset; i < data.length; i++) {
    finalSum = (finalSum + data[i]) & 0xffff;
  }
  // Re-write with corrected values
  data[headerOffset + 0x7fc0 + 0x1e] = finalSum & 0xff;
  data[headerOffset + 0x7fc0 + 0x1f] = (finalSum >> 8) & 0xff;
  const finalComplement = (0xffff - finalSum) & 0xffff;
  data[headerOffset + 0x7fc0 + 0x1c] = finalComplement & 0xff;
  data[headerOffset + 0x7fc0 + 0x1d] = (finalComplement >> 8) & 0xff;

  // One more pass to get final checksum right (self-referencing)
  let actualSum = 0;
  for (let i = headerOffset; i < data.length; i++) {
    actualSum = (actualSum + data[i]) & 0xffff;
  }
  data[headerOffset + 0x7fc0 + 0x1e] = actualSum & 0xff;
  data[headerOffset + 0x7fc0 + 0x1f] = (actualSum >> 8) & 0xff;
  const actualComplement = (0xffff - actualSum) & 0xffff;
  data[headerOffset + 0x7fc0 + 0x1c] = actualComplement & 0xff;
  data[headerOffset + 0x7fc0 + 0x1d] = (actualComplement >> 8) & 0xff;

  return data;
}

describe('romValidator', () => {
  describe('validateRomFile', () => {
    it('should validate a correct ISS ROM without header', () => {
      const rom = buildFakeRom();
      const result = validateRomFile(rom);

      expect(result.isValid).toBe(true);
      expect(result.info.hasHeader).toBe(false);
      expect(result.info.internalTitle).toContain('INTERNATIONAL SS');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a correct ISS ROM with copier header', () => {
      const rom = buildFakeRom({ withHeader: true });
      const result = validateRomFile(rom);

      expect(result.isValid).toBe(true);
      expect(result.info.hasHeader).toBe(true);
      expect(result.info.headerOffset).toBe(512);
    });

    it('should reject ROM that is too small', () => {
      const data = new Uint8Array(1024); // 1KB — way too small
      const result = validateRomFile(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('tooSmall');
    });

    it('should reject ROM with unreadable header (no title)', () => {
      // 1MB of zeros — no valid title
      const data = new Uint8Array(1024 * 1024);
      const result = validateRomFile(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('noTitle');
    });

    it('should warn about unknown title', () => {
      const rom = buildFakeRom({ title: 'SOME OTHER GAME      ' });
      const result = validateRomFile(rom);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('unknownTitle');
    });

    it('should warn about Jikkyou World Soccer 2 as valid ISS title', () => {
      const rom = buildFakeRom({ title: 'JIKKYO WORLD SOCCER 2' });
      const result = validateRomFile(rom);

      expect(result.isValid).toBe(true);
      expect(result.warnings).not.toContain('unknownTitle');
    });

    it('should warn about non-standard ROM size', () => {
      // 768 KB — not a standard SNES size
      const data = new Uint8Array(768 * 1024);
      // Write a valid title
      const title = 'INTERNATIONAL SS     ';
      for (let i = 0; i < 21; i++) {
        data[0x7fc0 + i] = title.charCodeAt(i);
      }
      data[0x7fc0 + 0x15] = 0x20; // map mode
      const result = validateRomFile(data);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('nonStandardSize');
      expect(result.warnings).toContain('unexpectedSize');
    });

    it('should detect checksum mismatch on modified ROM', () => {
      const rom = buildFakeRom();
      // Modify a byte (simulating ROM edit without checksum update)
      rom[0x1000] = 0xff;

      const result = validateRomFile(rom);

      expect(result.isValid).toBe(true); // checksum mismatch is a warning, not error
      expect(result.warnings).toContain('checksumMismatch');
    });
  });

  describe('quickValidate', () => {
    it('should return compatible shape with old validate()', () => {
      const rom = buildFakeRom();
      const result = quickValidate(rom);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('hasHeader');
      expect(result).toHaveProperty('headerOffset');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('internalTitle');
      expect(result).toHaveProperty('checksumValid');
    });

    it('should report error key for invalid ROM', () => {
      const data = new Uint8Array(100);
      const result = quickValidate(data);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('validation.tooSmall');
    });

    it('should report OK with warnings count for valid ROM with warnings', () => {
      const rom = buildFakeRom({ title: 'SOME OTHER GAME      ' });
      const result = quickValidate(rom);

      expect(result.isValid).toBe(true);
      expect(result.message).toContain('ROM OK');
      expect(result.message).toContain('warning');
    });
  });
});
