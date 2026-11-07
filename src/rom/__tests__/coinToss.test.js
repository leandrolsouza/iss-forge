import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  COIN_FACES,
  COIN_IMAGE,
  buildCoinFace,
  coinDrawable,
  coinShared,
  paintCoinFace,
  readCoinToss,
  readCoinTossBytes,
  renderCoinFace,
  restoreCoinTossBytes,
  sameCoinFaces,
  syncCoinShared,
  writeCoinToss,
} from '../coinToss';
import { konamiCompress, konamiDecompress } from '../KonamiCodec';
import { encodeTile, decodeTile } from '../bgTiles';
import { readMatchPalette } from '../palettes';
import { COIN_TOSS, MATCH_PALETTES } from '../constants';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const C = COIN_TOSS;
const COIN_TILES = new Set([...C.FACES.heads, ...C.FACES.tails].map(([, , t]) => t));
/** Deterministic pseudo-random numbers */
const random = (seed) => () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 8;

// --- Synthetic ROM: load-list pointer, the two sprite lists, the tile block, the colours ---

/** Sprite list like the game's: heads with 16x16 pieces (as in the ROM), tails all 8x8 */
function spriteList(face) {
  const entries =
    face === 'heads'
      ? [
          [-3, 13, 0x06, 0x02],
          [5, -3, 0x04, 0x02],
          [5, 5, 0x05, 0x02],
          [5, -11, 0x03, 0x02],
          [-11, -3, 0x01, 0x12],
          [-11, -11, 0x00, 0x12],
        ]
      : C.FACES.tails.map(([cx, cy, t]) => [cy * 8 - 11, cx * 8 - 11, t, 0x02]);
  return [entries.length, ...entries.flat().map((v) => v & 0xff)];
}

/**
 * @param {{ header?: number, tiles?: Uint8Array }} [options] - tiles: the 70 decompressed
 *   tiles (default: tile n filled with colour (n % 15) + 1 on its left half)
 */
function syntheticRom({ header = 0, tiles = null } = {}) {
  const data = new Uint8Array(0x100000 + header);
  let block = tiles;
  if (!block) {
    block = new Uint8Array(C.TILE_COUNT * 32);
    for (let t = 0; t < C.TILE_COUNT; t++) {
      const px = Array.from({ length: 64 }, (_, i) => (i % 8 < 4 ? (t % 15) + 1 : 0));
      block.set(encodeTile(px), t * 32);
    }
  }
  const packed = konamiCompress(block);
  if (packed.length > C.CAPACITY) throw new Error('synthetic block too big');
  data.fill(0xaa, C.TILES + header, C.TILES + header + C.CAPACITY + 16); // the next block
  data.set(packed, C.TILES + header);
  // $95:E950 in the load list
  data.set([0x50, 0xe9, 0x95], C.POINTER + header);
  for (const face of COIN_FACES) data.set(spriteList(face), C.FACE_LISTS[face] + header);
  const { offset } = MATCH_PALETTES.find((p) => p.id === 'coinToss');
  for (let i = 0; i < 15; i++) data[offset + header + i * 2] = i + 1;
  return new RomParser(data);
}

const tilesOf = (rom) =>
  konamiDecompress(rom.getRomData(), C.TILES + rom.headerOffset).slice(0, C.TILE_COUNT * 32);
const diff = (a, b) => {
  const out = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.push(i);
  return out;
};
const solidImage = (rgb) => {
  const { width, height } = COIN_IMAGE;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...rgb, 255], i * 4);
  return { width, height, data };
};

describe('coin toss (synthetic ROM)', () => {
  it('reads both faces from the cells of the sprite lists', () => {
    const rom = syntheticRom();
    const coin = readCoinToss(rom);
    expect(coin).toMatchObject({ state: 'original', capacity: C.CAPACITY });
    expect(coin.size).toBeLessThanOrEqual(C.CAPACITY);
    for (const face of COIN_FACES)
      for (const [cx, cy, t] of C.FACES[face]) {
        expect(coin.faces[face][cy * 8][cx * 8]).toBe((t % 15) + 1);
        expect(coin.faces[face][cy * 8 + 7][cx * 8 + 7]).toBe(0);
      }
    // cells the game does not draw stay empty
    expect(coin.faces.heads[0][24]).toBe(0);
    expect(coin.faces.heads[16][28]).toBe(0);
  });

  it('knows which pixels are drawn and which are shared', () => {
    expect(coinDrawable(0, 0)).toBe(true);
    expect(coinDrawable(23, 23)).toBe(true);
    expect(coinDrawable(24, 8)).toBe(true);
    expect(coinDrawable(31, 15)).toBe(true);
    expect(coinDrawable(24, 7)).toBe(false);
    expect(coinDrawable(24, 16)).toBe(false);
    expect(coinShared(24, 8)).toBe(true);
    expect(coinShared(23, 8)).toBe(false);
  });

  it.each([0, 512])('writes the faces and keeps the rest of the block (header %i)', (header) => {
    const rom = syntheticRom({ header });
    const before = new Uint8Array(rom.getRomData());
    const tilesBefore = tilesOf(rom);
    const { faces } = readCoinToss(rom);
    const painted = paintCoinFace(
      paintCoinFace(faces, 'heads', [{ x: 1, y: 1 }], 9),
      'tails',
      [{ x: 26, y: 12 }],
      3,
    );
    const res = writeCoinToss(rom, painted);
    expect(res.ok).toBe(true);

    const after = readCoinToss(rom);
    expect(after.state).toBe('custom');
    expect(after.faces.heads[1][1]).toBe(9);
    expect(after.faces.tails[12][26]).toBe(3);
    expect(after.faces.heads[12][26]).toBe(3); // shared rim
    expect(after.size).toBe(res.size);
    // only coin tiles changed inside the block
    const tilesAfter = tilesOf(rom);
    const changedTiles = new Set(diff(tilesBefore, tilesAfter).map((i) => i >> 5));
    expect([...changedTiles].sort((a, b) => a - b)).toEqual([0x00, 0x06]);
    // only the slot of the block changed in the file; the next block is intact
    const start = C.TILES + header;
    expect(diff(before, rom.getRomData()).every((i) => i >= start && i < start + C.CAPACITY)).toBe(
      true,
    );
    expect(rom.getRomData()[start + C.CAPACITY]).toBe(0xaa);
    expect(rom.getRomData()[start + res.size]).toBe(0xff); // padding after the new block
  });

  it('writes the exact original bytes when the drawing goes back to the original', () => {
    const rom = syntheticRom();
    const original = new Uint8Array(rom.getRomData());
    const { faces } = readCoinToss(rom);
    expect(writeCoinToss(rom, paintCoinFace(faces, 'heads', [{ x: 2, y: 2 }], 7)).ok).toBe(true);
    expect(diff(original, rom.getRomData()).length).toBeGreaterThan(0);

    const res = writeCoinToss(rom, faces);
    expect(res.ok).toBe(true);
    expect(diff(original, rom.getRomData())).toEqual([]);
    expect(readCoinToss(rom).state).toBe('original');
  });

  it('fails without writing when the drawing does not fit in the block', () => {
    // noise in most of the other tiles: the coin tiles are blank and the block fits
    const rnd = random(7);
    const tiles = new Uint8Array(C.TILE_COUNT * 32);
    let noisy = 0;
    for (let t = 0; t < C.TILE_COUNT && noisy < 38; t++) {
      if (COIN_TILES.has(t)) continue;
      for (let k = 0; k < 32; k++) tiles[t * 32 + k] = rnd() & 0xff;
      noisy++;
    }
    const rom = syntheticRom({ tiles });
    const before = new Uint8Array(rom.getRomData());
    const { faces } = readCoinToss(rom);
    const points = [];
    for (let y = 0; y < C.HEIGHT; y++) for (let x = 0; x < C.WIDTH; x++) points.push({ x, y });
    let noise = faces;
    for (const face of COIN_FACES)
      for (const p of points) noise = paintCoinFace(noise, face, [p], (rnd() % 15) + 1);
    noise = syncCoinShared(noise, 'heads');

    const res = writeCoinToss(rom, noise);
    expect(res).toMatchObject({ ok: false, error: 'coinErrNoSpace', capacity: C.CAPACITY });
    expect(res.size).toBeGreaterThan(C.CAPACITY);
    expect(diff(before, rom.getRomData())).toEqual([]);
  });

  it('rejects invalid faces and a rim that differs between the faces', () => {
    const rom = syntheticRom();
    const before = new Uint8Array(rom.getRomData());
    const { faces } = readCoinToss(rom);
    expect(writeCoinToss(rom, null).error).toBe('coinErrFaces');
    expect(writeCoinToss(rom, { heads: faces.heads, tails: [[1, 2]] }).error).toBe('coinErrFaces');
    const bad = faces.heads.map((row) => [...row]);
    bad[3][3] = 16;
    expect(writeCoinToss(rom, { ...faces, heads: bad }).error).toBe('coinErrFaces');
    const rim = faces.tails.map((row) => [...row]);
    rim[9][25] = 5;
    expect(writeCoinToss(rom, { ...faces, tails: rim }).error).toBe('coinErrShared');
    expect(diff(before, rom.getRomData())).toEqual([]);
  });

  it('refuses ROMs with another layout', () => {
    const moved = syntheticRom();
    moved.writeBytes(C.POINTER, [0x00, 0x80, 0x95]);
    expect(readCoinToss(moved)).toBeNull();
    expect(writeCoinToss(moved, readCoinToss(syntheticRom()).faces).error).toBe('coinErrLayout');

    const list = syntheticRom();
    list.writeByte(C.FACE_LISTS.tails + 3, 0x30); // a tails piece shows another tile
    expect(readCoinToss(list)).toBeNull();

    const big = syntheticRom();
    big.writeBytes(C.TILES, [(C.CAPACITY + 1) & 0xff, (C.CAPACITY + 1) >> 8]);
    expect(readCoinToss(big)).toBeNull();
  });

  it('undo bytes cover the block slot', () => {
    const rom = syntheticRom();
    const original = new Uint8Array(rom.getRomData());
    const snapshot = readCoinTossBytes(rom);
    expect(snapshot).toHaveLength(C.CAPACITY);
    const { faces } = readCoinToss(rom);
    writeCoinToss(rom, paintCoinFace(faces, 'tails', [{ x: 5, y: 20 }], 2));
    restoreCoinTossBytes(rom, snapshot);
    expect(diff(original, rom.getRomData())).toEqual([]);
    restoreCoinTossBytes(rom, [1, 2, 3]); // wrong size: ignored
    expect(diff(original, rom.getRomData())).toEqual([]);
  });
});

describe('coin toss editing helpers', () => {
  const blank = () => readCoinToss(syntheticRom({ tiles: new Uint8Array(70 * 32) })).faces;

  it('paints the shared rim on both faces and skips pixels the game does not draw', () => {
    const faces = blank();
    expect(paintCoinFace(faces, 'heads', [{ x: 28, y: 2 }], 4)).toBe(faces);
    expect(paintCoinFace(faces, 'heads', [{ x: 0, y: 0 }], 0)).toBe(faces);
    const next = paintCoinFace(
      faces,
      'tails',
      [
        { x: 30, y: 10 },
        { x: 4, y: 4 },
      ],
      6,
    );
    expect(next.tails[10][30]).toBe(6);
    expect(next.heads[10][30]).toBe(6);
    expect(next.tails[4][4]).toBe(6);
    expect(next.heads[4][4]).toBe(0);
    expect(faces.tails[4][4]).toBe(0); // the input is not changed
    expect(sameCoinFaces(faces, next)).toBe(false);
    expect(sameCoinFaces(faces, blank())).toBe(true);
  });

  it('imports an image with the current colours', () => {
    const faces = blank();
    const colors = Array.from({ length: 15 }, (_, i) => (i === 4 ? 31 : 0x7fff)); // #5 red
    const image = solidImage([248, 0, 0]);
    // a transparent pixel and one outside the drawn cells
    image.data[3] = 0;
    const res = buildCoinFace({ image, face: 'heads', faces, colors });
    expect(res.ok).toBe(true);
    expect(res.colors).toEqual(colors);
    expect(res.faces.heads[0][0]).toBe(0);
    expect(res.faces.heads[0][1]).toBe(5);
    expect(res.faces.heads[23][23]).toBe(5);
    expect(res.faces.heads[0][24]).toBe(0); // not drawn by the game
    expect(res.faces.heads[8][24]).toBe(5);
    expect(res.faces.tails[8][24]).toBe(5); // the rim follows the import
    expect(res.faces.tails[0][0]).toBe(0);
  });

  it('imports with new colours and remaps the other face', () => {
    const colors = Array.from({ length: 15 }, (_, i) => (i === 0 ? 31 << 10 : 0)); // #1 blue
    const faces = paintCoinFace(blank(), 'tails', [{ x: 3, y: 3 }], 1);
    const res = buildCoinFace({
      image: solidImage([0, 248, 0]),
      face: 'heads',
      faces,
      colors,
      newColors: true,
    });
    expect(res.ok).toBe(true);
    expect(res.colorCount).toBe(2);
    expect(res.colors).toHaveLength(15);
    const green = res.colors.indexOf(31 << 5) + 1;
    const blue = res.colors.indexOf(31 << 10) + 1;
    expect(green).toBeGreaterThan(0);
    expect(blue).toBeGreaterThan(0);
    expect(res.faces.heads[5][5]).toBe(green);
    expect(res.faces.tails[3][3]).toBe(blue);
  });

  it('reports bad images', () => {
    const faces = blank();
    const colors = new Array(15).fill(0);
    expect(
      buildCoinFace({ image: { width: 8, height: 8, data: [] }, face: 'heads', faces, colors })
        .error,
    ).toBe('coinErrImageSize');
    const empty = solidImage([0, 0, 0]);
    for (let i = 3; i < empty.data.length; i += 4) empty.data[i] = 0;
    expect(buildCoinFace({ image: empty, face: 'tails', faces, colors }).error).toBe(
      'coinErrEmpty',
    );
    expect(buildCoinFace({ image: empty, face: 'edge', faces, colors }).error).toBe('coinErrFaces');
  });

  it('renders a face with its colours over a backdrop', () => {
    const faces = paintCoinFace(blank(), 'heads', [{ x: 2, y: 1 }], 3);
    const colors = Array.from({ length: 15 }, (_, i) => (i === 2 ? 31 : 0));
    const img = renderCoinFace(faces.heads, colors, { backdrop: 31 << 10 });
    expect([img.width, img.height]).toEqual([32, 24]);
    const at = (x, y) => Array.from(img.data.slice((y * 32 + x) * 4, (y * 32 + x) * 4 + 4));
    expect(at(2, 1)).toEqual([248, 0, 0, 255]);
    expect(at(0, 0)).toEqual([0, 0, 248, 255]);
    expect(renderCoinFace(faces.heads, colors).data[3]).toBe(0);
  });
});

describe.skipIf(!existsSync(REAL_ROM))('coin toss on the real ROM', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));

  it('reads the original coin', () => {
    const rom = load();
    const coin = readCoinToss(rom);
    expect(coin).toMatchObject({ state: 'original', size: C.CAPACITY, capacity: C.CAPACITY });
    // top edge of the coin and the rim column (x 24) on both faces
    expect(coin.faces.heads[0].slice(10, 15)).toEqual([3, 3, 3, 2, 9]);
    expect(coin.faces.tails[0].slice(10, 15)).toEqual([3, 3, 3, 2, 9]);
    expect(coin.faces.heads[9][24]).toBe(0xd);
    expect(coin.faces.tails[9][24]).toBe(0xd);
    expect(readMatchPalette(rom, 'coinToss').slice(0, 3)).toEqual([0x7bde, 0x6bdc, 0x6379]);
  });

  it('round-trips an edit and goes back to the original bytes', () => {
    const rom = load();
    const original = new Uint8Array(rom.getRomData());
    const { faces } = readCoinToss(rom);
    const res = writeCoinToss(rom, paintCoinFace(faces, 'tails', [{ x: 12, y: 12 }], 1));
    expect(res.ok).toBe(true);
    expect(res.size).toBeLessThanOrEqual(C.CAPACITY);
    expect(readCoinToss(rom).faces.tails[12][12]).toBe(1);
    // the other 51 tiles of the block are untouched
    const tiles = tilesOf(rom);
    const orig = konamiDecompress(original, C.TILES);
    for (let t = 0; t < C.TILE_COUNT; t++) {
      if (COIN_TILES.has(t)) continue;
      expect(decodeTile(tiles.subarray(t * 32, t * 32 + 32))).toEqual(
        decodeTile(orig.subarray(t * 32, t * 32 + 32)),
      );
    }
    expect(writeCoinToss(rom, faces).ok).toBe(true);
    expect(diff(original, rom.getRomData())).toEqual([]);
  });
});
