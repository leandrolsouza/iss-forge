import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  readTeamDescriptions,
  writeTeamDescription,
  writeTeamDescriptions,
  encodeTeamDescription,
  wrapDescriptionBody,
  measureTeamDescriptions,
  withFormationInTitle,
  readTeamDescriptionRaw,
  TEAM_DESC,
  TEAM_DESC_CAPACITY,
} from '../teamDescription';
import { TEAMS } from '../constants';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const idx = (id) => TEAMS.findIndex((t) => t.id === id);

describe('team description helpers', () => {
  it('encodes title colour, blank line and wrapped body', () => {
    const bytes = encodeTeamDescription({ title: 'Attack 4-3-3', titleColor: 0x2c, body: 'Fast.' });
    expect(bytes.slice(0, 2)).toEqual([0xfe, 0x2c]);
    expect(bytes.slice(-1)).toEqual([0xff]);
    // title, FE 20, FD (end title), FD (blank line)
    const t = 'Attack 4-3-3'.length;
    expect(bytes.slice(2 + t, 2 + t + 4)).toEqual([0xfe, 0x20, 0xfd, 0xfd]);
  });

  it('wraps the body to 15 columns', () => {
    const lines = wrapDescriptionBody('This team plays with very fast wingers and a tall striker.');
    lines.forEach((l) => expect(l.length).toBeLessThanOrEqual(15));
    expect(lines.join(' ')).toBe('This team plays with very fast wingers and a tall striker.');
  });

  it('updates the formation inside a title', () => {
    expect(withFormationInTitle('Offensive 4-4-2', '3-5-2')).toBe('Offensive 3-5-2');
    expect(withFormationInTitle('Attack', '4-3-3')).toBe('Attack 4-3-3');
  });
});

describe.skipIf(!existsSync(REAL_ROM))('team descriptions on the real ROM', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));

  it('reads the 27 originals as shown in-game', () => {
    const all = readTeamDescriptions(load());
    expect(all).toHaveLength(27);
    const ita = all[idx('ITALY')];
    expect(ita.title).toBe('Offensive 4-4-2');
    expect(ita.titleColor).toBe(0x2c);
    // Exactly the lines displayed on the selection screen
    expect(ita.body.split('\n')).toEqual([
      'Defence is the',
      'strongest in',
      'the world.They',
      'also have a',
      'cohesive mid-',
      'field.',
    ]);
    expect(all[idx('GERMANY')].title).toBe('Defensive 5-3-2');
    expect(all[idx('GERMANY')].titleColor).toBe(0x24);
    all.forEach((d) => {
      expect(d.title.length).toBeLessThanOrEqual(15);
      expect(d.body.split('\n').length).toBeLessThanOrEqual(TEAM_DESC.BODY_LINES);
    });
    expect(measureTeamDescriptions(all)).toBeLessThanOrEqual(TEAM_DESC_CAPACITY);
  });

  it('re-packing keeps every original rendering identical', () => {
    const rom = load();
    const before = readTeamDescriptions(rom);
    expect(writeTeamDescriptions(rom, before).ok).toBe(true);
    expect(readTeamDescriptions(rom)).toEqual(before);
  });

  it('edits one team and only touches the text area and pointer table', () => {
    const rom = load();
    const original = new Uint8Array(rom.getRomData());
    const before = readTeamDescriptions(rom);
    const res = writeTeamDescription(rom, idx('BRAZIL'), {
      title: 'Offensive 3-4-3',
      titleColor: 0x2c,
      body: 'Samba football with four strikers and lots of skill.',
    });
    expect(res.ok).toBe(true);
    const after = readTeamDescriptions(rom);
    expect(after[idx('BRAZIL')].title).toBe('Offensive 3-4-3');
    expect(after[idx('BRAZIL')].body.split('\n')[0]).toBe('Samba football');
    after.forEach((d, i) => i !== idx('BRAZIL') && expect(d).toEqual(before[i]));
    const data = rom.getRomData();
    for (let i = 0; i < data.length; i++) {
      if (data[i] === original[i]) continue;
      const inArea = i >= TEAM_DESC.AREA_START && i < TEAM_DESC.AREA_END;
      const inPtrs = i >= TEAM_DESC.POINTERS && i < TEAM_DESC.POINTERS + 54;
      if (!inArea && !inPtrs) throw new Error(`unexpected change at 0x${i.toString(16)}`);
    }
  });

  it('rejects descriptions that do not fit', () => {
    const rom = load();
    const huge = { title: 'X', titleColor: 0x2c, body: 'word '.repeat(80) };
    const all = readTeamDescriptions(rom).map(() => huge);
    expect(writeTeamDescriptions(rom, all).ok).toBe(false);
  });

  it('keeps the colours inside other bodies when one description is edited', () => {
    const rom = load();
    // 4 originals colour player names in the body (e.g. FE 30 ... FE 20)
    const coloured = TEAMS.map((_, i) => i).filter((i) => {
      const raw = readTeamDescriptionRaw(rom, i);
      return raw.filter((b) => b === TEAM_DESC.ATTR).length > 2;
    });
    expect(coloured.length).toBeGreaterThanOrEqual(4);
    const before = coloured.map((i) => readTeamDescriptionRaw(rom, i));
    const target = TEAMS.map((_, i) => i).find((i) => !coloured.includes(i));
    expect(
      writeTeamDescription(rom, target, {
        title: 'Offensive 4-3-3',
        titleColor: 0x2c,
        body: 'New.',
      }).ok,
    ).toBe(true);
    coloured.forEach((i, k) => expect(readTeamDescriptionRaw(rom, i)).toEqual(before[k]));
    expect(measureTeamDescriptions(readTeamDescriptions(rom), rom)).toBeLessThanOrEqual(
      TEAM_DESC_CAPACITY,
    );
  });
});
