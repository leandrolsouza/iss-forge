import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import { TEAMS, TOURNAMENT_DRAWS } from '../constants';
import {
  readDraws,
  writeDraw,
  drawGroups,
  validateDraws,
  drawCoverage,
  SELECTABLE_TEAMS,
} from '../tournament';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const idx = (id) => TEAMS.findIndex((t) => t.id === id);

describe('tournament draws (mock ROM)', () => {
  it('writes ROM ordinals x2 and reads TEAMS indexes back', () => {
    const rom = new RomParser(new Uint8Array(0x100000));
    const draw = SELECTABLE_TEAMS.slice(0, 24);
    writeDraw(rom, 3, draw);
    expect(readDraws(rom)[3]).toEqual(draw);
    // Scotland is TEAMS index 24 but ROM ordinal 5
    const withScotland = [idx('SCOTLAND'), ...draw.slice(1)];
    writeDraw(rom, 0, withScotland);
    expect(rom.readByte(TOURNAMENT_DRAWS.OFFSET)).toBe(10);
  });

  it('rejects draws of the wrong size', () => {
    const rom = new RomParser(new Uint8Array(0x100000));
    expect(() => writeDraw(rom, 0, [0, 1, 2])).toThrow();
    expect(() => writeDraw(rom, 32, SELECTABLE_TEAMS.slice(0, 24))).toThrow();
  });

  it('flags selectable teams missing from every draw and duplicates', () => {
    const base = SELECTABLE_TEAMS.slice(0, 24);
    const draws = Array.from({ length: 32 }, () => [...base]);
    const issues = validateDraws(draws);
    const missing = issues.filter((i) => i.code === 'missing').map((i) => i.team);
    expect(missing.sort()).toEqual(SELECTABLE_TEAMS.slice(24).sort());
    draws[5][1] = draws[5][0];
    expect(validateDraws(draws).some((i) => i.code === 'duplicate' && i.draw === 5)).toBe(true);
  });

  it('splits a draw into 6 groups of 4', () => {
    const groups = drawGroups([...Array(24).keys()]);
    expect(groups).toHaveLength(6);
    expect(groups[1]).toEqual([4, 5, 6, 7]);
  });
});

describe.skipIf(!existsSync(REAL_ROM))('tournament draws (real ROM)', () => {
  const rom = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));

  it('reads the 32 original draws (draw 32 = Italy, Sweden, Romania, Brazil in group B)', () => {
    const draws = rom().readTournamentDraws();
    expect(draws).toHaveLength(32);
    const name = (i) => TEAMS[i].id;
    expect(drawGroups(draws[31])[1].map(name)).toEqual(['ITALY', 'SWEDEN', 'ROMANIA', 'BRAZIL']);
    // Draw 26 was the World Series league seen in WRAM ($7E:9128)
    expect(draws[25].slice(0, 4).map(name)).toEqual(['GERMANY', 'USA', 'AUSTRIA', 'SKOREA']);
  });

  it('covers every selectable team; only the original duplicate (Cameroon in draw 4)', () => {
    const draws = rom().readTournamentDraws();
    const issues = validateDraws(draws);
    expect(issues.filter((i) => i.type === 'error')).toEqual([]);
    expect(issues.filter((i) => i.code === 'duplicate')).toEqual([
      { type: 'warning', code: 'duplicate', draw: 3, team: idx('CAMEROON') },
    ]);
    expect(drawCoverage(draws)[idx('SUPERSTAR')]).toBe(0);
  });
});
