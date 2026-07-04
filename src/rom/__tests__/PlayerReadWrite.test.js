import { describe, it, expect } from 'vitest';
import { readPlayerNames, readPlayerData } from '../readers/PlayerReader';
import { writePlayerName, writePlayerData } from '../writers/PlayerWriter';
import { SHOOTING_VALUES, ISS_CHAR_TABLE, ISS_CHAR_REVERSE, PLAYERS_PER_TEAM } from '../constants';
import RomParser from '../RomParser';

function createMockRom(size = 1048576) {
  return new RomParser(new Uint8Array(size));
}

describe('PlayerReader/PlayerWriter Roundtrip', () => {
  describe('Player Names', () => {
    it('should write and read back a simple uppercase name', () => {
      const rom = createMockRom();
      writePlayerName(rom, 0, 0, 'RONALDO');
      const names = readPlayerNames(rom, 0);
      expect(names[0]).toBe('RONALDO');
    });

    it('should write and read back a name with dot', () => {
      const rom = createMockRom();
      writePlayerName(rom, 0, 0, 'R.CARLOS');
      const names = readPlayerNames(rom, 0);
      expect(names[0]).toBe('R.CARLOS');
    });

    it('should write and read back a lowercase name', () => {
      const rom = createMockRom();
      writePlayerName(rom, 0, 0, 'Zidane');
      const names = readPlayerNames(rom, 0);
      expect(names[0]).toBe('Zidane');
    });

    it('should pad short names with spaces (trimmed on read)', () => {
      const rom = createMockRom();
      writePlayerName(rom, 0, 0, 'AB');
      const names = readPlayerNames(rom, 0);
      expect(names[0]).toBe('AB');
    });

    it('should handle max length name (8 chars)', () => {
      const rom = createMockRom();
      writePlayerName(rom, 0, 0, 'ABCDEFGH');
      const names = readPlayerNames(rom, 0);
      expect(names[0]).toBe('ABCDEFGH');
    });

    it('should roundtrip names for all 15 players in a team', () => {
      const rom = createMockRom();
      const testNames = [
        'PLAYER01',
        'PLAYER02',
        'PLAYER03',
        'PLAYER04',
        'PLAYER05',
        'PLAYER06',
        'PLAYER07',
        'PLAYER08',
        'PLAYER09',
        'PLAYER10',
        'PLAYER11',
        'PLAYER12',
        'PLAYER13',
        'PLAYER14',
        'PLAYER15',
      ];
      testNames.forEach((name, i) => writePlayerName(rom, 0, i, name));
      const readNames = readPlayerNames(rom, 0);
      testNames.forEach((name, i) => expect(readNames[i]).toBe(name));
    });

    it('should not corrupt other teams when writing', () => {
      const rom = createMockRom();
      writePlayerName(rom, 0, 0, 'TEAM0');
      writePlayerName(rom, 1, 0, 'TEAM1');
      writePlayerName(rom, 2, 0, 'TEAM2');

      expect(readPlayerNames(rom, 0)[0]).toBe('TEAM0');
      expect(readPlayerNames(rom, 1)[0]).toBe('TEAM1');
      expect(readPlayerNames(rom, 2)[0]).toBe('TEAM2');
    });

    it('should handle names with digits', () => {
      const rom = createMockRom();
      writePlayerName(rom, 0, 0, 'CR7');
      const names = readPlayerNames(rom, 0);
      expect(names[0]).toBe('CR7');
    });

    it('should handle all valid characters in roundtrip', () => {
      const rom = createMockRom();
      // Test various valid chars: uppercase, lowercase, digits, dot
      writePlayerName(rom, 0, 0, 'Ab.9');
      const names = readPlayerNames(rom, 0);
      expect(names[0]).toBe('Ab.9');
    });
  });

  describe('Player Data (attributes)', () => {
    it('should roundtrip shooting value', () => {
      const rom = createMockRom();
      const data = {
        shootingIndex: 5,
        shooting: 11,
        speed: 10,
        stamina: 12,
        techniqueIndex: 3,
        technique: 7,
        number: 10,
        hairStyle: 2,
        isSpecial: false,
        rawBytes: [0, 0, 0, 0, 0, 0],
      };
      writePlayerData(rom, 0, 0, data);
      const result = readPlayerData(rom, 0);
      expect(result[0].shootingIndex).toBe(5);
      expect(result[0].shooting).toBe(11);
    });

    it('should roundtrip speed value', () => {
      const rom = createMockRom();
      const data = {
        shootingIndex: 3,
        shooting: 7,
        speed: 14,
        stamina: 8,
        techniqueIndex: 2,
        technique: 5,
        number: 7,
        hairStyle: 0,
        isSpecial: false,
        rawBytes: [0, 0, 0, 0, 0, 0],
      };
      writePlayerData(rom, 0, 0, data);
      const result = readPlayerData(rom, 0);
      expect(result[0].speed).toBe(14);
    });

    it('should roundtrip stamina value', () => {
      const rom = createMockRom();
      const data = {
        shootingIndex: 0,
        shooting: 1,
        speed: 1,
        stamina: 16,
        techniqueIndex: 0,
        technique: 1,
        number: 1,
        hairStyle: 0,
        isSpecial: false,
        rawBytes: [0, 0, 0, 0, 0, 0],
      };
      writePlayerData(rom, 0, 0, data);
      const result = readPlayerData(rom, 0);
      expect(result[0].stamina).toBe(16);
    });

    it('should roundtrip technique value', () => {
      const rom = createMockRom();
      const data = {
        shootingIndex: 2,
        shooting: 5,
        speed: 8,
        stamina: 10,
        techniqueIndex: 6,
        technique: 13,
        number: 5,
        hairStyle: 0,
        isSpecial: false,
        rawBytes: [0, 0, 0, 0, 0, 0],
      };
      writePlayerData(rom, 0, 0, data);
      const result = readPlayerData(rom, 0);
      expect(result[0].techniqueIndex).toBe(6);
      expect(result[0].technique).toBe(13);
    });

    it('should roundtrip player number', () => {
      const rom = createMockRom();
      const data = {
        shootingIndex: 3,
        shooting: 7,
        speed: 5,
        stamina: 5,
        techniqueIndex: 3,
        technique: 7,
        number: 10,
        hairStyle: 0,
        isSpecial: false,
        rawBytes: [0, 0, 0, 0, 0, 0],
      };
      writePlayerData(rom, 0, 0, data);
      const result = readPlayerData(rom, 0);
      expect(result[0].number).toBe(10);
    });

    it('should roundtrip hair style', () => {
      const rom = createMockRom();
      const data = {
        shootingIndex: 1,
        shooting: 3,
        speed: 6,
        stamina: 9,
        techniqueIndex: 1,
        technique: 3,
        number: 3,
        hairStyle: 7,
        isSpecial: false,
        rawBytes: [0, 0, 0, 0, 0, 0],
      };
      writePlayerData(rom, 0, 0, data);
      const result = readPlayerData(rom, 0);
      expect(result[0].hairStyle).toBe(7);
    });

    it('should roundtrip isSpecial flag', () => {
      const rom = createMockRom();
      const dataSpecial = {
        shootingIndex: 4,
        shooting: 9,
        speed: 12,
        stamina: 14,
        techniqueIndex: 5,
        technique: 11,
        number: 9,
        hairStyle: 5,
        isSpecial: true,
        rawBytes: [0, 0, 0, 0, 0, 0],
      };
      writePlayerData(rom, 0, 0, dataSpecial);
      const result = readPlayerData(rom, 0);
      expect(result[0].isSpecial).toBe(true);

      const dataNormal = { ...dataSpecial, isSpecial: false };
      writePlayerData(rom, 0, 1, dataNormal);
      const result2 = readPlayerData(rom, 0);
      expect(result2[1].isSpecial).toBe(false);
    });

    it('should roundtrip a complete player profile', () => {
      const rom = createMockRom();
      const input = {
        shootingIndex: 7,
        shooting: 15,
        speed: 15,
        stamina: 16,
        techniqueIndex: 7,
        technique: 15,
        number: 10,
        hairStyle: 0,
        isSpecial: true,
        rawBytes: [0, 0, 0, 0, 0, 0],
      };
      writePlayerData(rom, 0, 0, input);
      const result = readPlayerData(rom, 0);

      expect(result[0].shootingIndex).toBe(7);
      expect(result[0].shooting).toBe(15);
      expect(result[0].speed).toBe(15);
      expect(result[0].stamina).toBe(16);
      expect(result[0].techniqueIndex).toBe(7);
      expect(result[0].technique).toBe(15);
      expect(result[0].number).toBe(10);
      expect(result[0].hairStyle).toBe(0);
      expect(result[0].isSpecial).toBe(true);
    });

    it('should not corrupt adjacent players when writing', () => {
      const rom = createMockRom();
      const player0 = {
        shootingIndex: 7,
        shooting: 15,
        speed: 15,
        stamina: 16,
        techniqueIndex: 7,
        technique: 15,
        number: 10,
        hairStyle: 3,
        isSpecial: true,
        rawBytes: [0, 0, 0, 0, 0, 0],
      };
      const player1 = {
        shootingIndex: 2,
        shooting: 5,
        speed: 8,
        stamina: 10,
        techniqueIndex: 1,
        technique: 3,
        number: 7,
        hairStyle: 8,
        isSpecial: false,
        rawBytes: [0, 0, 0, 0, 0, 0],
      };

      writePlayerData(rom, 0, 0, player0);
      writePlayerData(rom, 0, 1, player1);

      const results = readPlayerData(rom, 0);
      expect(results[0].number).toBe(10);
      expect(results[0].hairStyle).toBe(3);
      expect(results[1].number).toBe(7);
      expect(results[1].hairStyle).toBe(8);
    });

    it('should handle boundary values (min/max)', () => {
      const rom = createMockRom();
      const minPlayer = {
        shootingIndex: 0,
        shooting: 1,
        speed: 1,
        stamina: 1,
        techniqueIndex: 0,
        technique: 1,
        number: 1,
        hairStyle: 0,
        isSpecial: false,
        rawBytes: [0, 0, 0, 0, 0, 0],
      };
      writePlayerData(rom, 0, 0, minPlayer);
      const result = readPlayerData(rom, 0);
      expect(result[0].shooting).toBe(1);
      expect(result[0].speed).toBe(1);
      expect(result[0].stamina).toBe(1);
      expect(result[0].number).toBe(1);

      const maxPlayer = {
        shootingIndex: 7,
        shooting: 15,
        speed: 16,
        stamina: 16,
        techniqueIndex: 7,
        technique: 15,
        number: 16,
        hairStyle: 10,
        isSpecial: true,
        rawBytes: [0, 0, 0, 0, 0, 0],
      };
      writePlayerData(rom, 0, 1, maxPlayer);
      const result2 = readPlayerData(rom, 0);
      expect(result2[1].shooting).toBe(15);
      expect(result2[1].speed).toBe(16);
      expect(result2[1].stamina).toBe(16);
      expect(result2[1].number).toBe(16);
      expect(result2[1].hairStyle).toBe(10);
    });
  });
});
