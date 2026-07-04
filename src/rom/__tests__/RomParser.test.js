import { describe, it, expect } from 'vitest';
import RomParser from '../RomParser';
import { ISS_CHAR_TABLE, ISS_CHAR_REVERSE, PLAYER_NAMES } from '../constants';

describe('RomParser', () => {
  // Create a minimal 1MB ROM with a valid SNES header
  function createMockRom(size = 1048576) {
    const data = new Uint8Array(size);
    const headerOffset = size % 1024 === 512 ? 512 : 0;
    // Write ISS internal title at LoROM header 0x7FC0
    const title = 'INTERNATIONAL SS     ';
    for (let i = 0; i < 21; i++) {
      data[headerOffset + 0x7fc0 + i] = title.charCodeAt(i);
    }
    // Map mode (LoROM)
    data[headerOffset + 0x7fc0 + 0x15] = 0x20;
    return data;
  }

  describe('constructor', () => {
    it('should detect no-header ROM (size % 1024 === 0)', () => {
      const rom = new RomParser(createMockRom(1048576));
      expect(rom.hasHeader).toBe(false);
      expect(rom.headerOffset).toBe(0);
    });

    it('should detect header ROM (size % 1024 === 512)', () => {
      const rom = new RomParser(createMockRom(1048576 + 512));
      expect(rom.hasHeader).toBe(true);
      expect(rom.headerOffset).toBe(512);
    });
  });

  describe('byte access', () => {
    it('should read and write bytes correctly', () => {
      const rom = new RomParser(createMockRom());
      rom.writeByte(0x100, 0xab);
      expect(rom.readByte(0x100)).toBe(0xab);
    });

    it('should read and write byte arrays', () => {
      const rom = new RomParser(createMockRom());
      const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      rom.writeBytes(0x200, data);

      const read = rom.readBytes(0x200, 4);
      expect(read[0]).toBe(0x01);
      expect(read[1]).toBe(0x02);
      expect(read[2]).toBe(0x03);
      expect(read[3]).toBe(0x04);
    });

    it('should handle header offset in reads/writes', () => {
      const rom = new RomParser(createMockRom(1048576 + 512));
      rom.writeByte(0x00, 0xff);
      // The byte at logical address 0x00 should be at physical offset 512
      expect(rom.data[512]).toBe(0xff);
    });
  });

  describe('validate', () => {
    it('should validate a 1MB ROM', () => {
      const rom = new RomParser(createMockRom());
      const result = rom.validate();
      expect(result.isValid).toBe(true);
    });

    it('should reject a too-small ROM', () => {
      const rom = new RomParser(new Uint8Array(1000));
      const result = rom.validate();
      expect(result.isValid).toBe(false);
    });
  });

  describe('player name encoding', () => {
    it('should write and read player names correctly', () => {
      const rom = new RomParser(createMockRom());

      // Write "RONALDO" to team 0, player 0
      rom.writePlayerName(0, 0, 'RONALDO');

      // Read it back
      const names = rom.readPlayerNames(0);
      expect(names[0]).toBe('RONALDO');
    });

    it('should pad names with spaces to 8 chars', () => {
      const rom = new RomParser(createMockRom());
      rom.writePlayerName(0, 0, 'AB');
      const names = rom.readPlayerNames(0);
      expect(names[0]).toBe('AB');
    });

    it('should handle all valid characters', () => {
      const rom = new RomParser(createMockRom());
      rom.writePlayerName(0, 0, 'A.z9');
      const names = rom.readPlayerNames(0);
      expect(names[0]).toBe('A.z9');
    });
  });
});

describe('ISS Character Table', () => {
  it('should map uppercase A-Z correctly', () => {
    expect(ISS_CHAR_TABLE[0x6c]).toBe('A');
    expect(ISS_CHAR_TABLE[0x85]).toBe('Z');
  });

  it('should map lowercase a-z correctly', () => {
    expect(ISS_CHAR_TABLE[0x86]).toBe('a');
    expect(ISS_CHAR_TABLE[0x9f]).toBe('z');
  });

  it('should map digits 0-9 correctly', () => {
    expect(ISS_CHAR_TABLE[0x62]).toBe('0');
    expect(ISS_CHAR_TABLE[0x6b]).toBe('9');
  });

  it('should have consistent reverse mapping', () => {
    for (const [byte, char] of Object.entries(ISS_CHAR_TABLE)) {
      expect(ISS_CHAR_REVERSE[char]).toBe(parseInt(byte));
    }
  });
});
