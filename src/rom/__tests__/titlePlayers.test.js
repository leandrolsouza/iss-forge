import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import { readFrame, listPoseFrames, readPoses, writePose, playerSprites } from '../titlePlayers';
import { TITLE_SCREEN } from '../constants';

const P = TITLE_SCREEN.PLAYERS;
const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const hasRealRom = existsSync(REAL_ROM);

const ORIGINAL = { left: 0xc1dc, right: 0xc1a8 };
const fileOf = (ptr) => ((ptr >> 16) & 0x7f) * 0x8000 + ((ptr & 0xffff) - 0x8000);
const changedBytes = (a, b) => {
  const out = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.push(i);
  return out;
};

// --- synthetic ROM: 1 MiB of zeros with one hand-made frame record -------------------------

const put = (rom, a, bytes) => bytes.forEach((b, i) => rom.writeByte(a + i, b));
const put16 = (rom, a, v) => put(rom, a, [v & 0xff, (v >> 8) & 0xff]);
const put24 = (rom, a, v) => put(rom, a, [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff]);
const fill = (rom, a, n, v) => put(rom, a, new Array(n).fill(v));

/** Frame record at $82:C000 (file 0x14000), sprite list at $88:9000 (file 0x41000) */
const Y = 0xc000;
const RECORD = 0x14000;
const LIST = 0x9000;
const PTR_A = 0x888100; // file 0x40100: [size] + row A tiles (bytes 0x11)
const PTR_B = 0x888200; // file 0x40200: [size] + row B tiles (bytes 0x22)
/** [dy, dx, tile, attr] */
const SPRITES = [
  [-8, -4, 0, 0x08], // 8x8, bit 3 set (does not change the palette)
  [-16, 2, 16, 0xe0], // 8x8 in row B, palette + 4, h and v flip
  [-24, -10, 0, 0x10], // 16x16 (tiles 0, 1, 16, 17)
];

function synth({
  list = LIST,
  ptrA = PTR_A,
  ptrB = PTR_B,
  sizeA = 0x40,
  sizeB = 0x40,
  extra = 0,
  sprites = SPRITES,
  count = sprites.length,
} = {}) {
  const rom = new RomParser(new Uint8Array(0x100000));
  put16(rom, RECORD, list);
  put24(rom, RECORD + 2, ptrA);
  put24(rom, RECORD + 5, ptrB);
  put16(rom, RECORD + 8, extra);
  [
    [ptrA, sizeA, 0x11],
    [ptrB, sizeB, 0x22],
  ].forEach(([ptr, size, v]) => {
    put16(rom, fileOf(ptr), size);
    fill(rom, fileOf(ptr) + 2, size, v);
  });
  const lf = 0x40000 + (LIST - 0x8000);
  rom.writeByte(lf, count);
  sprites.forEach((s, i) => put(rom, lf + 1 + i * 4, s));
  return rom;
}

/** 32-byte tile at `ptr` (preceded by its size word) pointed to from file offset `at` */
function putExtraTile(rom, at, ptr, v) {
  put24(rom, at, ptr);
  put16(rom, fileOf(ptr), 32);
  fill(rom, fileOf(ptr) + 2, 32, v);
}

describe('readFrame (synthetic record)', () => {
  it('decodes the sprite list, the two tile rows and the extra word', () => {
    expect(readFrame(synth({ extra: 0x1234 }), Y)).toEqual({
      sprites: [
        { dx: -4, dy: -8, tile: 0, big: 0, palette: 0, h: 0, v: 0 },
        { dx: 2, dy: -16, tile: 16, big: 0, palette: 4, h: 1, v: 1 },
        { dx: -10, dy: -24, tile: 0, big: 1, palette: 0, h: 0, v: 0 },
      ],
      rows: [
        [0x40102, 0x40],
        [0x40202, 0x40],
      ],
      extra: 0x1234,
    });
  });

  it('returns null outside bank $82 and for a blank record', () => {
    const rom = synth();
    expect(readFrame(rom, 0x7fff)).toBeNull();
    expect(readFrame(rom, 0x10000)).toBeNull();
    expect(readFrame(rom, 0xfff9)).toBeNull();
    expect(readFrame(rom, -1)).toBeNull();
    expect(readFrame(rom, Y + 0x10)).toBeNull();
    expect(readFrame(new RomParser(new Uint8Array(0x100000)), Y)).toBeNull();
  });

  it('rejects a sprite list outside the ROM banks', () => {
    expect(readFrame(synth({ list: 0x7fff }), Y)).toBeNull();
  });

  it('rejects tile pointers outside banks $88-$9F or below $8000', () => {
    expect(readFrame(synth({ ptrA: 0x878100 }), Y)).toBeNull();
    expect(readFrame(synth({ ptrB: 0xa08100 }), Y)).toBeNull();
    expect(readFrame(synth({ ptrA: 0x887f00 }), Y)).toBeNull();
    expect(readFrame(synth({ ptrB: 0x9f8100 }), Y)).not.toBeNull();
  });

  it('checks the row sizes (multiple of 32, at most 0x200, first row not empty)', () => {
    expect(readFrame(synth({ sizeA: 0x30 }), Y)).toBeNull();
    expect(readFrame(synth({ sizeA: 0x220 }), Y)).toBeNull();
    expect(readFrame(synth({ sizeA: 0x200 }), Y)).not.toBeNull();
    expect(readFrame(synth({ sizeA: 0 }), Y)).toBeNull();
    // an empty second row is fine when no sprite uses it
    expect(readFrame(synth({ sizeB: 0, sprites: [[0, 0, 0, 0]] }), Y)).not.toBeNull();
  });

  it('accepts 1 to 12 sprites', () => {
    const many = (n) => Array.from({ length: n }, () => [0, 0, 0, 0]);
    expect(readFrame(synth({ count: 0, sprites: [] }), Y)).toBeNull();
    expect(readFrame(synth({ sprites: many(12) }), Y).sprites).toHaveLength(12);
    expect(readFrame(synth({ sprites: many(13) }), Y)).toBeNull();
  });

  it('keeps only tiles the frame loads (tile 0x17 always comes from the extra DMA)', () => {
    // row A loads 1 tile: tile 1 would show what another frame left in the VRAM
    expect(readFrame(synth({ sizeA: 0x20, sprites: [[0, 0, 1, 0]] }), Y)).toBeNull();
    expect(readFrame(synth({ sizeA: 0x20, sprites: [[0, 0, 0, 0]] }), Y)).not.toBeNull();
    // the 16x16 sprite needs tiles 1 and 17 too
    expect(readFrame(synth({ sizeA: 0x20 }), Y)).toBeNull();
    expect(readFrame(synth({ sizeB: 0x20 }), Y)).toBeNull();
    expect(readFrame(synth({ sizeB: 0, sprites: [[0, 0, 0x17, 0]] }), Y)).not.toBeNull();
    expect(readFrame(synth({ sizeB: 0, sprites: [[0, 0, 0x16, 0]] }), Y)).toBeNull();
  });

  it('rejects 16x16 sprites that leave the two rows', () => {
    const big = (tile) => synth({ sizeA: 0x200, sizeB: 0x200, sprites: [[0, 0, tile, 0x10]] });
    expect(readFrame(big(14), Y)).not.toBeNull();
    expect(readFrame(big(15), Y)).toBeNull(); // would wrap to the next row
    expect(readFrame(big(16), Y)).toBeNull(); // bottom half beyond the second row
    expect(readFrame(synth({ sizeB: 0x200, sprites: [[0, 0, 31, 0]] }), Y)).not.toBeNull();
    expect(readFrame(synth({ sprites: [[0, 0, 32, 0]] }), Y)).toBeNull();
  });

  it('limits the sprite offsets to dx -48..40 and dy -72..16', () => {
    const at = (dy, dx) => readFrame(synth({ sprites: [[dy & 0xff, dx & 0xff, 0, 0]] }), Y);
    expect(at(0, -48)).not.toBeNull();
    expect(at(0, -49)).toBeNull();
    expect(at(0, 40)).not.toBeNull();
    expect(at(0, 41)).toBeNull();
    expect(at(-72, 0)).not.toBeNull();
    expect(at(-73, 0)).toBeNull();
    expect(at(16, 0)).not.toBeNull();
    expect(at(17, 0)).toBeNull();
  });
});

describe('playerSprites (synthetic record)', () => {
  it('places the left player at its object origin with its tiles and palette', () => {
    const rom = synth();
    const { sprites, tiles } = playerSprites(rom, 'left', Y);
    // reverse drawing order, [x, y, tile, big, palette, h, v]
    expect(sprites).toEqual([
      [0x72 - 10, 0xb0 - 24, 0x40, 1, 0, 0, 0],
      [0x72 + 2, 0xb0 - 16, 0x50, 0, 4, 1, 1],
      [0x72 - 4, 0xb0 - 8, 0x40, 0, 0, 0, 0],
    ]);
    expect(tiles.map(([t, b]) => [t, b.length])).toEqual([
      [0x40, 0x40],
      [0x50, 0x40],
      [0x57, 32],
    ]);
    expect(tiles[0][1].every((b) => b === 0x11)).toBe(true);
    expect(tiles[1][1].every((b) => b === 0x22)).toBe(true);
  });

  it('mirrors the right player (x = origin - dx - size) with its tiles and palette', () => {
    const { sprites, tiles } = playerSprites(synth(), 'right', Y);
    expect(sprites).toEqual([
      [0x90 + 10 - 16, 0xb0 - 24, 0x20, 1, 1, 1, 0],
      [0x90 - 2 - 8, 0xb0 - 16, 0x30, 0, 5, 0, 1],
      [0x90 + 4 - 8, 0xb0 - 8, 0x20, 0, 1, 1, 0],
    ]);
    expect(tiles.map(([t]) => t)).toEqual([0x20, 0x30, 0x37]);
  });

  it('uses the given origin instead of the object position', () => {
    const rom = synth();
    expect(playerSprites(rom, 'left', Y, [0, 0]).sprites.map((s) => s.slice(0, 2))).toEqual([
      [-10, -24],
      [2, -16],
      [-4, -8],
    ]);
    expect(playerSprites(rom, 'right', Y, [100, 50]).sprites.map((s) => s.slice(0, 2))).toEqual([
      [94, 26],
      [90, 34],
      [96, 42],
    ]);
  });

  it('loads the blank entry ($82:AB27) as extra tile when the extra word is 0', () => {
    const rom = synth();
    expect(playerSprites(rom, 'left', Y).tiles[2][1].every((b) => b === 0)).toBe(true);
    putExtraTile(rom, 0x12b27, 0x888600, 0x66);
    expect(playerSprites(rom, 'left', Y, null, 7).tiles[2][1]).toEqual(
      new Uint8Array(32).fill(0x66),
    );
  });

  it('picks a per-team extra tile (table + 3 x ordinal) for a positive extra word', () => {
    const rom = synth({ extra: 0x1000 }); // table at $82:9000 = file 0x11000
    putExtraTile(rom, 0x11000 + 3 * 2, 0x888300, 0x33);
    const tile = (side, ordinal) => playerSprites(rom, side, Y, null, ordinal).tiles[2][1];
    expect(tile('left', 2)).toEqual(new Uint8Array(32).fill(0x33));
    expect(tile('right', 2)).toEqual(new Uint8Array(32).fill(0x33));
    // ordinal 0: null pointer -> blank tile
    expect(tile('left', 0).every((b) => b === 0)).toBe(true);
    expect(tile('left').every((b) => b === 0)).toBe(true);
    // the ordinal only changes the extra tile
    expect(playerSprites(rom, 'left', Y, null, 2).sprites).toEqual(
      playerSprites(rom, 'left', Y, null, 0).sprites,
    );
  });

  it('picks a per-player extra tile (0 left, 0x2D right) for a negative extra word', () => {
    const rom = synth({ extra: 0xa000 }); // file 0x12000
    putExtraTile(rom, 0x12000, 0x888400, 0x44);
    putExtraTile(rom, 0x12000 + 0x2d, 0x888500, 0x55);
    const tile = (side, ordinal) => playerSprites(rom, side, Y, null, ordinal).tiles[2][1];
    expect(tile('left', 0)).toEqual(new Uint8Array(32).fill(0x44));
    expect(tile('left', 19)).toEqual(new Uint8Array(32).fill(0x44));
    expect(tile('right', 0)).toEqual(new Uint8Array(32).fill(0x55));
  });

  it('returns a blank extra tile when its pointer is not a ROM address', () => {
    const rom = synth({ extra: 0x1000 });
    put24(rom, 0x11000, 0x7f9000);
    expect(playerSprites(rom, 'left', Y).tiles[2][1]).toEqual(new Uint8Array(32));
    put24(rom, 0x11000, 0x887fff);
    expect(playerSprites(rom, 'left', Y).tiles[2][1]).toEqual(new Uint8Array(32));
  });

  it('returns null for a non-frame', () => {
    expect(playerSprites(synth(), 'left', Y + 1)).toBeNull();
    expect(playerSprites(synth(), 'right', Y + 1)).toBeNull();
  });

  it('throws on an unknown side', () => {
    expect(() => playerSprites(synth(), 'middle', Y)).toThrow('Invalid side');
    expect(() => playerSprites(synth(), 'middle', Y + 1)).toThrow('Invalid side');
    expect(() => playerSprites(synth(), 'toString', Y)).toThrow('Invalid side');
  });
});

describe('listPoseFrames (synthetic record)', () => {
  it('finds only the valid records of $82:BC00-$82:F2E0', () => {
    expect(listPoseFrames(new RomParser(new Uint8Array(0x100000)))).toEqual([]);
    expect(listPoseFrames(synth())).toEqual([Y]);
  });

  it('caches the list per ROM buffer', () => {
    const rom = synth();
    const frames = listPoseFrames(rom);
    expect(listPoseFrames(rom)).toBe(frames);
    // current behaviour: in-place edits of the same buffer are not seen (stale cache)
    put16(rom, RECORD, 0);
    expect(readFrame(rom, Y)).toBeNull();
    expect(listPoseFrames(rom)).toEqual([Y]);
    // another buffer is scanned again
    expect(listPoseFrames(new RomParser(rom.getRomData()))).toEqual([]);
  });
});

describe.skipIf(!hasRealRom)('title screen player poses (real ROM)', () => {
  const load = () => new RomParser(readFileSync(REAL_ROM));

  it('decodes the original poses', () => {
    const rom = load();
    expect(readFrame(rom, ORIGINAL.left)).toEqual({
      sprites: [
        { dx: -3, dy: -33, tile: 23, big: 0, palette: 4, h: 0, v: 0 },
        { dx: 8, dy: -38, tile: 20, big: 0, palette: 0, h: 0, v: 0 },
        { dx: 0, dy: -39, tile: 5, big: 0, palette: 0, h: 0, v: 0 },
        { dx: -8, dy: -39, tile: 4, big: 0, palette: 0, h: 0, v: 0 },
        { dx: -11, dy: -15, tile: 2, big: 1, palette: 0, h: 0, v: 0 },
        { dx: -9, dy: -31, tile: 0, big: 1, palette: 0, h: 0, v: 0 },
      ],
      rows: [
        [388598, 192],
        [388792, 160],
      ],
      extra: 0x724b,
    });
    expect(readFrame(rom, ORIGINAL.right)).toEqual({
      sprites: [
        { dx: -7, dy: -12, tile: 4, big: 1, palette: 0, h: 0, v: 0 },
        { dx: -1, dy: -28, tile: 2, big: 1, palette: 0, h: 0, v: 0 },
        { dx: -2, dy: -44, tile: 0, big: 1, palette: 0, h: 0, v: 0 },
      ],
      rows: [
        [387142, 192],
        [387336, 192],
      ],
      extra: 0,
    });
  });

  it('returns null for addresses that are not frame records', () => {
    const rom = load();
    expect(readFrame(rom, 0x8000)).toBeNull();
    expect(readFrame(rom, ORIGINAL.left + 1)).toBeNull();
    expect(readFrame(rom, 0x7fff)).toBeNull();
    expect(readFrame(rom, 0x10000)).toBeNull();
  });

  it('lists the 864 frames, unique, in ROM order, all readable, with the original poses', () => {
    const rom = load();
    const frames = listPoseFrames(rom);
    expect(frames).toHaveLength(864);
    expect(new Set(frames).size).toBe(864);
    expect(frames.every((y, i) => i === 0 || y > frames[i - 1])).toBe(true);
    expect(frames[0]).toBe(0xbc12);
    expect(frames[frames.length - 1]).toBe(0xf02a);
    expect(frames.every((y) => y >= 0xbc00 && y < 0xf2e0)).toBe(true);
    expect(frames.every((y) => readFrame(rom, y) !== null)).toBe(true);
    expect(frames).toContain(ORIGINAL.left);
    expect(frames).toContain(ORIGINAL.right);
  });

  it('no frame outside the scanned range passes readFrame', () => {
    const rom = load();
    const frames = new Set(listPoseFrames(rom));
    for (let y = 0x8000; y < 0x10000; y++) {
      if (!frames.has(y)) expect(readFrame(rom, y)).toBeNull();
    }
  });

  it('reads the original poses from the LDY operands', () => {
    const rom = load();
    expect(readPoses(rom)).toEqual(ORIGINAL);
    expect([rom.readByte(P.LEFT.pose), rom.readByte(P.LEFT.pose + 1)]).toEqual([0xdc, 0xc1]);
    expect([rom.readByte(P.RIGHT.pose), rom.readByte(P.RIGHT.pose + 1)]).toEqual([0xa8, 0xc1]);
  });

  for (const side of ['left', 'right']) {
    it(`writes the ${side} pose: only its 2 LDY bytes change`, () => {
      const rom = load();
      const before = rom.getRomData().slice();
      const other = side === 'left' ? 'right' : 'left';
      const pose = P[side.toUpperCase()].pose;
      const y = listPoseFrames(rom).find(
        (f) => (f & 0xff) !== before[pose] && f >> 8 !== before[pose + 1],
      );
      writePose(rom, side, y);
      expect(readPoses(rom)[side]).toBe(y);
      expect(readPoses(rom)[other]).toBe(ORIGINAL[other]);
      expect(changedBytes(before, rom.getRomData())).toEqual([pose, pose + 1]);
      writePose(rom, side, ORIGINAL[side]);
      expect(changedBytes(before, rom.getRomData())).toEqual([]);
    });
  }

  it('round-trips every frame on both sides', () => {
    const rom = load();
    for (const y of listPoseFrames(rom)) {
      writePose(rom, 'left', y);
      writePose(rom, 'right', y);
      expect(readPoses(rom)).toEqual({ left: y, right: y });
    }
  });

  it('rejects invalid sides and non-frames without touching the ROM', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    expect(() => writePose(rom, 'middle', ORIGINAL.left)).toThrow('Invalid side');
    expect(() => writePose(rom, 'LEFT', ORIGINAL.left)).toThrow('Invalid side');
    expect(() => writePose(rom, undefined, ORIGINAL.left)).toThrow('Invalid side');
    expect(() => writePose(rom, 'left', 0x8000)).toThrow('Not an animation frame');
    expect(() => writePose(rom, 'right', ORIGINAL.left + 1)).toThrow('Not an animation frame');
    expect(() => writePose(rom, 'left', -1)).toThrow('Not an animation frame');
    expect(() => writePose(rom, 'left', 0x10000 + ORIGINAL.left)).toThrow('Not an animation frame');
    expect(changedBytes(before, rom.getRomData())).toEqual([]);
  });

  it('rejects inherited property names as a side', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    expect(() => writePose(rom, 'toString', ORIGINAL.left)).toThrow('Invalid side');
    expect(() => writePose(rom, 'constructor', ORIGINAL.left)).toThrow('Invalid side');
    expect(changedBytes(before, rom.getRomData())).toEqual([]);
  });

  it('draws the original poses at the object positions', () => {
    const rom = load();
    const left = playerSprites(rom, 'left', ORIGINAL.left);
    expect(left.sprites).toEqual([
      [105, 145, 64, 1, 0, 0, 0],
      [103, 161, 66, 1, 0, 0, 0],
      [106, 137, 68, 0, 0, 0, 0],
      [114, 137, 69, 0, 0, 0, 0],
      [122, 138, 84, 0, 0, 0, 0],
      [111, 143, 87, 0, 4, 0, 0],
    ]);
    expect(left.tiles.map(([t, b]) => [t, b.length])).toEqual([
      [0x40, 192],
      [0x50, 160],
      [0x57, 32],
    ]);
    expect(left.tiles[0][1]).toEqual(rom.readBytes(388598, 192));
    expect(left.tiles[1][1]).toEqual(rom.readBytes(388792, 160));
    const right = playerSprites(rom, 'right', ORIGINAL.right);
    expect(right.sprites).toEqual([
      [130, 132, 32, 1, 1, 1, 0],
      [129, 148, 34, 1, 1, 1, 0],
      [135, 164, 36, 1, 1, 1, 0],
    ]);
    expect(right.tiles.map(([t, b]) => [t, b.length])).toEqual([
      [0x20, 192],
      [0x30, 192],
      [0x37, 32],
    ]);
  });

  it('positions every frame relative to the origin (left: + dx, right: - dx - size)', () => {
    const rom = load();
    for (const y of listPoseFrames(rom)) {
      const { sprites } = readFrame(rom, y);
      const order = sprites.slice().reverse();
      const left = playerSprites(rom, 'left', y, [50, 60]).sprites;
      const right = playerSprites(rom, 'right', y, [200, 100]).sprites;
      expect(left).toHaveLength(sprites.length);
      order.forEach((sp, i) => {
        const size = sp.big ? 16 : 8;
        expect(left[i]).toEqual([
          50 + sp.dx,
          60 + sp.dy,
          0x40 + sp.tile,
          sp.big,
          sp.palette,
          sp.h,
          sp.v,
        ]);
        expect(right[i]).toEqual([
          200 - sp.dx - size,
          100 + sp.dy,
          0x20 + sp.tile,
          sp.big,
          1 | sp.palette,
          sp.h ^ 1,
          sp.v,
        ]);
      });
    }
  });

  it('changes only the extra tile with the team ordinal', () => {
    const rom = load();
    const italy = playerSprites(rom, 'left', ORIGINAL.left, null, 1);
    const brazil = playerSprites(rom, 'left', ORIGINAL.left, null, 19);
    expect(brazil.sprites).toEqual(italy.sprites);
    expect(brazil.tiles.slice(0, 2)).toEqual(italy.tiles.slice(0, 2));
    expect(italy.tiles[2][1].every((b) => b === 0)).toBe(true);
    expect(brazil.tiles[2][1].some((b) => b !== 0)).toBe(true);
    // the original right pose has no extra tile: blank for every team
    for (const ordinal of [0, 1, 19]) {
      const { tiles } = playerSprites(rom, 'right', ORIGINAL.right, null, ordinal);
      expect(tiles[2][1]).toEqual(new Uint8Array(32));
    }
  });

  it('uses a per-player extra tile for frames with a negative extra word', () => {
    const rom = load();
    const frames = listPoseFrames(rom).filter((y) => readFrame(rom, y).extra >= 0x8000);
    expect(frames.length).toBeGreaterThan(0);
    const differs = frames.find((y) => {
      const a = playerSprites(rom, 'left', y).tiles[2][1];
      const b = playerSprites(rom, 'right', y).tiles[2][1];
      return a.some((v, i) => v !== b[i]);
    });
    expect(differs).toBeDefined();
    // the team ordinal does not matter here
    expect(playerSprites(rom, 'left', differs, null, 19).tiles[2][1]).toEqual(
      playerSprites(rom, 'left', differs, null, 0).tiles[2][1],
    );
  });
});
