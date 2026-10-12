import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  readTitleObjects,
  shadowSprites,
  ballSprites,
  writeTitleObjects,
  ballShadowTile,
} from '../titleObjects';
import { listPoseFrames, readFrame, playerSprites } from '../titlePlayers';
import { readTitleScreen, renderTitleScreen } from '../titleScreen';
import { TITLE_SHADOW_SPRITES, TITLE_BALL_SPRITES } from '../titleScreenLayout';
import { TITLE_SCREEN, TEAMS } from '../constants';

const TEAMS_INDEX = (id) => TEAMS.findIndex((t) => t.id === id);

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const hasRealRom = existsSync(REAL_ROM);
const word = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);

describe.skipIf(!hasRealRom)('title screen ball and shadows', () => {
  const load = () => new RomParser(readFileSync(REAL_ROM));

  it('reads the original objects', () => {
    expect(readTitleObjects(load())).toEqual({
      ball: { visible: true, x: 0x84, y: 0xba, z: -54 },
      shadowLeft: { visible: true, x: 0x70, y: 0xb6 },
      shadowRight: { visible: true, x: 0x90, y: 0xb6 },
      players: { leftX: 0x72, rightX: 0x90, y: 0xb0 },
    });
  });

  it('builds the same sprites the game puts in the OAM', () => {
    const objects = readTitleObjects(load());
    expect(shadowSprites(objects)).toEqual(TITLE_SHADOW_SPRITES);
    expect(ballSprites(objects)).toEqual(TITLE_BALL_SPRITES);
  });

  it('moves the ball and the shadows (sprites follow the formulas checked in the emulator)', () => {
    const rom = load();
    rom.applyTitleScreenUpdates({
      objects: {
        ball: { x: 0x40, y: 0xa0, z: -16 },
        shadowLeft: { x: 0x50 },
        shadowRight: { y: 0xc8 },
        players: { leftX: 0x50, y: 0xa0 },
      },
    });
    const o = readTitleScreen(rom).objects;
    expect(o.ball).toEqual({ visible: true, x: 0x40, y: 0xa0, z: -16 });
    expect(word(rom, TITLE_SCREEN.OBJECTS.BALL.z)).toBe(0xfff0);
    // values seen in the OAM of the emulator with the same ROM
    expect(shadowSprites(o)).toEqual([
      [72, 182, 0x187, 0, 0, 0, 0],
      [80, 182, 0x188, 0, 0, 0, 0],
      [144, 200, 0x187, 0, 1, 1, 0],
      [136, 200, 0x188, 0, 1, 1, 0],
      [60, 157, 0x1b0, 0, 0, 0, 0],
    ]);
    expect(ballSprites(o)).toEqual([[60, 137, 0x1a0, 0, 6, 0, 0]]);
  });

  it('hides and shows objects with their original handlers', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    writeTitleObjects(rom, {
      ball: { visible: false },
      shadowLeft: { visible: false },
      shadowRight: { visible: false },
    });
    const o = readTitleObjects(rom);
    expect([o.ball.visible, o.shadowLeft.visible, o.shadowRight.visible]).toEqual([
      false,
      false,
      false,
    ]);
    expect(shadowSprites(o)).toEqual([]);
    expect(ballSprites(o)).toEqual([]);
    // the preview has no ball any more
    const { data } = renderTitleScreen(rom, readTitleScreen(rom), { pressStart: false });
    const at = (x, y) => Array.from(data.slice((y * 256 + x) * 4, (y * 256 + x) * 4 + 3));
    expect(at(131, 128)).not.toEqual([248, 248, 248]);
    writeTitleObjects(rom, {
      ball: { visible: true },
      shadowLeft: { visible: true },
      shadowRight: { visible: true },
    });
    expect(rom.getRomData()).toEqual(before);
  });

  it('rejects values out of range', () => {
    const rom = load();
    expect(() => writeTitleObjects(rom, { ball: { x: 300 } })).toThrow();
    expect(() => writeTitleObjects(rom, { ball: { z: 5 } })).toThrow();
    expect(() => writeTitleObjects(rom, { players: { y: -1 } })).toThrow();
  });

  it('undo snapshots cover the object values', () => {
    const rom = load();
    const snap = rom.readTitleScreenBytes();
    const before = rom.getRomData().slice();
    writeTitleObjects(rom, { ball: { visible: false, x: 10 }, players: { rightX: 200 } });
    rom.restoreTitleScreenBytes(snap);
    expect(rom.getRomData()).toEqual(before);
  });

  it('picks the ball shadow size from the height (as measured in the emulator)', () => {
    expect(ballShadowTile(0)).toBe(0xbed2b);
    expect(ballShadowTile(-48)).toBe(0xbed2b);
    expect(ballShadowTile(-49)).toBe(0xbed4b);
    expect(ballShadowTile(-54)).toBe(0xbed4b); // original
    expect(ballShadowTile(-96)).toBe(0xbed4b);
    expect(ballShadowTile(-97)).toBe(0xbed6b);
    expect(ballShadowTile(-160)).toBe(0xbed6b);
  });

  it('loads the extra tile of a frame (per team) and keeps only frames with known tiles', () => {
    const rom = load();
    const frames = listPoseFrames(rom);
    for (const y of frames) {
      const { sprites, rows } = readFrame(rom, y);
      for (const s of sprites) {
        const tiles = s.big ? [s.tile, s.tile + 1, s.tile + 16, s.tile + 17] : [s.tile];
        for (const t of tiles) {
          if (t !== 0x17) expect((t & 15) * 32).toBeLessThan(rows[t >> 4][1]);
        }
      }
    }
    // original left pose: the extra tile depends on the team (blank for Italy, a detail for Brazil)
    const italy = playerSprites(rom, 'left', 0xc1dc, null, 1).tiles[2][1];
    const brazil = playerSprites(rom, 'left', 0xc1dc, null, 19).tiles[2][1];
    expect(italy.every((b) => b === 0)).toBe(true);
    expect(brazil.some((b) => b !== 0)).toBe(true);
  });

  it('dresses the right player in the second kit when the predominant colours match', () => {
    const rom = load();
    const px = (state) => {
      const { data } = renderTitleScreen(rom, state, { pressStart: false });
      return Array.from(data.slice(0, data.length));
    };
    const s = readTitleScreen(rom);
    const brazil = TEAMS_INDEX('BRAZIL');
    const a = px({ ...s, teams: { left: TEAMS_INDEX('ITALY'), right: brazil } });
    const b = px({ ...s, teams: { left: brazil, right: brazil } });
    // the left player changes (Italy -> Brazil) and so does the right one (second kit)
    const right = (img) => img.slice((150 * 256 + 128) * 4, (150 * 256 + 160) * 4);
    expect(right(b)).not.toEqual(right(a));
  });
});
