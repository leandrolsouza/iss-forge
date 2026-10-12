import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import { TEAMS } from '../constants';
import {
  renderTextToPixels,
  encode2bppTiles,
  decode2bppTiles,
  recognizeTextPixels,
  textPixelWidth,
  IN_GAME_NAME_WIDTH,
} from '../TeamNameTileFont';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);

describe('in-game name font', () => {
  it('decode2bppTiles inverts encode2bppTiles', () => {
    const pixels = renderTextToPixels('GERMANY');
    expect(decode2bppTiles(encode2bppTiles(pixels))).toEqual(pixels);
  });

  it('recognizes text drawn with the font, spaces and digits included', () => {
    for (const text of ['GERMANY', 'ITALY', 'U.S.A.', 'FC 1990', 'A B', 'WALES', 'BRASIL']) {
      expect(recognizeTextPixels(renderTextToPixels(text))).toBe(text);
    }
  });

  it('returns null for pixels the font does not draw', () => {
    const pixels = renderTextToPixels('ITALY');
    pixels[3][0] = 1; // a stray pixel
    expect(recognizeTextPixels(pixels)).toBeNull();
    expect(recognizeTextPixels(renderTextToPixels(''))).toBeNull();
  });

  it('measures the rendered width (7 letters fit in the 32 pixels)', () => {
    expect(textPixelWidth('GERMANY')).toBe(29);
    expect(textPixelWidth('GERMANYX')).toBeGreaterThan(IN_GAME_NAME_WIDTH);
    expect(textPixelWidth('')).toBe(0);
  });
});

describe.skipIf(!existsSync(REAL_ROM))('in-game name in the real ROM', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));

  it('reads the original graphics: full names, not 3 letters', () => {
    const rom = load();
    const names = TEAMS.map((_, i) => rom.readTeamNameInGame(i));
    names.forEach((n) => expect(n.tiles).toHaveLength(64));
    expect(names[0].text).toBe('GERMANY');
    expect(names[1].text).toBe('ITALY'); // LY kerned one column tighter
    expect(names[25].text).toBe('S.KOREA');
    // about half are drawn with the font; the others squeeze letters (HOLLAND,
    // ARGENTINA, SUPER STAR...) and have no text
    expect(names.filter((n) => n.text).length).toBeGreaterThanOrEqual(12);
    expect(names[17].text).toBeNull(); // ARGENTINA
    expect(rom.readTeam(0).teamNameInGame).toBe('GERMANY');
  });

  it('writes text and raw tiles, without touching the other teams', () => {
    const rom = load();
    const before = TEAMS.map((_, i) => rom.readTeamNameInGame(i).tiles);
    expect(rom.writeTeamNameInGame(1, 'BRASIL')).toBe(true);
    expect(rom.readTeamNameInGame(1).text).toBe('BRASIL');

    // copy a hand-drawn graphic exactly
    const custom = TEAMS.map((_, i) => i).find((i) => !rom.readTeamNameInGame(i).text);
    expect(custom).toBeDefined();
    expect(rom.writeTeamNameInGameTiles(3, before[custom])).toBe(true);
    expect(rom.readTeamNameInGame(3).tiles).toEqual(before[custom]);

    TEAMS.forEach((_, i) => {
      if (i !== 1 && i !== 3) expect(rom.readTeamNameInGame(i).tiles).toEqual(before[i]);
    });
  });
});
