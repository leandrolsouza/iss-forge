import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../../rom/RomParser';
import { exportTeam, applyImportedTeam, validateImport, copyTeam } from '../teamExport';
import { TEAMS } from '../../rom/constants';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const idx = (id) => TEAMS.findIndex((t) => t.id === id);

describe.skipIf(!existsSync(REAL_ROM))('team export/import round-trip (real ROM)', () => {
  it('carries hidden attributes, formation and description to another slot', () => {
    const rom = new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
    const brazil = rom.readTeam(idx('BRAZIL'));
    const json = JSON.parse(JSON.stringify(exportTeam(brazil)));
    expect(validateImport(json).valid).toBe(true);
    expect(json.players[0].raw).toHaveLength(6);

    applyImportedTeam(rom, idx('ITALY'), json);
    const italy = rom.readTeam(idx('ITALY'));

    italy.players.forEach((p, i) => {
      expect(p.rawBytes).toEqual(brazil.players[i].rawBytes); // incl. bytes 0/4 (hidden attrs)
      expect(p.name).toBe(brazil.players[i].name);
    });
    expect(italy.formation.slots).toEqual(brazil.formation.slots);
    expect(italy.description).toEqual(brazil.description);
  });

  it('still imports older files without raw bytes / description', () => {
    const rom = new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
    const json = JSON.parse(JSON.stringify(exportTeam(rom.readTeam(idx('BRAZIL')))));
    json.players.forEach((p) => delete p.raw);
    delete json.description;
    const italyBefore = rom.readTeam(idx('ITALY'));
    applyImportedTeam(rom, idx('ITALY'), json);
    const italy = rom.readTeam(idx('ITALY'));
    // Hidden bytes stay those of the destination slot (old behaviour), description untouched
    expect(italy.players[3].rawBytes[0]).toBe(italyBefore.players[3].rawBytes[0]);
    expect(italy.description).toEqual(italyBefore.description);
  });
});

describe.skipIf(!existsSync(REAL_ROM))('copyTeam (real ROM)', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
  const essence = (team) => ({
    players: team.players.map((p) => ({ name: p.name, raw: p.rawBytes })),
    uniforms: team.uniforms,
    hairSkin: team.hairSkin,
    flagColors: team.flagColors,
    flagGrid: team.flagDesign.grid,
    specialHair: team.specialHair,
    specialSkin: team.specialSkin,
    formation: team.formation.slots,
    description: team.description,
    name: team.teamNameText,
  });

  it('swaps two teams completely, crowd palette included', () => {
    const rom = load();
    const ita = idx('ITALY');
    const bra = idx('BRAZIL');
    const before = { ita: essence(rom.readTeam(ita)), bra: essence(rom.readTeam(bra)) };
    const crowdBefore = rom.readMatchPalettes().crowdMap;

    copyTeam(rom, ita, bra, { swap: true });

    expect(essence(rom.readTeam(ita))).toEqual(before.bra);
    expect(essence(rom.readTeam(bra))).toEqual(before.ita);
    const crowd = rom.readMatchPalettes().crowdMap;
    expect(crowd[ita]).toBe(crowdBefore[bra]);
    expect(crowd[bra]).toBe(crowdBefore[ita]);
  });

  it('copies a team onto another slot, leaving the source untouched', () => {
    const rom = load();
    const ger = idx('GERMANY');
    const usa = idx('USA');
    const src = essence(rom.readTeam(ger));
    copyTeam(rom, ger, usa);
    // The name may be truncated when the destination slot has less room in the name area
    const { name, ...rest } = essence(rom.readTeam(usa));
    const { name: srcName, ...srcRest } = src;
    expect(rest).toEqual(srcRest);
    expect(srcName.startsWith(name)).toBe(true);
    expect(essence(rom.readTeam(ger))).toEqual(src);
  });
});
