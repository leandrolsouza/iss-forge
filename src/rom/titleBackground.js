/**
 * Title screen background (BG1): the brush stroke behind the logo (rows 0-13)
 * and the grass (rows 14-27). Each part can stay as in the ROM, be removed
 * (the sky shows) or be replaced by an image: the stroke area by an image with
 * one 15-colour palette (BG palette 7), the grass by an image or a repeated
 * texture with two palettes (BG palettes 2 and 3).
 *
 * See TITLE_SCREEN.BACKGROUND in constants.js and research/title-screen.md.
 */
import { TITLE_SCREEN } from './constants';
import { konamiDecompress, konamiCompress } from './KonamiCodec';
import { readScreenWords, packScreenWords, placeScreenBlock, screenLocation } from './menuScreens';
import { MENU_SCREENS } from './constants';
import { rgb5, toRaw, nearest, medianCut, twoPalettes } from './quantize';

const B = TITLE_SCREEN.BACKGROUND;
const COLS = 32;
const screenOf = (offset) => MENU_SCREENS.find((s) => s.offset === offset);
const dataOf = (rom) => (rom.getRomData ? rom.getRomData() : rom.data);
const originalOf = (rom) => rom.getOriginalData?.() || null;
const inRows = ([a, b], r) => r >= a && r < b;

// --- Read ---

export const readBackgroundMap = (rom) => readScreenWords(rom, B.MAP);

export function readBackgroundTiles(rom) {
  const at = screenLocation(rom, screenOf(B.TILES));
  return konamiDecompress(dataOf(rom), at + (rom.headerOffset || 0));
}

function originalMap(rom) {
  const orig = originalOf(rom);
  return orig
    ? readScreenWords(orig, B.MAP + (rom.headerOffset || 0), false)
    : readBackgroundMap(rom);
}

function originalTiles(rom) {
  const orig = originalOf(rom);
  return orig
    ? konamiDecompress(orig, B.TILES + (rom.headerOffset || 0))
    : readBackgroundTiles(rom);
}

/** Compressed bytes of a block as loaded */
function originalBlock(rom, offset) {
  const orig = originalOf(rom);
  if (!orig) return null;
  const h = rom.headerOffset || 0;
  const size = (orig[offset + h] | (orig[offset + h + 1] << 8)) & 0x7fff;
  return orig.slice(offset + h, offset + h + size);
}

/**
 * What each part shows now: 'original', 'none' (empty rows) or 'custom'.
 * @returns {{ top: string, grass: string }}
 */
export function backgroundState(rom) {
  const words = readBackgroundMap(rom);
  const orig = originalMap(rom);
  const tiles = readBackgroundTiles(rom);
  const base = originalTiles(rom);
  const strokeSame = base.every((b, i) => tiles[i] === b);
  const part = (rows, needsTiles) => {
    let same = true;
    let empty = true;
    for (let r = rows[0]; r < rows[1]; r++)
      for (let c = 0; c < COLS; c++) {
        const w = words[r * COLS + c];
        if (w !== orig[r * COLS + c]) same = false;
        if (w & 0x3ff) empty = false;
      }
    if (same && (!needsTiles || strokeSame)) return 'original';
    return empty ? 'none' : 'custom';
  };
  return { top: part(B.TOP_ROWS, true), grass: part(B.GRASS_ROWS, false) };
}

// --- Tiles ---

/** 4bpp bytes of an 8x8 tile given 64 colour indexes */
function encodeTile(px) {
  const t = new Uint8Array(32);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const c = px[y * 8 + x];
      const bit = 0x80 >> x;
      if (c & 1) t[y * 2] |= bit;
      if (c & 2) t[y * 2 + 1] |= bit;
      if (c & 4) t[16 + y * 2] |= bit;
      if (c & 8) t[16 + y * 2 + 1] |= bit;
    }
  return t;
}

/** 64 colour indexes of a 4bpp tile */
function decodeTile(t) {
  const px = new Array(64);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const s = 7 - x;
      px[y * 8 + x] =
        ((t[y * 2] >> s) & 1) |
        (((t[y * 2 + 1] >> s) & 1) << 1) |
        (((t[16 + y * 2] >> s) & 1) << 2) |
        (((t[16 + y * 2 + 1] >> s) & 1) << 3);
    }
  return px;
}

const flipPx = (px, h, v) => {
  const out = new Array(64);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) out[y * 8 + x] = px[(v ? 7 - y : y) * 8 + (h ? 7 - x : x)];
  return out;
};

/** Tile sheet with deduplication (flipped copies reuse a tile) and reserved numbers */
function tileSheet(first) {
  const tiles = new Map(); // index -> bytes
  const seen = new Map(); // key -> index
  let next = first;
  const reserved = (i) => i >= B.RESERVED_TILES[0] && i < B.RESERVED_TILES[1];
  return {
    tiles,
    /** @returns {number} map word bits (tile | flips) or -1 when full */
    add(px) {
      if (px.every((c) => !c)) return 0;
      for (const [h, v] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const hit = seen.get(flipPx(px, h, v).join(','));
        if (hit !== undefined) return hit | (h ? 0x4000 : 0) | (v ? 0x8000 : 0);
      }
      while (reserved(next)) next++;
      if (next > B.LAST_TILE) return -1;
      const index = next++;
      tiles.set(index, encodeTile(px));
      seen.set(px.join(','), index);
      return index;
    },
  };
}

/** Cells of an RGBA image: { cx, cy, pixels: [r,g,b][] (opaque), at(x, y) -> colour|null } */
function cellsOf(image, alphaThreshold = 128) {
  const { width: w, height: h, data } = image;
  const at = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
    const i = (y * w + x) * 4;
    return data[i + 3] >= alphaThreshold ? rgb5(data[i], data[i + 1], data[i + 2]) : null;
  };
  const cells = [];
  for (let cy = 0; cy < h; cy += 8)
    for (let cx = 0; cx < w; cx += 8) {
      const pixels = [];
      for (let y = cy; y < cy + 8; y++)
        for (let x = cx; x < cx + 8; x++) {
          const c = at(x, y);
          if (c) pixels.push(c);
        }
      cells.push({ cx, cy, pixels });
    }
  return { cells, at };
}

const cellIndexes = (at, cx, cy, pal) => {
  const px = new Array(64).fill(0);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const c = at(cx + x, cy + y);
      if (c) px[y * 8 + x] = nearest(pal, c).index + 1;
    }
  return px;
};

const padPalette = (pal) => {
  const raw = pal.map(toRaw);
  while (raw.length < 15) raw.push(0);
  return raw.slice(0, 15);
};

// --- Build ---

/**
 * Build a background.
 * @param {object} rom
 * @param {{ top: { mode: string, image?: object, colors?: number },
 *   grass: { mode: string, image?: object, repeat?: boolean, colors?: number } }} spec -
 *   mode 'original' | 'none' | 'current' (as it is now) | 'image'; images are RGBA
 *   { width, height, data }: the
 *   top one at most 256 x 112, the grass one 256 x 112 or (repeat) at most
 *   PATTERN_MAX x PATTERN_MAX, multiples of 8
 * @returns {{ ok: boolean, error?: string, words?: Uint16Array, tiles?: Uint8Array,
 *   colors?: object, tileCount?: number }}
 */
export function buildBackground(rom, { top, grass }) {
  const orig = originalMap(rom);
  const words = new Uint16Array(1024);
  const colors = {};
  const keepStroke = top.mode === 'original';
  const sheet = tileSheet(keepStroke ? 0x55 : 1);
  const base = keepStroke ? originalTiles(rom) : null;

  for (let r = 0; r < 32; r++) {
    const part = inRows(B.TOP_ROWS, r) ? top : inRows(B.GRASS_ROWS, r) ? grass : null;
    for (let c = 0; c < COLS; c++)
      words[r * COLS + c] = !part || part.mode === 'original' ? orig[r * COLS + c] : 0;
  }

  // parts kept as they are now: their tiles are copied into the new sheet
  if (top.mode === 'current' || grass.mode === 'current') {
    const cur = readBackgroundMap(rom);
    const curTiles = readBackgroundTiles(rom);
    const baseTiles = keepStroke ? originalTiles(rom) : null;
    for (let r = 0; r < 32; r++) {
      const part = inRows(B.TOP_ROWS, r) ? top : inRows(B.GRASS_ROWS, r) ? grass : null;
      if (part?.mode !== 'current') continue;
      for (let c = 0; c < COLS; c++) {
        const w = cur[r * COLS + c];
        const t = w & 0x3ff;
        if (!t || (t >= B.RESERVED_TILES[0] && t < B.RESERVED_TILES[1])) {
          words[r * COLS + c] = w;
          continue;
        }
        const bytes = curTiles.slice(t * 32, t * 32 + 32);
        if (baseTiles && t <= 0x54 && bytes.every((b, i) => b === baseTiles[t * 32 + i])) {
          words[r * COLS + c] = w; // an original stroke tile, kept at its number
          continue;
        }
        const res = sheet.add(decodeTile(bytes));
        if (res < 0) return { ok: false, error: 'bgTooManyTiles' };
        words[r * COLS + c] = (res & 0x3ff) | (w & 0x3c00) | ((w ^ res) & 0xc000);
      }
    }
  }

  if (top.mode === 'image') {
    const img = top.image;
    const [r0, r1] = B.TOP_ROWS;
    if (img.width > 256 || img.height > (r1 - r0) * 8) return { ok: false, error: 'bgSize' };
    const { cells, at } = cellsOf(img);
    const pal = medianCut(
      cells.flatMap((c) => c.pixels),
      Math.max(1, Math.min(15, top.colors ?? 15)),
    );
    if (!pal.length) return { ok: false, error: 'bgEmpty' };
    // centred, on the 8-pixel grid
    const col0 = Math.max(
      0,
      Math.min(32 - Math.ceil(img.width / 8), Math.round((B.TOP_CENTER[0] - img.width / 2) / 8)),
    );
    const row0 = Math.max(
      r0,
      Math.min(r1 - Math.ceil(img.height / 8), Math.round((B.TOP_CENTER[1] - img.height / 2) / 8)),
    );
    for (const cell of cells) {
      if (!cell.pixels.length) continue;
      const w = sheet.add(cellIndexes(at, cell.cx, cell.cy, pal));
      if (w < 0) return { ok: false, error: 'bgTooManyTiles' };
      const r = row0 + cell.cy / 8;
      const c = col0 + cell.cx / 8;
      if (r < r1 && c < COLS) words[r * COLS + c] = w | (B.TOP_PALETTE << 10);
    }
    colors.stroke = padPalette(pal);
  }

  if (grass.mode === 'image') {
    const img = grass.image;
    const [r0, r1] = B.GRASS_ROWS;
    const maxW = grass.repeat ? B.PATTERN_MAX : 256;
    const maxH = grass.repeat ? B.PATTERN_MAX : (r1 - r0) * 8;
    if (img.width > maxW || img.height > maxH || img.width % 8 || img.height % 8) {
      return { ok: false, error: 'bgSize' };
    }
    const { cells, at } = cellsOf(img);
    const used = cells.filter((c) => c.pixels.length);
    if (!used.length) return { ok: false, error: 'bgEmpty' };
    const { pals, assign } = twoPalettes(used, Math.max(1, Math.min(15, grass.colors ?? 15)));
    const cellWord = new Map();
    for (let i = 0; i < used.length; i++) {
      const cell = used[i];
      const w = sheet.add(cellIndexes(at, cell.cx, cell.cy, pals[assign[i]]));
      if (w < 0) return { ok: false, error: 'bgTooManyTiles' };
      cellWord.set(`${cell.cx},${cell.cy}`, w | (B.GRASS_PALETTES[assign[i]] << 10));
    }
    const pw = img.width / 8;
    const ph = img.height / 8;
    for (let r = r0; r < r1; r++)
      for (let c = 0; c < COLS; c++) {
        const cx = grass.repeat ? c % pw : c;
        const cy = grass.repeat ? (r - r0) % ph : r - r0;
        if (cx >= pw || cy >= ph) continue;
        words[r * COLS + c] = cellWord.get(`${cx * 8},${cy * 8}`) ?? 0;
      }
    colors.grass = [...padPalette(pals[0]), ...padPalette(pals[1])];
  }

  // tile block: the stroke tiles (when kept) + the new ones
  const last = Math.max(keepStroke ? 0x54 : 0, ...sheet.tiles.keys());
  const tiles = new Uint8Array((last + 1) * 32);
  if (base) tiles.set(base.slice(0, Math.min(base.length, tiles.length)));
  for (const [i, bytes] of sheet.tiles) tiles.set(bytes, i * 32);
  return { ok: true, words, tiles, colors, tileCount: last + 1 };
}

// --- Write ---

/**
 * Write the map and the tiles of a built background (in their slots or moved
 * to free space). The caller writes the colours. All or nothing.
 * @returns {{ ok: boolean, error?: string, size?: number, capacity?: number }}
 */
export function writeBackground(rom, built) {
  const data = dataOf(rom);
  const backup = data.slice();
  const origMap = originalMap(rom);
  const origTiles = originalTiles(rom);
  const sameMap = built.words.every((w, i) => w === origMap[i]);
  const sameTiles =
    built.tiles.length === origTiles.length && built.tiles.every((b, i) => b === origTiles[i]);
  const tileBytes = (sameTiles && originalBlock(rom, B.TILES)) || konamiCompress(built.tiles);
  const mapBytes = (sameMap && originalBlock(rom, B.MAP)) || packScreenWords(built.words);
  const t = placeScreenBlock(rom, B.TILES, tileBytes);
  if (!t.ok) {
    data.set(backup);
    return { ...t, error: 'bgNoSpace' };
  }
  const m = placeScreenBlock(rom, B.MAP, mapBytes);
  if (!m.ok) {
    data.set(backup);
    return { ...m, error: 'bgNoSpace' };
  }
  return { ok: true, size: tileBytes.length + mapBytes.length };
}

/**
 * buildBackground + a test write on a copy, lowering the colours of the image
 * parts (15 down to 2) until everything fits.
 * @returns built background plus { colors: number } or { ok: false, error }
 */
export function buildBackgroundFitting(rom, spec, makeCopy) {
  const images = ['top', 'grass'].filter((k) => spec[k].mode === 'image');
  let last = null;
  for (let n = 15; n >= 2; n--) {
    const s = { ...spec };
    images.forEach((k) => (s[k] = { ...spec[k], colors: Math.min(n, spec[k].colors ?? 15) }));
    const built = buildBackground(rom, s);
    if (!built.ok) return built;
    const res = writeBackground(makeCopy(), built);
    last = { ...built, colorCount: n, size: res.size, capacity: res.capacity };
    if (res.ok) return last;
    if (!images.length) break;
  }
  return { ...last, ok: false, error: 'bgNoSpace' };
}
