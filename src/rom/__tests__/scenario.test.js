import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  decodeClock,
  encodeClock,
  clockToSeconds,
  secondsToClock,
  wrapScenarioText,
  encodeScenarioText,
  findInvalidChars,
  validateScenario,
  measureScenarioTexts,
  TEXT_CAPACITY,
  ordinalToTeamIndex,
  teamIndexToOrdinal,
} from '../scenario';
import { SCENARIO_DATA, TEAMS } from '../constants';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const hasRealRom = existsSync(REAL_ROM);
const id = (teamId) => TEAMS.findIndex((t) => t.id === teamId);

describe('scenario helpers', () => {
  it('BCD clock round-trip', () => {
    expect(decodeClock(0x0210)).toEqual({ minutes: 2, seconds: 10 });
    expect(encodeClock(2, 10)).toBe(0x0210);
    expect(encodeClock(1, 59)).toBe(0x0159);
    expect(clockToSeconds(0x0130)).toBe(90);
    expect(secondsToClock(130)).toBe(0x0210);
    expect(secondsToClock(99999)).toBe(0x0959); // clamped to 9:59
  });

  it('team ordinal mapping is a bijection', () => {
    TEAMS.forEach((_, i) => expect(ordinalToTeamIndex(teamIndexToOrdinal(i))).toBe(i));
    expect(ordinalToTeamIndex(5)).toBe(id('SCOTLAND'));
  });

  it('word-wraps to 23 columns and keeps explicit new lines', () => {
    const lines = wrapScenarioText(
      'Brazil must score twice in the last minute to win the cup\nGo!',
    );
    lines.forEach((l) => expect(l.length).toBeLessThanOrEqual(23));
    expect(lines[lines.length - 1]).toBe('Go!');
    expect(lines.slice(0, -1).join(' ')).toBe(
      'Brazil must score twice in the last minute to win the cup',
    );
  });

  it('encodes with FD between lines and FF at the end, no FD after a full line', () => {
    const full = 'A'.repeat(23);
    const { bytes } = encodeScenarioText(`${full}\nB`);
    expect(bytes.length).toBe(23 + 1 + 1);
    expect(bytes[23]).toBe(0x42);
    expect(bytes[24]).toBe(0xff);
    expect(encodeScenarioText('Hi\nYo').bytes).toEqual([0x48, 0x69, 0xfd, 0x59, 0x6f, 0xff]);
  });

  it('flags unsupported characters and too many lines', () => {
    expect(findInvalidChars('Olá, São Paulo!')).toEqual(['á', 'ã']);
    const base = { team1: 0, team2: 1, matchClock: 0x0210, displayClock: 0x0200 };
    expect(validateScenario({ ...base, text: 'ok' })).toEqual([]);
    expect(validateScenario({ ...base, text: 'a\nb\nc\nd\ne\nf\ng\nh\ni' })).toContain(
      'scenarioTooManyLines',
    );
    expect(validateScenario({ ...base, team2: 0, text: '' })).toContain('scenarioSameTeam');
  });
});

describe.skipIf(!hasRealRom)('scenarios on the real ROM', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));

  it('reads the 9 original scenarios', () => {
    const sc = load().readScenarios();
    expect(sc).toHaveLength(SCENARIO_DATA.COUNT);
    const pairs = sc.map((s) => [TEAMS[s.team1].id, TEAMS[s.team2].id]);
    expect(pairs).toEqual([
      ['BRAZIL', 'USA'],
      ['ITALY', 'NIGERIA'],
      ['SKOREA', 'SPAIN'],
      ['SCOTLAND', 'HOLLAND'],
      ['BULGARIA', 'GERMANY'],
      ['HOLLAND', 'BRAZIL'],
      ['ARGENTINA', 'ROMANIA'],
      ['USA', 'COLOMBIA'],
      ['BULGARIA', 'FRANCE'],
    ]);
    // Scores consistent with the texts
    expect([sc[2].goals1, sc[2].goals2]).toEqual([0, 2]); // Spain two goals up
    expect([sc[5].goals1, sc[5].goals2]).toEqual([1, 2]); // Holland 0-2 then scored
    expect([sc[7].goals1, sc[7].goals2]).toEqual([2, 1]); // U.S. winning 2-1
    expect(decodeClock(sc[0].displayClock)).toEqual({ minutes: 2, seconds: 0 });
    expect(sc[0].text.split('\n')[0]).toBe('The Brazilians are down');
  });

  it('decodes texts as the game renders them (8 lines x 23 columns)', () => {
    const sc = load().readScenarios();
    for (const s of sc) {
      const lines = s.text.split('\n');
      expect(lines.length).toBeLessThanOrEqual(8);
      lines.forEach((l) => expect(l.length).toBeLessThanOrEqual(23));
    }
    // Scenario 7's text starts in the middle of scenario 6's bytes in the original
    expect(sc[6].text.split('\n').pop()).toBe('great Rumanian side?');
    expect(sc[7].text.split('\n')[0]).toBe('The U.S. are winning');
    expect(measureScenarioTexts(sc.map((s) => s.text))).toBeLessThanOrEqual(TEXT_CAPACITY);
  });

  it('editing numbers does not touch the text area', () => {
    const rom = load();
    const before = new Uint8Array(rom.getRomData());
    const sc = rom.readScenarios()[3];
    expect(
      rom.writeScenario(3, { ...sc, team1: id('BRAZIL'), goals1: 3, displayClock: 0x0045 }).ok,
    ).toBe(true);

    const after = rom.readScenarios()[3];
    expect(TEAMS[after.team1].id).toBe('BRAZIL');
    expect(after.goals1).toBe(3);
    expect(after.displayClock).toBe(0x0045);

    const data = rom.getRomData();
    for (let i = SCENARIO_DATA.TEXT_AREA_START; i < SCENARIO_DATA.TEXT_AREA_END; i++) {
      if (data[i] !== before[i]) throw new Error(`text area changed at 0x${i.toString(16)}`);
    }
  });

  it('editing a text re-packs all texts without changing what the others display', () => {
    const rom = load();
    const original = rom.readScenarios();
    const res = rom.writeScenario(0, {
      ...original[0],
      text: 'Brazil need a goal\nin the last minute!',
    });
    expect(res.ok).toBe(true);
    const after = rom.readScenarios();
    expect(after[0].text).toBe('Brazil need a goal\nin the last minute!');
    for (let i = 1; i < 9; i++) expect(after[i].text).toBe(original[i].text);
  });

  it('rejects texts that do not fit', () => {
    const rom = load();
    const sc = rom.readScenarios();
    const long = Array.from({ length: 8 }, () => 'X'.repeat(23)).join('\n');
    let res;
    for (let i = 0; i < 9; i++) res = rom.writeScenario(i, { ...sc[i], text: long });
    // 9 x 185 bytes > capacity: at some point it must fail without corrupting
    expect(res.ok).toBe(false);
    expect(res.error).toBe('scenarioTextFull');
    rom.readScenarios().forEach((s) => expect(s.text.split('\n').length).toBeLessThanOrEqual(8));
  });

  it('restoreScenarios undoes changes', () => {
    const rom = load();
    const original = rom.readScenarios();
    rom.writeScenario(4, { ...original[4], goals1: 5, text: 'Changed' });
    rom.restoreScenarios(original);
    expect(rom.readScenarios()).toEqual(original);
  });
});
