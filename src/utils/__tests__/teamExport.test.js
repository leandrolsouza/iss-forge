import { describe, it, expect } from 'vitest';
import { exportTeam, validateImport, applyImportedTeam } from '../teamExport';
import RomParser from '../../rom/RomParser';
import { konamiCompress } from '../../rom/KonamiCodec';
import { generateTeamNameData } from '../../rom/TeamNameGenerator';

/**
 * Integration test: apply team JSON → read back → export → compare
 * Verifies the entire pipeline doesn't lose data.
 */

// Wakanda team fixture (matches team_json/Wakanda.json)
const WAKANDA = {
  _format: 'iss-forge-team',
  _version: 1,
  name: 'Wakanda',
  id: 'WAKANDA',
  teamNameText: 'WAKANDA',
  teamNameInGame: 'WAK',
  players: [
    {
      name: 'Okoye',
      number: 1,
      shooting: 3,
      shootingIndex: 1,
      speed: 7,
      stamina: 15,
      technique: 9,
      techniqueIndex: 4,
      hairStyle: 8,
      isSpecial: true,
    },
    {
      name: 'Mbaku',
      number: 2,
      shooting: 7,
      shootingIndex: 3,
      speed: 9,
      stamina: 16,
      technique: 7,
      techniqueIndex: 3,
      hairStyle: 8,
      isSpecial: true,
    },
    {
      name: 'Nakia',
      number: 4,
      shooting: 9,
      shootingIndex: 4,
      speed: 12,
      stamina: 14,
      technique: 11,
      techniqueIndex: 5,
      hairStyle: 8,
      isSpecial: true,
    },
    {
      name: 'W.Kabi',
      number: 5,
      shooting: 7,
      shootingIndex: 3,
      speed: 10,
      stamina: 15,
      technique: 9,
      techniqueIndex: 4,
      hairStyle: 0,
      isSpecial: true,
    },
    {
      name: 'Zuri',
      number: 3,
      shooting: 5,
      shootingIndex: 2,
      speed: 8,
      stamina: 13,
      technique: 7,
      techniqueIndex: 3,
      hairStyle: 8,
      isSpecial: true,
    },
    {
      name: 'TChalla',
      number: 10,
      shooting: 15,
      shootingIndex: 7,
      speed: 15,
      stamina: 16,
      technique: 15,
      techniqueIndex: 7,
      hairStyle: 0,
      isSpecial: true,
    },
    {
      name: 'Shuri',
      number: 8,
      shooting: 11,
      shootingIndex: 5,
      speed: 14,
      stamina: 12,
      technique: 15,
      techniqueIndex: 7,
      hairStyle: 8,
      isSpecial: true,
    },
    {
      name: 'Ayo',
      number: 6,
      shooting: 9,
      shootingIndex: 4,
      speed: 13,
      stamina: 15,
      technique: 11,
      techniqueIndex: 5,
      hairStyle: 8,
      isSpecial: true,
    },
    {
      name: 'Aneka',
      number: 7,
      shooting: 11,
      shootingIndex: 5,
      speed: 13,
      stamina: 14,
      technique: 13,
      techniqueIndex: 6,
      hairStyle: 4,
      isSpecial: true,
    },
    {
      name: 'N.Jobu',
      number: 14,
      shooting: 13,
      shootingIndex: 6,
      speed: 10,
      stamina: 13,
      technique: 11,
      techniqueIndex: 5,
      hairStyle: 5,
      isSpecial: true,
    },
    {
      name: 'Killmgr',
      number: 9,
      shooting: 15,
      shootingIndex: 7,
      speed: 14,
      stamina: 14,
      technique: 13,
      techniqueIndex: 6,
      hairStyle: 5,
      isSpecial: true,
    },
    {
      name: 'Ramonda',
      number: 11,
      shooting: 9,
      shootingIndex: 4,
      speed: 8,
      stamina: 12,
      technique: 11,
      techniqueIndex: 5,
      hairStyle: 8,
      isSpecial: true,
    },
    {
      name: 'Jabari',
      number: 13,
      shooting: 11,
      shootingIndex: 5,
      speed: 11,
      stamina: 14,
      technique: 9,
      techniqueIndex: 4,
      hairStyle: 6,
      isSpecial: true,
    },
    {
      name: 'Bashenga',
      number: 15,
      shooting: 9,
      shootingIndex: 4,
      speed: 9,
      stamina: 13,
      technique: 9,
      techniqueIndex: 4,
      hairStyle: 8,
      isSpecial: true,
    },
    {
      name: 'Bast',
      number: 12,
      shooting: 5,
      shootingIndex: 2,
      speed: 6,
      stamina: 14,
      technique: 11,
      techniqueIndex: 5,
      hairStyle: 8,
      isSpecial: true,
    },
  ],
  uniforms: {
    home: {
      shirt: [
        { r: 48, g: 0, b: 104 },
        { r: 80, g: 16, b: 152 },
        { r: 120, g: 48, b: 200 },
      ],
      shorts: [
        { r: 16, g: 16, b: 16 },
        { r: 40, g: 40, b: 40 },
        { r: 72, g: 72, b: 72 },
      ],
      socks: [
        { r: 48, g: 0, b: 104 },
        { r: 120, g: 48, b: 200 },
      ],
    },
    away: {
      shirt: [
        { r: 168, g: 136, b: 0 },
        { r: 208, g: 176, b: 16 },
        { r: 248, g: 216, b: 48 },
      ],
      shorts: [
        { r: 168, g: 136, b: 0 },
        { r: 200, g: 168, b: 16 },
        { r: 248, g: 216, b: 48 },
      ],
      socks: [
        { r: 168, g: 136, b: 0 },
        { r: 248, g: 216, b: 48 },
      ],
    },
    goalkeeper: {
      shirtAndSocks: [
        { r: 0, g: 128, b: 64 },
        { r: 0, g: 176, b: 96 },
        { r: 48, g: 224, b: 128 },
        { r: 0, g: 128, b: 64 },
        { r: 48, g: 224, b: 128 },
      ],
      shorts: [{ r: 16, g: 48, b: 24 }],
    },
  },
  hairSkin: {
    first: {
      hair: [{ r: 24, g: 16, b: 8 }],
      skin: [
        { r: 48, g: 24, b: 8 },
        { r: 80, g: 48, b: 24 },
        { r: 112, g: 72, b: 40 },
        { r: 144, g: 104, b: 64 },
        { r: 176, g: 136, b: 96 },
      ],
    },
    second: {
      hair: [{ r: 24, g: 16, b: 8 }],
      skin: [
        { r: 48, g: 24, b: 8 },
        { r: 80, g: 48, b: 24 },
        { r: 112, g: 72, b: 40 },
        { r: 144, g: 104, b: 64 },
        { r: 176, g: 136, b: 96 },
      ],
    },
    goalkeeper: {
      hair: [{ r: 24, g: 16, b: 8 }],
      skin: [
        { r: 80, g: 48, b: 24 },
        { r: 128, g: 88, b: 48 },
        { r: 176, g: 136, b: 96 },
      ],
    },
  },
  flagColors: [
    { r: 48, g: 0, b: 104 },
    { r: 120, g: 48, b: 200 },
    { r: 208, g: 176, b: 16 },
    { r: 248, g: 216, b: 48 },
  ],
  flagDesign: null, // Skip flag design in integration test (needs complex setup)
};

/**
 * Create a ROM with valid pointer tables for the team name text writer
 */
function createRomForImport() {
  const rom = new RomParser(new Uint8Array(1048576));

  // Set up team name pointer table at 0x39DAE
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

  // Set up tile name pointer table at 0x93CD for in-game names
  // Set format flag to P17000 (0x82) so displaceTeamNameTilesIfNecessary skips
  const TILE_FORMAT_OFFSETS = [
    0x93c6, 0x93cb, 0x3a7eb, 0x3a7f0, 0x3a7f5, 0x3a7fa, 0x3a7ff, 0x3a804, 0x3a809, 0x3a80e,
  ];
  for (const offset of TILE_FORMAT_OFFSETS) {
    rom.writeByte(offset, 0x82);
  }

  // Set up tile pointers in P17000 region
  const TILE_POINTER_OFFSET = 0x93cd;
  let tileAddr = 0x17680;
  const TEAM_NAME_ORDINALS = [
    0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 5, 25,
    26,
  ];
  for (let i = 0; i < 27; i++) {
    const ord = TEAM_NAME_ORDINALS[i];
    const snesAddr = tileAddr - 0x8000;
    rom.writeByte(TILE_POINTER_OFFSET + ord * 2, snesAddr & 0xff);
    rom.writeByte(TILE_POINTER_OFFSET + ord * 2 + 1, (snesAddr >> 8) & 0xff);
    // Write a small valid compressed block (16 bytes of zeros compressed)
    const tileData = new Uint8Array(64);
    const compressed = konamiCompress(tileData, 1);
    rom.writeByte(tileAddr, compressed.length); // block size
    rom.writeBytes(tileAddr, compressed);
    tileAddr += compressed.length;
  }

  return rom;
}

describe('Team Import/Export Integration', () => {
  describe('validateImport', () => {
    it('should validate a valid single-team export', () => {
      const result = validateImport(WAKANDA);
      expect(result.valid).toBe(true);
      expect(result.type).toBe('single');
    });

    it('should reject null data', () => {
      const result = validateImport(null);
      expect(result.valid).toBe(false);
    });

    it('should reject non-object data', () => {
      const result = validateImport('not an object');
      expect(result.valid).toBe(false);
    });

    it('should reject team with wrong player count', () => {
      const bad = { ...WAKANDA, players: WAKANDA.players.slice(0, 5) };
      const result = validateImport(bad);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('15 players');
    });

    it('should validate all-teams format', () => {
      const allTeams = { _format: 'iss-forge-all-teams', _version: 1, teams: [WAKANDA] };
      const result = validateImport(allTeams);
      expect(result.valid).toBe(true);
      expect(result.type).toBe('all');
    });

    it('should detect unformatted but valid team data', () => {
      const unformatted = { players: WAKANDA.players };
      const result = validateImport(unformatted);
      expect(result.valid).toBe(true);
      expect(result.type).toBe('single');
    });

    it('should reject unrecognized format', () => {
      const result = validateImport({ foo: 'bar' });
      expect(result.valid).toBe(false);
    });
  });

  describe('applyImportedTeam → readTeam roundtrip', () => {
    it('should preserve all player names after import', () => {
      const rom = createRomForImport();
      applyImportedTeam(rom, 0, WAKANDA);

      const team = rom.readTeam(0);
      WAKANDA.players.forEach((player, i) => {
        expect(team.players[i].name).toBe(player.name);
      });
    });

    it('should preserve all player stats after import', () => {
      const rom = createRomForImport();
      applyImportedTeam(rom, 0, WAKANDA);

      const team = rom.readTeam(0);
      WAKANDA.players.forEach((player, i) => {
        expect(team.players[i].shooting).toBe(player.shooting);
        expect(team.players[i].shootingIndex).toBe(player.shootingIndex);
        expect(team.players[i].speed).toBe(player.speed);
        expect(team.players[i].stamina).toBe(player.stamina);
        expect(team.players[i].technique).toBe(player.technique);
        expect(team.players[i].techniqueIndex).toBe(player.techniqueIndex);
        expect(team.players[i].number).toBe(player.number);
        expect(team.players[i].hairStyle).toBe(player.hairStyle);
        expect(team.players[i].isSpecial).toBe(player.isSpecial);
      });
    });

    it('should preserve uniform colors after import (quantized to 5-bit)', () => {
      const rom = createRomForImport();
      applyImportedTeam(rom, 0, WAKANDA);

      const team = rom.readTeam(0);

      // SNES colors are quantized: value → round(value/8)*8
      // So 48 → 48 (6*8), 104 → 104 (13*8), etc.
      WAKANDA.uniforms.home.shirt.forEach((color, i) => {
        const expected_r = Math.round(color.r / 8) * 8;
        const expected_g = Math.round(color.g / 8) * 8;
        const expected_b = Math.round(color.b / 8) * 8;
        expect(team.uniforms.home.shirt[i].r).toBe(expected_r);
        expect(team.uniforms.home.shirt[i].g).toBe(expected_g);
        expect(team.uniforms.home.shirt[i].b).toBe(expected_b);
      });
    });

    it('should preserve flag colors after import', () => {
      const rom = createRomForImport();
      applyImportedTeam(rom, 0, WAKANDA);

      const team = rom.readTeam(0);
      WAKANDA.flagColors.forEach((color, i) => {
        const expected_r = Math.round(color.r / 8) * 8;
        const expected_g = Math.round(color.g / 8) * 8;
        const expected_b = Math.round(color.b / 8) * 8;
        expect(team.flagColors[i].r).toBe(expected_r);
        expect(team.flagColors[i].g).toBe(expected_g);
        expect(team.flagColors[i].b).toBe(expected_b);
      });
    });

    it('should preserve hair/skin colors after import', () => {
      const rom = createRomForImport();
      applyImportedTeam(rom, 0, WAKANDA);

      const team = rom.readTeam(0);
      const firstHair = WAKANDA.hairSkin.first.hair[0];
      expect(team.hairSkin.first.hair[0].r).toBe(Math.round(firstHair.r / 8) * 8);
      expect(team.hairSkin.first.hair[0].g).toBe(Math.round(firstHair.g / 8) * 8);
      expect(team.hairSkin.first.hair[0].b).toBe(Math.round(firstHair.b / 8) * 8);
    });
  });

  describe('exportTeam structure', () => {
    it('should produce a valid export format from readTeam result', () => {
      const rom = createRomForImport();
      applyImportedTeam(rom, 0, WAKANDA);

      const team = rom.readTeam(0);
      const exported = exportTeam(team);

      expect(exported._format).toBe('iss-forge-team');
      expect(exported._version).toBe(1);
      expect(exported.players).toHaveLength(15);
      expect(exported.uniforms).toBeDefined();
      expect(exported.hairSkin).toBeDefined();
      expect(exported.flagColors).toBeDefined();
    });

    it('should pass validateImport on its own output', () => {
      const rom = createRomForImport();
      applyImportedTeam(rom, 0, WAKANDA);

      const team = rom.readTeam(0);
      const exported = exportTeam(team);
      const validation = validateImport(exported);
      expect(validation.valid).toBe(true);
    });
  });
});
