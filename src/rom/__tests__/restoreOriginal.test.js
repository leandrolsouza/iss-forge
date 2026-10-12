import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import { TEAMS } from '../constants';
import { restoreTeamPart, isTeamPartOriginal } from '../restoreOriginal';
import { sharedKeeperTeams } from '../readers/UniformReader';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const idx = (id) => TEAMS.findIndex((t) => t.id === id);

describe('shared goalkeeper', () => {
  it('Super Star and Belgium share the goalkeeper kit', () => {
    expect(sharedKeeperTeams(idx('SUPERSTAR'))).toEqual([idx('BELGIUM')]);
    expect(sharedKeeperTeams(idx('BELGIUM'))).toEqual([idx('SUPERSTAR')]);
    expect(sharedKeeperTeams(idx('GERMANY'))).toEqual([]);
  });
});

describe.skipIf(!existsSync(REAL_ROM))('restore original / shared flags (real ROM)', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
  const red = { r: 248, g: 0, b: 0 };

  it('restores every part of a team to the loaded ROM', () => {
    const rom = load();
    const ger = idx('GERMANY');
    const before = rom.readTeam(ger);
    const original = new Uint8Array(rom.getRomData());

    rom.writeUniformColor(ger, 'home', 'shirt', 0, red);
    rom.writeUniformColor(ger, 'goalkeeper', 'shorts', 0, red);
    rom.writeHairSkinColor(ger, 'first', 'hair', 0, red);
    rom.writeFlagColor(ger, 1, red);
    rom.writeFlagDesign(
      ger,
      before.flagDesign.grid.map((r) => r.map(() => 2)),
    );
    rom.writeTeamNameMenu(ger, 'DEUTSCH');
    rom.writeTeamNameInGame(ger, 'DEU');
    rom.writePlayerName(ger, 3, 'TESTER');
    rom.writePredominantColor(ger, 4);
    rom.writeTeamDescription(ger, { title: 'X', titleColor: 0x2c, body: 'Y' });

    const changed = rom.readTeam(ger);
    for (const part of [
      'uniform:home',
      'uniform:goalkeeper',
      'hairSkin',
      'flagColors',
      'flagDesign',
      'teamName',
      'player:3',
      'predominantColor',
      'description',
    ]) {
      expect(isTeamPartOriginal(changed, before, part), part).toBe(false);
      expect(restoreTeamPart(rom, ger, part).ok, part).toBe(true);
      expect(isTeamPartOriginal(rom.readTeam(ger), before, part), part).toBe(true);
    }
    const after = rom.readTeam(ger);
    expect(after.uniforms).toEqual(before.uniforms);
    expect(after.players[3]).toEqual(before.players[3]);
    expect(after.teamNameInGameTiles).toEqual(before.teamNameInGameTiles);
    // colours come back byte for byte
    const kit = [0x2ea3b, 0x2ea3b + 16];
    expect(Array.from(rom.getRomData().slice(...kit))).toEqual(Array.from(original.slice(...kit)));
  });

  it('editing a shared flag gives the team its own copy', () => {
    const rom = load();
    const ger = idx('GERMANY');
    const partners = rom.flagSharedWith(ger);
    expect(partners.sort()).toEqual([idx('HOLLAND'), idx('AUSTRIA'), idx('RUSSIA')].sort());
    const before = partners.map((i) => rom.readFlagDesign(i).grid);

    const cross = rom.readFlagDesign(ger).grid.map((r, y) => r.map((v, x) => (x === y ? 4 : v)));
    expect(rom.writeFlagDesign(ger, cross)).toBe(true);
    expect(rom.readFlagDesign(ger).grid).toEqual(cross);
    partners.forEach((i, k) => expect(rom.readFlagDesign(i).grid).toEqual(before[k]));
    expect(rom.flagSharedWith(ger)).toEqual([]);
    // the others still share among themselves
    expect(rom.flagSharedWith(idx('HOLLAND')).length).toBe(2);
  });
});
