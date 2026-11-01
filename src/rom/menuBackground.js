/**
 * Menu background: the BG2 pattern behind every menu screen (blue "SUPER STAR
 * SOCCER" in the original). It can stay as in the ROM or be replaced by a repeated
 * texture or by a 256 x 256 image (the layer scrolls up and wraps every 256 lines),
 * with one 15-colour palette (BG palette 2, shared by all the menus).
 *
 * The tiles and the map are MENU_SCREENS blocks, so they are placed like the menu
 * screens (in their slot, in free space or after re-arranging the movable blocks).
 * See MENU_BACKGROUND in constants.js and research/screen-viewer.md.
 */
import { MENU_BACKGROUND, MENU_SCREENS } from './constants';
import { konamiDecompress, konamiCompress } from './KonamiCodec';
import {
  readScreenWords,
  packScreenWords,
  placeScreenBlock,
  screenLocation,
  releaseBlockArea,
} from './menuScreens';
import { decompressedSize } from './screenView';
import { medianCut } from './quantize';
import { decodeTile, tileSheet, imageCells, cellIndexes, padPalette } from './bgTiles';
import { readMatchPalette, writeMatchPalette } from './palettes';

const M = MENU_BACKGROUND;
const COLS = 32;
const ROWS = 32;
const SIZE = 256;
const PALETTE_BITS = M.PALETTE << 10;
const PALETTE_ID = 'menuBackground';
const screenOf = (offset) => MENU_SCREENS.find((s) => s.offset === offset);
const dataOf = (rom) => (rom.getRomData ? rom.getRomData() : rom.data);
const originalOf = (rom) => rom.getOriginalData?.() || null;
const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// --- Read ---

/** 1024 words of the map (32 x 32, every word with BG palette 2) */
export const readMenuBackgroundMap = (rom) => readScreenWords(rom, M.MAP);

/** Decompressed bytes of a block at a file offset (without the copier header) */
function blockAt(data, offset, h) {
  return konamiDecompress(data, offset + h).slice(0, decompressedSize(data, offset + h));
}

/** 4bpp tiles of the block (tile 0 = tile 0x100 of the BG) */
export function readMenuBackgroundTiles(rom) {
  return blockAt(dataOf(rom), screenLocation(rom, screenOf(M.TILES)), rom.headerOffset || 0);
}

function originalMap(rom) {
  const orig = originalOf(rom);
  return orig ? readScreenWords(orig, M.MAP + (rom.headerOffset || 0), false) : null;
}

function originalTiles(rom) {
  const orig = originalOf(rom);
  return orig ? blockAt(orig, M.TILES, rom.headerOffset || 0) : null;
}

/** Compressed bytes of an original block */
function originalBlock(rom, offset) {
  const orig = originalOf(rom);
  if (!orig) return null;
  const h = rom.headerOffset || 0;
  const size = (orig[offset + h] | (orig[offset + h + 1] << 8)) & 0x7fff;
  return orig.slice(offset + h, offset + h + size);
}

const blockSize = (rom, at) => (rom.readByte(at) | (rom.readByte(at + 1) << 8)) & 0x7fff;

/**
 * @returns {{ state: 'original'|'custom', tileCount: number, size: number, moved: boolean }}
 *   tileCount: tiles of the block (the first is blank); size: compressed bytes of tiles + map
 */
export function readMenuBackground(rom) {
  const tiles = readMenuBackgroundTiles(rom);
  const words = readMenuBackgroundMap(rom);
  const origTiles = originalTiles(rom);
  const origMap = originalMap(rom);
  const original =
    !origTiles || (sameBytes(tiles, origTiles) && words.every((w, i) => w === origMap[i]));
  const tilesAt = screenLocation(rom, screenOf(M.TILES));
  const mapAt = screenLocation(rom, screenOf(M.MAP));
  return {
    state: original ? 'original' : 'custom',
    tileCount: tiles.length / 32,
    size: blockSize(rom, tilesAt) + blockSize(rom, mapAt),
    moved: tilesAt !== M.TILES || mapAt !== M.MAP,
  };
}

// --- Build ---

/**
 * Build a background.
 * @param {object} rom
 * @param {{ mode: 'original'|'texture'|'image', image?: { width: number, height: number,
 *   data: Uint8ClampedArray }, colors?: number }} spec - texture: a square image of one of
 *   TEXTURE_SIZES, repeated over the screen; image: 256 x 256. Transparent pixels show the
 *   backdrop colour of each screen. colors: at most this many colours (2-15).
 * @returns {{ ok: boolean, error?: string, mode?: string, words?: Uint16Array,
 *   tiles?: Uint8Array, colors?: number[]|null, tileCount?: number, colorCount?: number }}
 *   colors: the 15 colours of an image (null for the original)
 */
export function buildMenuBackground(rom, { mode, image, colors = 15 }) {
  if (mode === 'original') {
    const words = originalMap(rom);
    const tiles = originalTiles(rom);
    if (!words || !tiles) return { ok: false, error: 'mbgErrNoOriginal' };
    return { ok: true, mode, words, tiles, colors: null, tileCount: tiles.length / 32 };
  }
  if (mode !== 'texture' && mode !== 'image') return { ok: false, error: 'mbgErrMode' };
  const { width: w, height: h } = image || {};
  const fits = mode === 'image' ? w === SIZE && h === SIZE : w === h && M.TEXTURE_SIZES.includes(w);
  if (!fits) return { ok: false, error: 'mbgErrSize' };

  const { cells, at } = imageCells(image);
  const used = cells.filter((c) => c.pixels.length);
  if (!used.length) return { ok: false, error: 'mbgErrEmpty' };
  const n = Math.max(2, Math.min(15, colors));
  const pixels = used.flatMap((c) => c.pixels);
  // flat artwork keeps its exact colours; otherwise median cut
  const distinct = [...new Map(pixels.map((p) => [p.join(','), p])).values()];
  const pal =
    distinct.length <= n
      ? distinct.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))
      : medianCut(pixels, n);
  const sheet = tileSheet({ first: 1, last: M.MAX_TILES });
  const cellWord = new Map();
  for (const cell of cells) {
    const res = cell.pixels.length ? sheet.add(cellIndexes(at, cell.cx, cell.cy, pal)) : 0;
    if (res < 0) return { ok: false, error: 'mbgErrTooManyTiles', colorCount: n };
    // tile number on the BG + flips (bits 14-15 of the sheet word) + palette
    cellWord.set(`${cell.cx},${cell.cy}`, (M.FIRST_TILE + (res & 0x3ff)) | (res & 0xc000));
  }
  const pw = w / 8;
  const ph = h / 8;
  const words = new Uint16Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      words[r * COLS + c] = cellWord.get(`${(c % pw) * 8},${(r % ph) * 8}`) | PALETTE_BITS;
    }
  const last = Math.max(0, ...sheet.tiles.keys());
  const tiles = new Uint8Array((last + 1) * 32); // tile 0 stays blank
  for (const [i, bytes] of sheet.tiles) tiles.set(bytes, i * 32);
  return {
    ok: true,
    mode,
    words,
    tiles,
    colors: padPalette(pal),
    tileCount: last + 1,
    colorCount: pal.length,
  };
}

// --- Write ---

/**
 * Write the tiles and the map of a built background (in their slots or moved to
 * free space). Going back to the original puts back the exact original bytes
 * (including the second map copy and its pointers). All or nothing.
 * @returns {{ ok: boolean, error?: string, size?: number, capacity?: number }}
 */
export function writeMenuBackground(rom, built) {
  const data = dataOf(rom);
  const backup = data.slice();
  const fail = (res) => {
    data.set(backup);
    return { ...res, ok: false, error: 'mbgErrNoSpace' };
  };
  const origTiles = originalTiles(rom);
  const origMap = originalMap(rom);
  const sameTiles = !!origTiles && sameBytes(built.tiles, origTiles);
  const sameMap = !!origMap && built.words.every((w, i) => w === origMap[i]);
  const tileBytes = (sameTiles && originalBlock(rom, M.TILES)) || konamiCompress(built.tiles);
  const mapBytes = (sameMap && originalBlock(rom, M.MAP)) || packScreenWords(built.words);
  const where = (offset) => {
    const at = screenLocation(rom, screenOf(offset));
    return [at, at + blockSize(rom, at)];
  };
  const before = [where(M.TILES), where(M.MAP)];
  const t = placeScreenBlock(rom, M.TILES, tileBytes);
  if (!t.ok) return fail(t);
  const m = placeScreenBlock(rom, M.MAP, mapBytes);
  if (!m.ok) return fail(m);
  const orig = originalOf(rom);
  const h = rom.headerOffset || 0;
  if (sameMap && orig && screenLocation(rom, screenOf(M.MAP)) === M.MAP) {
    // the original slot again: the map, its second copy and the pointers that load it
    rom.writeBytes(M.MAP, orig.slice(M.MAP + h, M.MAP + h + screenOf(M.MAP).room));
    M.MAP_COPY_POINTERS.forEach((p) => rom.writeBytes(p, orig.slice(p + h, p + h + 3)));
  }
  // where the blocks were before (free space, slots of moved screens) goes back to the ROM as loaded
  before.forEach(([s, e]) => releaseBlockArea(rom, s, e));
  return { ok: true, size: tileBytes.length + mapBytes.length };
}

/**
 * Put a built background in the ROM with its colours. Going back to the original
 * pattern from a custom one also brings back the original colours.
 */
export function importMenuBackground(rom, built) {
  const before = readMenuBackground(rom).state;
  const res = writeMenuBackground(rom, built);
  if (!res.ok) return res;
  if (built.colors) writeMatchPalette(rom, PALETTE_ID, built.colors);
  else if (built.mode === 'original' && before === 'custom') {
    const orig = originalOf(rom);
    if (orig) {
      const h = rom.headerOffset || 0;
      rom.writeBytes(M.COLORS, orig.slice(M.COLORS + h, M.COLORS + h + 30));
    }
  }
  return res;
}

/**
 * buildMenuBackground + a test write on a copy, lowering the colours (15 down to 2)
 * until the tiles fit in VRAM and the blocks fit in the ROM.
 * @param {() => object} makeCopy - a fresh copy of the ROM for each try
 * @returns built background plus { colorCount, size } or { ok: false, error }
 */
export function buildMenuBackgroundFitting(rom, spec, makeCopy) {
  let last = null;
  const max = Math.max(2, Math.min(15, spec.colors ?? 15));
  for (let n = max; n >= 2; n--) {
    const built = buildMenuBackground(rom, { ...spec, colors: n });
    if (!built.ok && built.error !== 'mbgErrTooManyTiles') return built;
    if (!built.ok) {
      last = built;
    } else {
      const res = writeMenuBackground(makeCopy(), built);
      last = { ...built, colorCount: n, size: res.size ?? built.size };
      if (res.ok) return last;
      last = { ...last, ok: false, error: 'mbgErrNoSpace' };
    }
    if (spec.mode === 'original') break;
  }
  return last;
}

/** 64 colour indexes of tile `n` of the block (for tests and previews) */
export const menuBackgroundTilePixels = (tiles, n) =>
  decodeTile(tiles.subarray(n * 32, n * 32 + 32));

/** Current colours (15, BG palette 2) */
export const readMenuBackgroundColors = (rom) => readMatchPalette(rom, PALETTE_ID);

// --- Scroll (code patch of $85:A2C3, see MENU_BACKGROUND.SCROLL) ---

const S = M.SCROLL;
const word = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
const bytesAt = (rom, a, n) => Array.from({ length: n }, (_, i) => rom.readByte(a + i));
const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Whether the scroll routine is the one the editor knows (a hack may have changed it) */
function scrollRoutineKnown(rom) {
  return S.PATTERN.every((b, i) => b === null || rom.readByte(S.ROUTINE[0] + i) === b);
}

/**
 * How the menu background moves.
 * @returns {'fixed'|'slow'|'normal'|'fast'|'custom'|null} null: unknown code (not editable)
 */
export function readMenuScroll(rom) {
  if (!scrollRoutineKnown(rom)) return null;
  const frac = bytesAt(rom, S.LOAD_FRAC, 3);
  const pixels = bytesAt(rom, S.LOAD_PIXELS, 3);
  const step = [word(rom, S.FRAC), word(rom, S.PIXELS)];
  if (sameList(frac, S.LOAD_ZERO) && sameList(pixels, S.LOAD_ZERO)) {
    return step[0] === 0 && step[1] === 0 ? 'fixed' : 'custom';
  }
  if (!sameList(frac, S.LOAD_CURRENT.frac) || !sameList(pixels, S.LOAD_CURRENT.pixels)) {
    return 'custom';
  }
  const hit = Object.entries(S.SPEEDS).find(([, s]) => sameList(s, step));
  return hit ? hit[0] : 'custom';
}

/**
 * Make the background fixed or scroll at one of SCROLL.SPEEDS.
 * @param {'fixed'|'slow'|'normal'|'fast'} speed
 * @returns {{ ok: boolean, error?: string }}
 */
export function writeMenuScroll(rom, speed) {
  if (!scrollRoutineKnown(rom)) return { ok: false, error: 'mbgErrScrollCode' };
  if (speed !== 'fixed' && !S.SPEEDS[speed]) return { ok: false, error: 'mbgErrScrollSpeed' };
  const fixed = speed === 'fixed';
  const [frac, pixels] = fixed ? [0, 0] : S.SPEEDS[speed];
  rom.writeBytes(S.LOAD_FRAC, fixed ? S.LOAD_ZERO : S.LOAD_CURRENT.frac);
  rom.writeBytes(S.LOAD_PIXELS, fixed ? S.LOAD_ZERO : S.LOAD_CURRENT.pixels);
  rom.writeBytes(S.FRAC, [frac & 0xff, frac >> 8]);
  rom.writeBytes(S.PIXELS, [pixels & 0xff, pixels >> 8]);
  return { ok: true };
}

/** Raw bytes of the scroll routine (undo) */
export const readMenuScrollBytes = (rom) => bytesAt(rom, S.ROUTINE[0], S.ROUTINE[1] - S.ROUTINE[0]);

export function restoreMenuScrollBytes(rom, snapshot) {
  if (Array.isArray(snapshot)) rom.writeBytes(S.ROUTINE[0], snapshot);
}
