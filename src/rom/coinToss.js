/**
 * Coin toss sprite: the two faces of the coin shown before kick-off (choice boxes
 * and the coin on the referee's hand). Each face is a 32 x 24 grid of colour
 * indexes (0 = transparent, 1-15 = the 'coinToss' palette); only the 8x8 cells
 * the sprite lists draw are kept, and the rim cell is the same tile on both faces.
 *
 * The tiles are rewritten in the compressed block, in its original slot; the
 * sprite lists and the rest of the block (ball and pitch-side icons, 1P/2P marks,
 * tiny spinning coin) are left as they are. See COIN_TOSS in constants.js.
 */
import { COIN_TOSS } from './constants';
import { konamiDecompress, konamiCompress } from './KonamiCodec';
import { decodeTile, encodeTile, padPalette } from './bgTiles';
import { medianCut, nearest, rgb5 } from './quantize';
import { createImage, fillImage, setPixel } from './snesRender';

const C = COIN_TOSS;
const BLOCK_BYTES = C.TILE_COUNT * 32;
export const COIN_FACES = ['heads', 'tails'];
/** Size of an image imported as a face: the coin itself (the rim is column 24) */
export const COIN_IMAGE = { width: 25, height: 24 };

const dataOf = (rom) => (rom.getRomData ? rom.getRomData() : rom.data);
const s8 = (b) => (b > 127 ? b - 256 : b);
const cellKey = (cx, cy) => `${cx},${cy}`;
const CELLS = new Set(C.FACES.heads.map(([cx, cy]) => cellKey(cx, cy)));
const [SHARED_CX, SHARED_CY] = C.SHARED_CELL;

/** Whether pixel (x, y) of a face is drawn by the game */
export const coinDrawable = (x, y) => CELLS.has(cellKey(x >> 3, y >> 3));
/** Whether pixel (x, y) belongs to the cell both faces draw */
export const coinShared = (x, y) => x >> 3 === SHARED_CX && y >> 3 === SHARED_CY;

// --- Layout checks ---

/**
 * Cells drawn by a sprite list [count][dy, dx, tile, attr] (attr bit 4 = 16x16,
 * bit 0 = tile bit 8), relative to its top-left piece: [column, row, tile] sorted,
 * or null when a piece is off the 8-pixel grid or two pieces draw a cell differently.
 */
function listCells(byteAt, at) {
  const n = byteAt(at);
  if (!n || n > 16) return null;
  const pieces = [];
  for (let i = 0; i < n; i++) {
    const p = at + 1 + i * 4;
    const attr = byteAt(p + 3);
    pieces.push({
      dy: s8(byteAt(p)),
      dx: s8(byteAt(p + 1)),
      tile: byteAt(p + 2) | ((attr & 1) << 8),
      span: attr & 0x10 ? 2 : 1,
    });
  }
  const x0 = Math.min(...pieces.map((p) => p.dx));
  const y0 = Math.min(...pieces.map((p) => p.dy));
  const cells = new Map();
  for (const { dx, dy, tile, span } of pieces) {
    if ((dx - x0) % 8 || (dy - y0) % 8) return null;
    for (let ty = 0; ty < span; ty++)
      for (let tx = 0; tx < span; tx++) {
        const cx = (dx - x0) / 8 + tx;
        const cy = (dy - y0) / 8 + ty;
        const t = tile + tx + ty * 16;
        const key = cellKey(cx, cy);
        if (cells.has(key) && cells.get(key)[2] !== t) return null;
        cells.set(key, [cx, cy, t]);
      }
  }
  return [...cells.values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

const sortedCells = (cells) => [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Decompressed tiles of the block, or null when the ROM does not have the layout
 * the editor knows (load-list pointer, sprite lists, block size).
 * @param {Uint8Array} data - whole file
 * @param {number} h - copier header size
 */
function readBlock(data, h) {
  if (!data || data.length < 0x100000 + h) return null;
  const byteAt = (a) => data[a + h];
  const p = C.POINTER;
  const target =
    (byteAt(p + 2) & 0x7f) * 0x8000 + (((byteAt(p) | (byteAt(p + 1) << 8)) & 0xffff) - 0x8000);
  if (target !== C.TILES || byteAt(p + 2) < 0x80) return null;
  for (const face of COIN_FACES) {
    if (!sameList(listCells(byteAt, C.FACE_LISTS[face]), sortedCells(C.FACES[face]))) return null;
  }
  const size = (byteAt(C.TILES) | (byteAt(C.TILES + 1) << 8)) & 0x7fff;
  if (size < 3 || size > C.CAPACITY) return null;
  const tiles = konamiDecompress(data, C.TILES + h);
  return tiles.length >= BLOCK_BYTES ? tiles : null;
}

// --- Faces <-> tiles ---

const blankFace = () => Array.from({ length: C.HEIGHT }, () => new Array(C.WIDTH).fill(0));

function decodeFaces(tiles) {
  const faces = {};
  for (const face of COIN_FACES) {
    const grid = blankFace();
    for (const [cx, cy, t] of C.FACES[face]) {
      const px = decodeTile(tiles.subarray(t * 32, t * 32 + 32));
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) grid[cy * 8 + y][cx * 8 + x] = px[y * 8 + x];
    }
    faces[face] = grid;
  }
  return faces;
}

function encodeFaces(tiles, faces) {
  const out = tiles.slice();
  for (const face of COIN_FACES)
    for (const [cx, cy, t] of C.FACES[face]) {
      const px = [];
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) px.push(faces[face][cy * 8 + y][cx * 8 + x]);
      out.set(encodeTile(px), t * 32);
    }
  return out;
}

const validGrid = (g) =>
  Array.isArray(g) &&
  g.length === C.HEIGHT &&
  g.every(
    (row) =>
      Array.isArray(row) &&
      row.length === C.WIDTH &&
      row.every((c) => Number.isInteger(c) && c >= 0 && c <= 15),
  );

function sharedEqual(faces) {
  for (let y = SHARED_CY * 8; y < SHARED_CY * 8 + 8; y++)
    for (let x = SHARED_CX * 8; x < SHARED_CX * 8 + 8; x++)
      if (faces.heads[y][x] !== faces.tails[y][x]) return false;
  return true;
}

/** Same drawn pixels on both faces (pixels outside the cells are ignored) */
export function sameCoinFaces(a, b) {
  if (!a || !b || !COIN_FACES.every((f) => validGrid(a[f]) && validGrid(b[f]))) return false;
  return COIN_FACES.every((face) =>
    a[face].every((row, y) => row.every((c, x) => !coinDrawable(x, y) || c === b[face][y][x])),
  );
}

// --- Read / write ---

function originalBlock(rom) {
  const orig = rom.getOriginalData?.();
  return orig ? readBlock(orig, rom.headerOffset || 0) : null;
}

/**
 * @returns {{ faces: { heads: number[][], tails: number[][] }, state: 'original'|'custom',
 *   size: number, capacity: number } | null} null: the ROM does not have the known layout
 *   (size: compressed bytes of the block now)
 */
export function readCoinToss(rom) {
  const h = rom.headerOffset || 0;
  const tiles = readBlock(dataOf(rom), h);
  if (!tiles) return null;
  const faces = decodeFaces(tiles);
  const orig = originalBlock(rom);
  return {
    faces,
    state: !orig || sameCoinFaces(faces, decodeFaces(orig)) ? 'original' : 'custom',
    size: (rom.readByte(C.TILES) | (rom.readByte(C.TILES + 1) << 8)) & 0x7fff,
    capacity: C.CAPACITY,
  };
}

/**
 * Write both faces into the block (recompressed in its slot). When the whole block
 * is back to the original drawing, the exact original bytes are written. Nothing is
 * written when it fails.
 * @param {{ heads: number[][], tails: number[][] }} faces - the cell both faces draw
 *   must be equal (see syncCoinShared)
 * @returns {{ ok: boolean, error?: string, size?: number, capacity: number }}
 */
export function writeCoinToss(rom, faces) {
  const capacity = C.CAPACITY;
  const h = rom.headerOffset || 0;
  const tiles = readBlock(dataOf(rom), h);
  if (!tiles) return { ok: false, error: 'coinErrLayout', capacity };
  if (!faces || !COIN_FACES.every((f) => validGrid(faces[f]))) {
    return { ok: false, error: 'coinErrFaces', capacity };
  }
  if (!sharedEqual(faces)) return { ok: false, error: 'coinErrShared', capacity };
  const next = encodeFaces(tiles, faces);
  const orig = originalBlock(rom);
  if (orig && orig.length === next.length && orig.every((b, i) => b === next[i])) {
    const bytes = rom.getOriginalData().slice(C.TILES + h, C.TILES + h + capacity);
    rom.writeBytes(C.TILES, bytes);
    return { ok: true, size: (bytes[0] | (bytes[1] << 8)) & 0x7fff, capacity };
  }
  const packed = konamiCompress(next);
  if (packed.length > capacity) {
    return { ok: false, error: 'coinErrNoSpace', size: packed.length, capacity };
  }
  const room = new Uint8Array(capacity).fill(0xff);
  room.set(packed);
  rom.writeBytes(C.TILES, room);
  return { ok: true, size: packed.length, capacity };
}

/** Raw bytes of the block slot (undo) */
export const readCoinTossBytes = (rom) => Array.from(rom.readBytes(C.TILES, C.CAPACITY));

export function restoreCoinTossBytes(rom, snapshot) {
  if (Array.isArray(snapshot) && snapshot.length === C.CAPACITY) rom.writeBytes(C.TILES, snapshot);
}

// --- Editing helpers ---

/** Faces with the shared cell of `from` copied to the other face */
export function syncCoinShared(faces, from = 'heads') {
  const to = from === 'heads' ? 'tails' : 'heads';
  const grid = faces[to].map((row, y) =>
    row.map((c, x) => (coinShared(x, y) ? faces[from][y][x] : c)),
  );
  return { ...faces, [to]: grid };
}

/**
 * Paint pixels of one face. Pixels outside the cells are skipped; a pixel of the
 * shared cell is painted on both faces.
 * @param {{ x: number, y: number }[]} points
 * @returns the same object when nothing changes
 */
export function paintCoinFace(faces, face, points, color) {
  const hit = points.filter(
    ({ x, y }) =>
      coinDrawable(x, y) && faces[face][y]?.[x] !== undefined && faces[face][y][x] !== color,
  );
  if (!hit.length) return faces;
  const grid = faces[face].map((row) => [...row]);
  hit.forEach(({ x, y }) => (grid[y][x] = color));
  return syncCoinShared({ ...faces, [face]: grid }, face);
}

const rawToRgb5 = (raw) => [raw & 31, (raw >> 5) & 31, (raw >> 10) & 31];

/**
 * A face from an RGBA image of COIN_IMAGE size (transparent pixels = transparent).
 * With `newColors` the 15 colours are recomputed from the image and the other face,
 * and the other face is remapped to them; otherwise the image uses the current colours.
 * The imported face also sets the shared rim cell of the other face.
 * @param {{ image: { width: number, height: number, data: Uint8ClampedArray }, face: string,
 *   faces: object, colors: number[], newColors?: boolean, maxColors?: number }} spec
 * @returns {{ ok: boolean, error?: string, faces?: object, colors?: number[], colorCount?: number }}
 */
export function buildCoinFace({ image, face, faces, colors, newColors = false, maxColors = 15 }) {
  if (!COIN_FACES.includes(face)) return { ok: false, error: 'coinErrFaces' };
  if (!image || image.width !== COIN_IMAGE.width || image.height !== COIN_IMAGE.height) {
    return { ok: false, error: 'coinErrImageSize' };
  }
  const other = face === 'heads' ? 'tails' : 'heads';
  const pixels = [];
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      if (image.data[i + 3] < 128 || !coinDrawable(x, y)) continue;
      pixels.push({ x, y, c: rgb5(image.data[i], image.data[i + 1], image.data[i + 2]) });
    }
  if (!pixels.length) return { ok: false, error: 'coinErrEmpty' };

  let pal = colors.map(rawToRgb5);
  let otherGrid = faces[other];
  if (newColors) {
    const n = Math.max(2, Math.min(15, maxColors));
    const otherPixels = [];
    otherGrid.forEach((row, y) =>
      row.forEach((c, x) => {
        // the other face loses its shared cell to the import: leave it out
        if (c && coinDrawable(x, y) && !coinShared(x, y)) otherPixels.push(pal[c - 1]);
      }),
    );
    const all = [...pixels.map((p) => p.c), ...otherPixels];
    const distinct = [...new Map(all.map((c) => [c.join(','), c])).values()];
    const next =
      distinct.length <= n
        ? distinct.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))
        : medianCut(all, n);
    const old = pal;
    otherGrid = otherGrid.map((row) =>
      row.map((c) => (c ? nearest(next, old[c - 1]).index + 1 : 0)),
    );
    pal = next;
  }
  const grid = blankFace();
  pixels.forEach(({ x, y, c }) => (grid[y][x] = nearest(pal, c).index + 1));
  const built = syncCoinShared({ ...faces, [face]: grid, [other]: otherGrid }, face);
  return {
    ok: true,
    faces: built,
    colors: newColors ? padPalette(pal) : [...colors],
    colorCount: newColors ? pal.length : colors.length,
  };
}

/**
 * Image of a face (32 x 24) with the 15 colours; `backdrop` (raw colour) fills the
 * transparent pixels when given.
 */
export function renderCoinFace(grid, colors, { backdrop = null } = {}) {
  const img = createImage(C.WIDTH, C.HEIGHT);
  if (backdrop !== null) fillImage(img, backdrop);
  grid.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c && coinDrawable(x, y)) setPixel(img, x, y, colors[c - 1] ?? 0);
    }),
  );
  return img;
}
