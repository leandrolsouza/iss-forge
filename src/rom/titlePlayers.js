/**
 * Title screen players: the pose (animation frame) of each one.
 *
 * Each player object shows one frame of the match animations: a record in bank
 * $82 = sprite list (word, bank $88: n, then n x [dy, dx, tile, attr]) + two
 * pointers to raw 4bpp tile rows (size word + data), DMA'd to the object's OBJ
 * tiles (row `tile` and row `tile + 16`). The pose is the LDY #record before
 * JSL $83:D536 in the title screen code, so any frame of the game can be used
 * without touching the match graphics.
 *
 * See TITLE_SCREEN.PLAYERS in constants.js and research/title-screen.md.
 */
import { TITLE_SCREEN } from './constants';

const P = TITLE_SCREEN.PLAYERS;
const SIDES = { left: P.LEFT, right: P.RIGHT };
/** Config of a side ('left' | 'right'); throws on anything else (inherited names included) */
const sideOf = (side) => {
  if (!Object.hasOwn(SIDES, side)) throw new Error('Invalid side');
  return SIDES[side];
};
const s8 = (b) => (b > 127 ? b - 256 : b);
const word = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
const long = (rom, a) => word(rom, a) | (rom.readByte(a + 2) << 16);
const fileOf = (ptr) => ((ptr >> 16) & 0x7f) * 0x8000 + ((ptr & 0xffff) - 0x8000);
/** bank $82 address <-> file offset */
const recordFile = (y) => 0x10000 + (y - 0x8000);
const listFile = (addr) => 0x40000 + (addr - 0x8000);
/** Tile (in the object's 2 rows) loaded by the third DMA of $83:D472 */
const EXTRA_TILE = 0x17;
/** Bank $82 entry used when a frame has no extra tile: a blank tile */
const EXTRA_DEFAULT = 0xab27;

/**
 * The extra tile of a frame (the game's $83:D472): the word after the two tile
 * pointers picks a 3-byte pointer in bank $82 to one 32-byte tile, loaded to
 * tile 7 of the second row. 0 = blank; positive = table + 3 x team ordinal
 * (per-team detail, e.g. hair); negative = table + per-player offset (the
 * title objects use player 0: offset 0 on the left, 0x2D on the right).
 */
function extraTile(rom, extra, side, ordinal) {
  let y = EXTRA_DEFAULT;
  if (extra && extra < 0x8000) y = (extra + 3 * ordinal) | 0x8000;
  else if (extra) y = ((side === 'right' ? 0x2d : 0) & 0xff) + extra;
  const at = recordFile(y & 0xffff);
  const ptr = long(rom, at);
  if (ptr >> 16 < 0x80 || (ptr & 0xffff) < 0x8000) return new Uint8Array(32);
  return rom.readBytes(fileOf(ptr) + 2, 32);
}

/**
 * Decode a frame record (null when it does not look like one).
 * @returns {{ sprites: {dx, dy, tile, big, palette, h, v}[], rows: [number, number][] } | null}
 *   rows: [file offset, byte count] of the two tile rows
 */
export function readFrame(rom, y) {
  const a = recordFile(y);
  // a record is 10 bytes: list word, two long pointers, extra word
  if (a < 0x10000 || a + 10 > 0x18000) return null;
  const list = word(rom, a);
  if (list < 0x8000) return null;
  const rows = [];
  for (const k of [2, 5]) {
    const ptr = long(rom, a + k);
    const bank = ptr >> 16;
    if (bank < 0x88 || bank > 0x9f || (ptr & 0xffff) < 0x8000) return null;
    const at = fileOf(ptr);
    const size = word(rom, at);
    if (size % 32 || size > 0x200 || (k === 2 && !size)) return null;
    rows.push([at + 2, size]);
  }
  const lf = listFile(list);
  const n = rom.readByte(lf);
  if (!n || n > 12) return null;
  const sprites = [];
  for (let i = 0; i < n; i++) {
    const dy = s8(rom.readByte(lf + 1 + i * 4));
    const dx = s8(rom.readByte(lf + 2 + i * 4));
    const tile = rom.readByte(lf + 3 + i * 4);
    const attr = rom.readByte(lf + 4 + i * 4);
    const big = (attr >> 4) & 1;
    // tiles must come from the two DMA'd rows (and from the part of them this frame loads:
    // the rest of the row keeps whatever an earlier frame left there)
    const lastTile = tile + (big ? 17 : 0);
    if (lastTile >= 32 || (tile & 15) + (big ? 1 : 0) >= 16) return null;
    // tile 7 of the second row is always loaded by the third DMA (see extraTile)
    const covered = big ? [tile, tile + 1, tile + 16, tile + 17] : [tile];
    if (covered.some((t) => t !== EXTRA_TILE && (t & 15) * 32 >= rows[t >> 4][1])) return null;
    if (dx < -48 || dx > 40 || dy < -72 || dy > 16) return null;
    sprites.push({
      dx,
      dy,
      tile,
      big,
      // attr bit 5 adds 4 to the OBJ palette; bit 3 (common) does not change it
      palette: attr & 0x20 ? 4 : 0,
      h: (attr >> 6) & 1,
      v: (attr >> 7) & 1,
    });
  }
  return { sprites, rows, extra: word(rom, a + 8) };
}

let framesCache = null;

/** Every frame record of the game (bank $82 addresses), in ROM order */
export function listPoseFrames(rom) {
  const key = rom.getRomData ? rom.getRomData() : rom;
  if (framesCache && framesCache.key === key) return framesCache.frames;
  const frames = [];
  const [from, to] = P.FRAMES;
  for (let a = from; a < to; a++) {
    const y = 0x8000 + (a - 0x10000);
    if (readFrame(rom, y)) frames.push(y);
  }
  framesCache = { key, frames };
  return frames;
}

/** @returns {{ left: number, right: number }} frame record of each player */
export function readPoses(rom) {
  return { left: word(rom, P.LEFT.pose), right: word(rom, P.RIGHT.pose) };
}

export function writePose(rom, side, y) {
  const s = sideOf(side);
  if (!readFrame(rom, y)) throw new Error('Not an animation frame');
  rom.writeByte(s.pose, y & 0xff);
  rom.writeByte(s.pose + 1, (y >> 8) & 0xff);
}

/**
 * OBJ sprites and tiles of a player in a frame, as the game draws it.
 * @returns {{ sprites: number[][], tiles: [number, Uint8Array][] } | null}
 *   sprites: [x, y, tile, big, palette, hFlip, vFlip] (drawing order, top last);
 *   tiles: [first OBJ tile, bytes] to put in VRAM
 * @param {number} [ordinal] - ROM ordinal of the player's team (picks the extra tile)
 */
export function playerSprites(rom, side, y, origin = null, ordinal = 0) {
  const s = sideOf(side);
  const frame = readFrame(rom, y);
  if (!frame) return null;
  const [ox, oy] = origin || [s.x, P.Y];
  const sprites = frame.sprites.map((sp) => {
    const size = sp.big ? 16 : 8;
    const x = s.flip ? ox - sp.dx - size : ox + sp.dx;
    return [
      x,
      oy + sp.dy,
      s.tile + sp.tile,
      sp.big,
      s.palette | sp.palette,
      sp.h ^ (s.flip ? 1 : 0),
      sp.v,
    ];
  });
  const tiles = frame.rows.map(([at, size], k) => [s.tile + k * 16, rom.readBytes(at, size)]);
  tiles.push([s.tile + EXTRA_TILE, extraTile(rom, frame.extra, side, ordinal)]);
  return { sprites: sprites.reverse(), tiles };
}
