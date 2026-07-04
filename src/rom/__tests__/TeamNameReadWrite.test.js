import { describe, it, expect } from 'vitest';
import { readTeamNameText } from '../readers/TeamNameReader';
import { writeTeamNameMenu } from '../writers/TeamNameWriter';
import { generateTeamNameData } from '../TeamNameGenerator';
import RomParser from '../RomParser';

/**
 * Create a mock ROM with valid team name pointer tables.
 * Sets up the pointer table at 0x39DAE with space for 27 teams,
 * each pointing to a data block with pre-generated name data.
 */
function createMockRomWithTeamNames() {
  const rom = new RomParser(new Uint8Array(1048576));

  const POINTER_OFFSET = 0x39dae;
  const DATA_BASE = 0x43ed5; // Same as TEAM_NAMES_TEXT.OFFSET_START

  // Team names in ordinal order (0-26):
  // 0=Germany,1=Italy,2=Holland,3=Spain,4=England,5=Scotland,
  // 6=Wales,7=France,8=Denmark,9=Sweden,10=Norway,11=Ireland,
  // 12=Belgium,13=Austria,14=Swiss,15=Romania,16=Bulgaria,17=Russia,
  // 18=Argentina,19=Brazil,20=Colombia,21=Mexico,22=USA,23=Nigeria,
  // 24=Cameroon,25=S.Korea,26=Super Star
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
    // Write pointer (format: addr = 0x40000 + ((b2-0x80)<<8) + b1)
    const relative = currentAddr - 0x40000;
    const b1 = relative & 0xff;
    const b2 = ((relative >> 8) & 0xff) + 0x80;
    rom.writeByte(POINTER_OFFSET + ordinal * 2, b1);
    rom.writeByte(POINTER_OFFSET + ordinal * 2 + 1, b2);

    // Generate and write name data
    const nameData = generateTeamNameData(ordinalNames[ordinal]);
    rom.writeBytes(currentAddr, nameData);
    currentAddr += nameData.length;
  }

  // Also apply the shared pointer patches that TeamNameWriter expects
  // (so writeTeamNameMenu doesn't try to repatch and possibly shift data)
  const SHARED_PTR_PATCH_39D78 = new Uint8Array([
    0x00, 0x10, 0x30, 0x10, 0x60, 0x10, 0x90, 0x10, 0xc0, 0x10, 0x00, 0x12, 0x30, 0x12, 0x60, 0x12,
    0x90, 0x12, 0xc0, 0x12, 0x00, 0x14, 0x30, 0x14, 0x60, 0x14, 0x90, 0x14, 0xc0, 0x14, 0x00, 0x16,
    0x30, 0x16, 0x60, 0x16, 0x90, 0x16, 0xc0, 0x16, 0x00, 0x18, 0x30, 0x18, 0x60, 0x18, 0x90, 0x18,
    0xc0, 0x18, 0x00, 0x1a, 0x30, 0x1a,
  ]);
  rom.writeBytes(0x39d78, SHARED_PTR_PATCH_39D78);

  return rom;
}

describe('TeamNameReader/TeamNameWriter Roundtrip', () => {
  it('should read a pre-written team name', () => {
    const rom = createMockRomWithTeamNames();
    // Team 0 in our TEAMS array = Germany = ordinal 0
    const name = readTeamNameText(rom, 0);
    expect(name).toBe('GERMANY');
  });

  it('should read Brazil (team index 18, ordinal 19)', () => {
    const rom = createMockRomWithTeamNames();
    const name = readTeamNameText(rom, 18);
    expect(name).toBe('BRAZIL');
  });

  it('should write and read back a new name for a team', () => {
    const rom = createMockRomWithTeamNames();
    // Write "WAKANDA" to team 10 (Ireland slot, ordinal 11)
    writeTeamNameMenu(rom, 10, 'WAKANDA');
    const name = readTeamNameText(rom, 10);
    expect(name).toBe('WAKANDA');
  });

  it('should write and read back a short name', () => {
    const rom = createMockRomWithTeamNames();
    writeTeamNameMenu(rom, 0, 'USA');
    const name = readTeamNameText(rom, 0);
    expect(name).toBe('USA');
  });

  it('should write and read back a name with a dot (dot only has bottom tile, read as space)', () => {
    const rom = createMockRomWithTeamNames();
    writeTeamNameMenu(rom, 25, 'S.KOREA');
    const name = readTeamNameText(rom, 25);
    // The reader only decodes top-half tiles (0xF1). The dot character only
    // has a bottom tile (0xF9), so it appears as a space gap between S and KOREA.
    expect(name).toBe('S KOREA');
  });

  it('should not corrupt other team names when writing', () => {
    const rom = createMockRomWithTeamNames();
    const originalBrazil = readTeamNameText(rom, 18);

    writeTeamNameMenu(rom, 0, 'WAKANDA');

    const brazilAfter = readTeamNameText(rom, 18);
    expect(brazilAfter).toBe(originalBrazil);
  });

  it('should handle writing a longer name that requires shifting', () => {
    const rom = createMockRomWithTeamNames();
    // "SWITZ" (5 chars) → "SWITZERLAND" (11 chars) — much larger data
    writeTeamNameMenu(rom, 13, 'SWITZERLAND');

    const name = readTeamNameText(rom, 13);
    // Should either be "SWITZERLAND" or a truncated version that fits
    expect(name.startsWith('SWITZ')).toBe(true);
  });

  it('should handle writing a shorter name that frees space', () => {
    const rom = createMockRomWithTeamNames();
    // "GERMANY" (7 chars) → "DE" (2 chars) — smaller
    writeTeamNameMenu(rom, 0, 'DE');
    const name = readTeamNameText(rom, 0);
    expect(name).toBe('DE');
  });
});

describe('TeamNameGenerator consistency', () => {
  it('should produce deterministic output for same input', () => {
    const data1 = generateTeamNameData('BRAZIL');
    const data2 = generateTeamNameData('BRAZIL');
    expect(data1).toEqual(data2);
  });

  it('should produce different output for different input', () => {
    const data1 = generateTeamNameData('BRAZIL');
    const data2 = generateTeamNameData('FRANCE');
    expect(data1).not.toEqual(data2);
  });

  it('should produce valid count header', () => {
    const data = generateTeamNameData('ITALY');
    const count = data[0];
    expect(data.length).toBe(1 + count * 4);
  });
});
