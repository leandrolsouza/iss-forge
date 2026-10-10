import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);

describe.skipIf(!existsSync(REAL_ROM))('team name undo snapshot', () => {
  it('restores the ROM byte-for-byte after menu + in-game name edits', () => {
    const rom = new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
    const original = new Uint8Array(rom.getRomData());
    const snap = rom.readTeamNameBytes();

    // Longer name → positional text and tile blocks shift, pointers change, patches applied
    expect(rom.writeTeamNameMenu(1, 'ITALIA')).toBe(true);
    expect(rom.writeTeamNameInGame(1, 'ITA')).toBe(true);
    expect(rom.writeTeamNameText(18, 'BRASIL')).toBe(true);
    expect(rom.readTeamNameText(1)).not.toBe(new RomParser(original).readTeamNameText(1));

    expect(rom.restoreTeamNameBytes(snap)).toBe(true);
    const data = rom.getRomData();
    const diffs = [];
    for (let i = 0; i < data.length; i++) if (data[i] !== original[i]) diffs.push(i);
    expect(diffs).toEqual([]);
    expect(rom.restoreTeamNameBytes(snap)).toBe(false); // nothing left to restore
  });
});
