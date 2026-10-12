import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  buildBackground,
  buildBackgroundFitting,
  backgroundState,
  readBackgroundMap,
} from '../titleBackground';
import { listPoseFrames, readPoses, playerSprites, readFrame } from '../titlePlayers';
import { readTitleScreen, renderTitleScreen, renderPoseSheet } from '../titleScreen';
import { TITLE_SCREEN } from '../constants';
import { TITLE_PLAYER_SPRITES } from '../titleScreenLayout';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const hasRealRom = existsSync(REAL_ROM);
const B = TITLE_SCREEN.BACKGROUND;

function image(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const c = paint(x, y);
      if (c) data.set([...c, 255], (y * width + x) * 4);
    }
  return { width, height, data };
}
const copyOf = (rom) => () => {
  const work = new RomParser(rom.getRomData());
  work.originalData = rom.getOriginalData();
  return work;
};
const sky = (data, x, y) => Array.from(data.slice((y * 256 + x) * 4, (y * 256 + x) * 4 + 3));

describe.skipIf(!hasRealRom)('title screen background', () => {
  const load = () => new RomParser(readFileSync(REAL_ROM));
  const both = (top, grass) => ({ top: { mode: top }, grass: { mode: grass } });

  it('reads the original state and rebuilds it byte for byte', () => {
    const rom = load();
    expect(backgroundState(rom)).toEqual({ top: 'original', grass: 'original' });
    const before = rom.getRomData().slice();
    const built = buildBackground(rom, both('original', 'original'));
    expect(rom.importTitleBackground(built, { top: 'original', grass: 'original' }).ok).toBe(true);
    expect(rom.getRomData()).toEqual(before);
  });

  it('removes the brush stroke and the grass', () => {
    const rom = load();
    const built = buildBackground(rom, both('none', 'none'));
    expect(rom.importTitleBackground(built, { top: 'none', grass: 'none' }).ok).toBe(true);
    expect(backgroundState(rom)).toEqual({ top: 'none', grass: 'none' });
    expect(readBackgroundMap(rom).every((w) => (w & 0x3ff) === 0)).toBe(true);
    // the sky shows where the stroke and the grass were
    const { data } = renderTitleScreen(rom, readTitleScreen(rom), { pressStart: false });
    expect(sky(data, 20, 80)).toEqual(sky(data, 0, 0));
    expect(sky(data, 20, 200)).toEqual(sky(data, 0, 0));
  });

  it('puts an image in the stroke area with its own palette (BG palette 7)', () => {
    const rom = load();
    const banner = image(64, 32, (x) => (x < 32 ? [248, 0, 0] : [0, 0, 248]));
    const built = buildBackground(rom, {
      top: { mode: 'image', image: banner },
      grass: { mode: 'original' },
    });
    expect(built.ok).toBe(true);
    expect(built.colors.stroke).toHaveLength(15);
    rom.importTitleBackground(built, { top: 'image', grass: 'original' });
    const s = readTitleScreen(rom);
    expect(s.background).toEqual({ top: 'custom', grass: 'original' });
    expect(s.colors.stroke).toEqual(built.colors.stroke);
    // centred at (128, 56): x 96-159, y 40-71
    const words = readBackgroundMap(rom);
    expect((words[5 * 32 + 12] >> 10) & 7).toBe(B.TOP_PALETTE);
    expect(s.colors.stroke).toContain(31); // red
    expect(s.colors.stroke).toContain(31 << 10); // blue
    // the cells left and right of the image stay empty
    expect(words[5 * 32 + 11] & 0x3ff).toBe(0);
    expect(words[5 * 32 + 20] & 0x3ff).toBe(0);
  });

  it('repeats a grass texture with two palettes and shares flipped tiles', () => {
    const rom = load();
    // left-right symmetric texture: the right half reuses the left tiles mirrored
    const tex = image(32, 16, (x, y) => (Math.abs(x - 15.5) < 6 ? [0, 200, 0] : [200, 0, y * 8]));
    const built = buildBackground(rom, {
      top: { mode: 'original' },
      grass: { mode: 'image', image: tex, repeat: true },
    });
    expect(built.ok).toBe(true);
    expect(built.tileCount).toBeLessThanOrEqual(0x55 + 4); // 8 cells, 4 tiles + mirrors
    const pals = new Set();
    for (let r = 14; r < 28; r++)
      for (let c = 0; c < 32; c++) pals.add((built.words[r * 32 + c] >> 10) & 7);
    expect([...pals].every((p) => B.GRASS_PALETTES.includes(p))).toBe(true);
    // the pattern repeats every 4 columns and 2 rows
    expect(built.words[14 * 32 + 4]).toBe(built.words[14 * 32]);
    expect(built.words[16 * 32 + 1]).toBe(built.words[14 * 32 + 1]);
  });

  it('keeps a custom part when only the other one changes', () => {
    const rom = load();
    const banner = image(80, 40, (x, y) =>
      ((x >> 3) + (y >> 3)) % 2 ? [248, 248, 0] : [0, 120, 0],
    );
    let built = buildBackground(rom, {
      top: { mode: 'image', image: banner },
      grass: { mode: 'original' },
    });
    rom.importTitleBackground(built, { top: 'image', grass: 'original' });
    const s1 = readTitleScreen(rom);
    const before = renderTitleScreen(rom, s1, { pressStart: false }).data.slice(0, 256 * 112 * 4);
    built = buildBackground(rom, { top: { mode: 'current' }, grass: { mode: 'none' } });
    expect(built.ok).toBe(true);
    rom.importTitleBackground(built, { top: 'current', grass: 'none' });
    const s2 = readTitleScreen(rom);
    expect(s2.background).toEqual({ top: 'custom', grass: 'none' });
    const after = renderTitleScreen(rom, s2, { pressStart: false }).data.slice(0, 256 * 112 * 4);
    expect(after).toEqual(before);
  });

  it('lowers the colours until a big image fits', () => {
    const rom = load();
    const field = image(256, 112, (x, y) => [x % 248, (x * y) % 248, (y * 7) % 248]);
    const res = buildBackgroundFitting(
      rom,
      { top: { mode: 'original' }, grass: { mode: 'image', image: field } },
      copyOf(rom),
    );
    if (res.ok) expect(res.colorCount).toBeLessThanOrEqual(15);
    else expect(res.error).toBe('bgNoSpace');
  });

  it('restores the original from anything', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    rom.importTitleBackground(buildBackground(rom, both('none', 'none')), {
      top: 'none',
      grass: 'none',
    });
    rom.importTitleBackground(buildBackground(rom, both('original', 'original')), {
      top: 'original',
      grass: 'original',
    });
    expect(backgroundState(rom)).toEqual({ top: 'original', grass: 'original' });
    // the blocks are back in their slots with their original bytes
    const h = (a, n) => Array.from(rom.getRomData().slice(a, a + n));
    expect(h(B.MAP, 380)).toEqual(Array.from(before.slice(B.MAP, B.MAP + 380)));
    expect(h(B.TILES, 1533)).toEqual(Array.from(before.slice(B.TILES, B.TILES + 1533)));
  });
});

describe.skipIf(!hasRealRom)('title screen player poses', () => {
  const load = () => new RomParser(readFileSync(REAL_ROM));

  it('finds the animation frames and the original poses', () => {
    const rom = load();
    const frames = listPoseFrames(rom);
    expect(frames.length).toBeGreaterThan(800);
    const poses = readPoses(rom);
    expect(poses).toEqual({ left: 0xc1dc, right: 0xc1a8 });
    expect(frames).toContain(poses.left);
    expect(frames).toContain(poses.right);
    expect(readFrame(rom, 0x8000)).toBeNull();
  });

  it('draws the original poses exactly as the game puts them in the OAM', () => {
    const rom = load();
    const { left, right } = readPoses(rom);
    expect(playerSprites(rom, 'left', left).sprites).toEqual(TITLE_PLAYER_SPRITES.slice(5, 11));
    expect(playerSprites(rom, 'right', right).sprites).toEqual(TITLE_PLAYER_SPRITES.slice(11, 14));
  });

  it('changes a pose (one undoable update) and rejects non-frames', () => {
    const rom = load();
    const frames = listPoseFrames(rom);
    rom.applyTitleScreenUpdates({ 'pose:left': frames[10] });
    expect(readTitleScreen(rom).poses.left).toBe(frames[10]);
    expect(() => rom.applyTitleScreenUpdates({ 'pose:right': 0x8000 })).toThrow();
  });

  it('renders a sheet with every pose', () => {
    const rom = load();
    const sheet = renderPoseSheet(rom, readTitleScreen(rom), 'right', { columns: 10 });
    expect(sheet.frames).toEqual(listPoseFrames(rom));
    expect(sheet.width).toBe(10 * sheet.cell[0]);
    expect(sheet.data.length).toBe(sheet.width * sheet.height * 4);
  });
});
