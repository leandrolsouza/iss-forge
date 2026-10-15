import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  GOAL_SCENE,
  STAND_SCENE,
  buildSceneVram,
  matchSceneCgram,
  matchSceneColors,
  parseSceneRows,
  renderMatchScene,
} from '../stadiumPreview';
import { MATCH_BACKDROP } from '../matchScenes';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);

const rawsOf = (img) => {
  const s = new Map();
  for (let i = 0; i < img.data.length; i += 4) {
    const raw = (img.data[i] >> 3) | ((img.data[i + 1] >> 3) << 5) | ((img.data[i + 2] >> 3) << 10);
    s.set(raw, (s.get(raw) || 0) + 1);
  }
  return s;
};

describe('match scenes', () => {
  it('parses rows of map words with repeats, padding missing cells and rows', () => {
    const cells = parseSceneRows(['0001 1000*3', '2c05'], 4, 3);
    expect(Array.from(cells)).toEqual([1, 0x1000, 0x1000, 0x1000, 0x2c05, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('every scene row has exactly `width` cells', () => {
    for (const scene of [STAND_SCENE, GOAL_SCENE]) {
      for (const rows of [scene.back, scene.front]) {
        expect(rows.length).toBeLessThanOrEqual(scene.height);
        rows.forEach((row) => {
          const n = row
            .split(' ')
            .reduce((sum, token) => sum + Number(token.split('*')[1] || 1), 0);
          expect(n).toBe(scene.width);
        });
      }
      scene.rawTiles.forEach(([tile, , count]) => expect(tile + count).toBeLessThanOrEqual(0x300));
    }
  });

  it('puts each palette in its BG row (colour 0 of every row stays transparent)', () => {
    const cg = matchSceneCgram({
      people: [1],
      grass: Array.from({ length: 30 }, (_, i) => 100 + i),
      wall: [4],
      crowd: Array.from({ length: 31 }, (_, i) => 200 + i),
      detail: [7],
    });
    expect(cg[17]).toBe(1);
    expect(cg[33]).toBe(100);
    expect(cg[47]).toBe(114);
    expect(cg[49]).toBe(115);
    expect(cg[65]).toBe(4);
    expect(cg[81]).toBe(200);
    expect(cg[97]).toBe(215);
    expect(cg[111]).toBe(229);
    expect(cg[113]).toBe(7); // the 31st crowd colour is not drawn (the game overwrites it)
    for (let row = 0; row < 8; row++) expect(cg[row * 16]).toBe(0);
  });
});

describe.skipIf(!existsSync(REAL_ROM))('stadium and crowd previews (real ROM)', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));

  it('loads the raw chars the scenes need (crowd animation, goal net)', () => {
    const rom = load();
    for (const scene of [STAND_SCENE, GOAL_SCENE]) {
      const vram = buildSceneVram(rom, scene);
      scene.rawTiles.forEach(([tile, file, count]) => {
        const at = 0x4000 + tile * 32;
        expect(Array.from(vram.slice(at, at + count * 32))).toEqual(
          Array.from(rom.readBytes(file, count * 32)),
        );
      });
    }
  });

  it('draws the stand with the wall, both fan groups and the grass', () => {
    const rom = load();
    const mp = rom.readMatchPalettes();
    const colors = matchSceneColors(mp, 0);
    const img = renderMatchScene(rom, STAND_SCENE, colors);
    expect([img.width, img.height]).toEqual([STAND_SCENE.width * 8, STAND_SCENE.height * 8]);
    const used = rawsOf(img);
    const allowed = new Set([
      MATCH_BACKDROP,
      ...colors.wall,
      ...colors.crowd.slice(0, 30),
      ...colors.grass,
      ...colors.people,
      ...colors.detail,
    ]);
    expect([...used.keys()].every((c) => allowed.has(c))).toBe(true);
    const count = (list) => list.filter((c) => used.has(c)).length;
    expect(count(colors.wall)).toBeGreaterThan(4);
    expect(count(colors.crowd.slice(0, 15))).toBeGreaterThan(4);
    expect(count(colors.crowd.slice(15, 30))).toBeGreaterThan(4);
  });

  it('draws the goal net with the wall palette and the photographers', () => {
    const rom = load();
    const mp = rom.readMatchPalettes();
    const wall = [...mp.stadium_wall];
    const people = [...mp.stadium_people];
    wall.fill(31); // pure red
    people.fill(31 << 10); // pure blue
    const img = renderMatchScene(rom, GOAL_SCENE, { ...matchSceneColors(mp, 0), wall, people });
    const used = rawsOf(img);
    expect(used.get(31)).toBeGreaterThan(500); // the net
    expect(used.get(31 << 10)).toBeGreaterThan(200); // the photographers
  });

  it('follows the edited crowd palette of the chosen team and highlights a row', () => {
    const rom = load();
    const mp = rom.readMatchPalettes();
    const colors = matchSceneColors(mp, 3);
    expect(colors.crowd).toBe(mp.crowds[mp.crowdMap[3]]);
    const crowd = [...colors.crowd];
    crowd.fill(31 << 5, 0, 15); // group 1 = pure green
    const img = renderMatchScene(rom, STAND_SCENE, { ...colors, crowd });
    expect(rawsOf(img).get(31 << 5)).toBeGreaterThan(500);
    // highlighting row 6 dims group 1 (row 5)
    const hl = renderMatchScene(rom, STAND_SCENE, { ...colors, crowd }, { highlight: [6] });
    expect(rawsOf(hl).has(31 << 5)).toBe(false);
  });
});
