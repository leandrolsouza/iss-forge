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

  it('imports files without raw bytes / description using the named fields', () => {
    const rom = new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
    const brazil = rom.readTeam(idx('BRAZIL'));
    const json = JSON.parse(JSON.stringify(exportTeam(brazil)));
    json.players.forEach((p) => delete p.raw);
    delete json.description;
    const italyBefore = rom.readTeam(idx('ITALY'));
    applyImportedTeam(rom, idx('ITALY'), json);
    const italy = rom.readTeam(idx('ITALY'));
    // Every attribute has a named field now, so the 6 bytes match (b5 bits 4-5/7 are 0 in the ROM)
    italy.players.forEach((p, i) => expect(p.rawBytes).toEqual(brazil.players[i].rawBytes));
    expect(italy.description).toEqual(italyBefore.description);
  });

  it('imports v1 files: "speed" was the goalkeeper kick, bytes 0/4 stay those of the slot', () => {
    const rom = new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
    const brazil = rom.readTeam(idx('BRAZIL'));
    const json = JSON.parse(JSON.stringify(exportTeam(brazil)));
    json._version = 1;
    json.players.forEach((p) => {
      p.speed = p.gkKickIndex + 1;
      for (const k of [
        'raw',
        'gkKickIndex',
        'acceleration',
        'topSpeed',
        'dribbleSpeed',
        'attack',
        'defense',
      ])
        delete p[k];
    });
    const italyBefore = rom.readTeam(idx('ITALY'));
    applyImportedTeam(rom, idx('ITALY'), json);
    const italy = rom.readTeam(idx('ITALY'));
    italy.players.forEach((p, i) => {
      expect(p.rawBytes[0]).toBe(italyBefore.players[i].rawBytes[0]);
      expect(p.rawBytes[4]).toBe(italyBefore.players[i].rawBytes[4]);
      expect(p.rawBytes[3] >> 4).toBe(italyBefore.players[i].rawBytes[3] >> 4);
      expect(p.gkKickIndex).toBe(brazil.players[i].gkKickIndex);
      expect(p.shootingIndex).toBe(brazil.players[i].shootingIndex);
    });
  });
});

describe.skipIf(!existsSync(REAL_ROM))('player attributes (real ROM)', () => {
  it('reads attribute blocks in ROM ordinal order (as the game does via $01:DED7)', () => {
    const rom = new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
    // Values seen in WRAM ($7E:A010) when playing with Scotland (id 5) and Wales (id 6)
    const scot = rom.readTeam(idx('SCOTLAND')).players[0].rawBytes;
    const wales = rom.readTeam(idx('WALES')).players[0].rawBytes;
    expect(scot).toEqual([0x54, 0x22, 0x82, 0x50, 0x2c, 0x00]);
    expect(wales[0]).toBe(((37 - 0x1c) << 4) | (34 - 0x1c));
  });

  it('decodes the Super Star team as all maxed out', () => {
    const rom = new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
    const star = rom.readTeam(idx('SUPERSTAR'));
    star.players.forEach((p) => {
      expect([p.acceleration, p.topSpeed, p.dribbleSpeed, p.attack, p.defense]).toEqual([
        16, 16, 16, 16, 16,
      ]);
      expect(p.speed).toBe(16);
      expect(p.gkKickIndex).toBe(7);
    });
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
    // the in-game name graphic travels exactly (even hand-drawn ones)
    inGameTiles: team.teamNameInGameTiles,
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

  it('refuses a flag that does not fit, writing nothing, and import reports it', () => {
    const rom = load();
    // noisy designs compress badly: fill the flag area team by team until one is refused
    const noisy = (seed) =>
      Array.from({ length: 16 }, (_, y) =>
        Array.from({ length: 24 }, (_, x) => (x * 7 + y * 13 + ((x * y + seed) % 5)) % 5),
      );
    let refused = -1;
    let before = null;
    for (let i = 0; i < TEAMS.length && refused < 0; i++) {
      before = rom.readFlagDesignBytes();
      if (!rom.writeFlagDesign(i, noisy(i))) refused = i;
    }
    expect(refused).toBeGreaterThanOrEqual(0);
    expect(rom.readFlagDesignBytes()).toEqual(before); // nothing written

    const json = JSON.parse(JSON.stringify(exportTeam(rom.readTeam(idx('BRAZIL')))));
    json.flagDesign.grid = noisy(refused);
    const { warnings } = applyImportedTeam(rom, refused, json);
    expect(warnings).toContain('toastFlagNoSpace');
  });
});

describe.skipIf(!existsSync(REAL_ROM))('in-game name on import (real ROM)', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));

  it('exports the graphic and its text', () => {
    const rom = load();
    const json = exportTeam(rom.readTeam(idx('GERMANY')));
    expect(json.teamNameInGame).toBe('GERMANY');
    expect(json.teamNameInGameTiles).toHaveLength(64);
  });

  it('pre-v3 files: the 3-letter name was derived from the menu name, the full name is drawn', () => {
    const rom = load();
    const json = JSON.parse(JSON.stringify(exportTeam(rom.readTeam(idx('GERMANY')))));
    json._version = 2;
    json.teamNameInGame = 'GER';
    delete json.teamNameInGameTiles;
    applyImportedTeam(rom, idx('ITALY'), json);
    expect(rom.readTeamNameInGame(idx('ITALY')).text).toBe('GERMANY');
  });

  it('v3 files without tiles draw the given text', () => {
    const rom = load();
    const json = JSON.parse(JSON.stringify(exportTeam(rom.readTeam(idx('GERMANY')))));
    json.teamNameInGame = 'GER';
    delete json.teamNameInGameTiles;
    applyImportedTeam(rom, idx('ITALY'), json);
    expect(rom.readTeamNameInGame(idx('ITALY')).text).toBe('GER');
  });
});
