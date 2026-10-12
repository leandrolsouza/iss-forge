import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../../rom/RomParser';
import { TEAMS } from '../../rom/constants';
import { copyTeam, exportTeam, applyImportedTeam } from '../../utils/teamExport';
import { restoreSnapshot, snapshotGlobals, keepUnchangedTeams } from '../snapshotRestore';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const idx = (id) => TEAMS.findIndex((t) => t.id === id);

describe('keepUnchangedTeams', () => {
  it('keeps the objects of unchanged teams and fields', () => {
    const prev = [
      { a: 1, desc: { t: 'x' } },
      { a: 2, desc: { t: 'y' } },
    ];
    const next = structuredClone(prev);
    next[1].a = 3;
    const out = keepUnchangedTeams(next, prev);
    expect(out[0]).toBe(prev[0]);
    expect(out[1]).not.toBe(prev[1]);
    expect(out[1].a).toBe(3);
    expect(out[1].desc).toBe(prev[1].desc);
  });
});

describe.skipIf(!existsSync(REAL_ROM))('restoreSnapshot (undo/redo, real ROM)', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
  // What useRomState.pushSnapshot stores
  const snapshot = (rom, teams) => ({
    teams: structuredClone(teams),
    ...snapshotGlobals(rom, {
      scenarios: rom.readScenarios(),
      matchPalettes: rom.readMatchPalettes(),
    }),
  });
  const diff = (a, b) => {
    const out = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.push(i);
    return out;
  };

  it('undoes a team swap byte for byte (names, flags, tiles, crowd)', () => {
    const rom = load();
    const original = new Uint8Array(rom.getRomData());
    const teams = rom.readAllTeams();
    const snap = snapshot(rom, teams);

    copyTeam(rom, idx('ITALY'), idx('BRAZIL'), { swap: true });
    const { changed } = restoreSnapshot(rom, snap, rom.readAllTeams());

    expect(diff(rom.getRomData(), original)).toEqual([]);
    expect(changed.has('matchPalettes')).toBe(true); // the crowd palette went back
  });

  it('undoes an AI/JSON team import as one step, Super Star goalkeeper included', () => {
    const rom = load();
    const original = new Uint8Array(rom.getRomData());
    const teams = rom.readAllTeams();
    const snap = snapshot(rom, teams);

    // Super Star shares the goalkeeper kit with Belgium (UniformReader)
    const json = JSON.parse(JSON.stringify(exportTeam(teams[idx('BRAZIL')])));
    applyImportedTeam(rom, idx('SUPERSTAR'), json);
    restoreSnapshot(rom, snap, rom.readAllTeams());

    expect(diff(rom.getRomData(), original)).toEqual([]);
  });

  it('re-reads only what changed: an unrelated undo leaves scenarios and teams alone', () => {
    const rom = load();
    const teams = rom.readAllTeams();
    const snap = snapshot(rom, teams);

    // a player name edit (what handlePlayerChange does)
    const ger = idx('GERMANY');
    rom.writePlayerName(ger, 0, 'TESTER');
    const current = teams.map((t, i) =>
      i === ger
        ? { ...t, players: t.players.map((p, k) => (k === 0 ? { ...p, name: 'TESTER' } : p)) }
        : t,
    );

    const { teams: next, changed } = restoreSnapshot(rom, snap, current);
    expect([...changed]).toEqual([]);
    expect(next[1]).toBe(current[1]); // untouched team: same object
    expect(next[ger]).not.toBe(current[ger]);
    expect(next[ger].description).toBe(current[ger].description); // description draft survives
    expect(rom.readPlayerNames(ger)[0]).toBe(teams[ger].players[0].name);
  });

  it('reports the scenarios when a scenario edit is undone', () => {
    const rom = load();
    const teams = rom.readAllTeams();
    const snap = snapshot(rom, teams);
    const before = rom.readScenarios();

    expect(rom.writeScenario(0, { ...before[0], text: 'TEST' }).ok).toBe(true);
    const { teams: next, changed } = restoreSnapshot(rom, snap, teams);

    expect([...changed]).toEqual(['scenarios']);
    expect(rom.readScenarios()).toEqual(before);
    next.forEach((t, i) => expect(t).toBe(teams[i]));
  });
});
