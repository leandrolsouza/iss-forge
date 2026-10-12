/**
 * Title screen logo: read the sprite list / tiles and import a new logo from
 * an image (two 15-colour palettes, OBJ rows 10 and 11).
 *
 * The logo is ~100 OBJ sprites (8x8 and 16x16) drawn by an object at ORIGIN.
 * An imported logo is cut into a grid of 16x16 blocks: a block with 3 or 4
 * non-empty 8x8 cells becomes one 16x16 sprite, otherwise one 8x8 sprite per
 * cell (fewer sprites when needed). Each block uses one of the two palettes.
 *
 * See TITLE_SCREEN.LOGO in constants.js and research/title-screen.md.
 */
import { TITLE_SCREEN } from './constants';
import { konamiDecompress, konamiCompress } from './KonamiCodec';

const L = TITLE_SCREEN.LOGO;
const s8 = (b) => (b > 127 ? b - 256 : b);
const readWord = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
const dataOf = (rom) => (rom.getRomData ? rom.getRomData() : rom.data);
const decompress = (rom, at) => konamiDecompress(dataOf(rom), at + (rom.headerOffset || 0));

/** File offset of a LoROM 24-bit pointer */
const pointerAt = (rom, p) => (rom.readByte(p + 2) & 0x7f) * 0x8000 + (readWord(rom, p) - 0x8000);
function writePointer(rom, p, fileOffset) {
  const addr = (fileOffset & 0x7fff) | 0x8000;
  rom.writeByte(p, addr & 0xff);
  rom.writeByte(p + 1, addr >> 8);
  rom.writeByte(p + 2, (fileOffset >> 15) | 0x80);
}

// --- Read ---

/** VRAM word address where the logo tiles are loaded */
export const logoTileDest = (rom) => readWord(rom, L.TILE_DEST_ENTRY);

/**
 * Sprites of the logo as drawn: [x, y, tile, big, palette, hFlip, vFlip], in
 * drawing order (the first sprite of the list is drawn last, on top).
 */
export function readLogoSprites(rom) {
  const list = decompress(rom, pointerAt(rom, L.LIST_POINTER));
  const n = list[1] | (list[2] << 8);
  if (!n || list.length < 4 + n * 4) return [];
  const [ox, oy] = L.ORIGIN;
  const out = [];
  for (let i = 0; i < n; i++) {
    const attr = list[4 + 3 * n + i];
    out.push([
      ox + s8(list[4 + i]),
      oy + s8(list[4 + n + i]),
      list[4 + 2 * n + i] | ((attr & 1) << 8),
      (attr >> 4) & 1,
      ((attr >> 1) & 7) | 2,
      (attr >> 6) & 1,
      (attr >> 7) & 1,
    ]);
  }
  return out.reverse();
}

/** Is the logo the one of the ROM as loaded (blocks, pointers and VRAM address)? */
export function isOriginalLogo(rom) {
  const orig = rom.getOriginalData?.();
  if (!orig) return true;
  const h = rom.headerOffset || 0;
  const same = (a, b) => {
    for (let i = a; i < b; i++) if (rom.readByte(i) !== orig[i + h]) return false;
    return true;
  };
  return (
    same(L.TILE_DEST_ENTRY, L.TILES_POINTER + 3) &&
    same(L.LIST_POINTER, L.LIST_POINTER + 3) &&
    same(L.AREA[0], L.AREA[1])
  );
}
// --- Colour quantisation ---

const rgb5 = (r, g, b) => [r >> 3, g >> 3, b >> 3];
const toRaw = ([r, g, b]) => r | (g << 5) | (b << 10);
const dist = (a, b) => {
  // weighted RGB distance (green counts more)
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
};

/** Median cut of 5-bit colours into at most `max` colours */
export function medianCut(colors, max = 15) {
  if (!colors.length) return [];
  let boxes = [colors];
  while (boxes.length < max) {
    // split the box with the widest channel range
    let best = -1;
    let bestRange = 0;
    let bestCh = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 31;
        let hi = 0;
        for (const c of box) {
          if (c[ch] < lo) lo = c[ch];
          if (c[ch] > hi) hi = c[ch];
        }
        if (hi - lo > bestRange) {
          bestRange = hi - lo;
          best = i;
          bestCh = ch;
        }
      }
    });
    if (best < 0) break;
    const box = [...boxes[best]].sort((a, b) => a[bestCh] - b[bestCh]);
    const mid = box.length >> 1;
    boxes.splice(best, 1, box.slice(0, mid), box.slice(mid));
  }
  const avg = (box) =>
    [0, 1, 2].map((ch) => Math.round(box.reduce((s, c) => s + c[ch], 0) / box.length));
  // unique colours, darkest first (stable output)
  const out = [];
  for (const c of boxes.filter((b) => b.length).map(avg)) {
    if (!out.some((o) => o[0] === c[0] && o[1] === c[1] && o[2] === c[2])) out.push(c);
  }
  return out.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
}

const nearest = (pal, c) => {
  let best = 0;
  let bestD = Infinity;
  pal.forEach((p, i) => {
    const d = dist(p, c);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return { index: best, d: bestD };
};

const blockError = (pal, pixels) =>
  pal.length ? pixels.reduce((s, c) => s + nearest(pal, c).d, 0) : Infinity;

/** Two palettes and a palette per block (2-means over blocks, median cut inside) */
function twoPalettes(blocks, max = 15) {
  const mean = (px) => [0, 1, 2].map((ch) => px.reduce((s, c) => s + c[ch], 0) / px.length);
  const means = blocks.map((b) => mean(b.pixels));
  // seeds: the block farthest from the average, then the one farthest from it
  const all = mean(blocks.flatMap((b) => b.pixels));
  const far = (from) =>
    means.reduce((bi, m, i) => (dist(m, from) > dist(means[bi], from) ? i : bi), 0);
  const a = far(all);
  const b = far(means[a]);
  let assign = means.map((m) => (dist(m, means[a]) <= dist(m, means[b]) ? 0 : 1));
  let pals = [[], []];
  for (let iter = 0; iter < 4; iter++) {
    pals = [0, 1].map((p) =>
      medianCut(
        blocks.filter((_, i) => assign[i] === p).flatMap((x) => x.pixels),
        max,
      ),
    );
    if (!pals[1].length) pals[1] = pals[0];
    if (!pals[0].length) pals[0] = pals[1];
    assign = blocks.map((x) =>
      blockError(pals[0], x.pixels) <= blockError(pals[1], x.pixels) ? 0 : 1,
    );
  }
  return { pals, assign };
}
// --- Build ---

/**
 * Build a logo from an image already scaled to fit MAX_WIDTH x MAX_HEIGHT.
 * @param {{ width: number, height: number, data: Uint8ClampedArray|Uint8Array }} image - RGBA
 * @param {{ tm?: Uint8Array[]|null, alphaThreshold?: number, colors?: number }} [options] -
 *   tm: the 2 TM tiles; colors: colours per palette (1-15, fewer = smaller)
 * @returns {{ ok: boolean, error?: string, tiles?: Uint8Array, list?: Uint8Array,
 *   palettes?: number[][], sprites?: number, tileCount?: number }}
 */
export function buildLogo(image, { tm = null, alphaThreshold = 128, colors = 15 } = {}) {
  const { width: w, height: h, data } = image;
  if (w > L.MAX_WIDTH || h > L.MAX_HEIGHT || !w || !h) return { ok: false, error: 'logoSize' };
  // place the image centred at CENTER, 8-pixel aligned grid
  const x0 = Math.round(L.CENTER[0] - w / 2);
  const y0 = Math.round(L.CENTER[1] - h / 2);
  const opaque = (x, y) => data[(y * w + x) * 4 + 3] >= alphaThreshold;
  const color = (x, y) => {
    const i = (y * w + x) * 4;
    return rgb5(data[i], data[i + 1], data[i + 2]);
  };

  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const cellUsed = (cx, cy) => {
    for (let y = cy; y < cy + 8; y++)
      for (let x = cx; x < cx + 8; x++) if (inside(x, y) && opaque(x, y)) return true;
    return false;
  };
  // grid of 16x16 blocks: try every offset, keep the one with the fewest cells / blocks
  let best = null;
  for (let gy = 0; gy < 16; gy++)
    for (let gx = 0; gx < 16; gx++) {
      let cells = 0;
      let blocksUsed = 0;
      for (let py = -gy; py < h; py += 16)
        for (let px = -gx; px < w; px += 16) {
          const n = [0, 1, 2, 3].filter((k) =>
            cellUsed(px + (k & 1) * 8, py + (k >> 1) * 8),
          ).length;
          cells += n;
          if (n) blocksUsed++;
        }
      const cost = cells * 1000 + blocksUsed;
      if (!best || cost < best.cost) best = { cost, gx, gy };
    }
  const blocks = [];
  for (let py = -best.gy; py < h; py += 16)
    for (let px = -best.gx; px < w; px += 16) {
      const cells = [0, 1, 2, 3].map((k) => cellUsed(px + (k & 1) * 8, py + (k >> 1) * 8));
      if (!cells.some(Boolean)) continue;
      const pixels = [];
      for (let y = py; y < py + 16; y++)
        for (let x = px; x < px + 16; x++)
          if (inside(x, y) && opaque(x, y)) pixels.push(color(x, y));
      blocks.push({ px, py, cells, pixels });
    }
  if (!blocks.length) return { ok: false, error: 'logoEmpty' };

  const { pals, assign } = twoPalettes(blocks, Math.max(1, Math.min(15, colors)));
  // 4bpp tile of one 8x8 cell
  const cellTile = (cx, cy, pal) => {
    const t = new Uint8Array(32);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const px = cx + x;
        const py = cy + y;
        if (!inside(px, py) || !opaque(px, py)) continue;
        const c = nearest(pal, color(px, py)).index + 1;
        const bit = 0x80 >> x;
        if (c & 1) t[y * 2] |= bit;
        if (c & 2) t[y * 2 + 1] |= bit;
        if (c & 4) t[16 + y * 2] |= bit;
        if (c & 8) t[16 + y * 2 + 1] |= bit;
      }
    return t;
  };

  // sprites: big when 3+ cells are used, else small; fall back to all big when too many
  const plan = (bigFrom) =>
    blocks.flatMap((b, i) => {
      const used = b.cells.filter(Boolean).length;
      if (used >= bigFrom) return [{ b, i, big: true }];
      return b.cells.map((u, k) => (u ? { b, i, big: false, k } : null)).filter(Boolean);
    });
  const extra = tm ? 2 : 0;
  let sprites = plan(3);
  if (sprites.length + extra > L.MAX_SPRITES) sprites = plan(1);
  if (sprites.length + extra > L.MAX_SPRITES) {
    return { ok: false, error: 'logoTooManySprites', sprites: sprites.length + extra };
  }

  // tiles: big sprites take 2x2 slots in row pairs, small ones any free cell (deduplicated)
  const first = L.FIRST_TILE;
  const rows = (L.LAST_TILE + 1 - first) / 16;
  const used = new Uint8Array(rows * 16);
  const sheet = new Uint8Array(rows * 16 * 32);
  const key = (arr) => arr.join(',');
  const bigSeen = new Map();
  const smallSeen = new Map();
  const freeBig = () => {
    for (let r = 0; r + 1 < rows; r += 2)
      for (let c = 0; c < 16; c += 2) {
        const k = r * 16 + c;
        if (!used[k] && !used[k + 1] && !used[k + 16] && !used[k + 17]) return k;
      }
    return -1;
  };
  const freeSmall = () => used.indexOf(0);
  const out = [];
  // big sprites first (2x2 slots), then the 8x8 ones fill the gaps: the block stays short
  for (const s of [...sprites.filter((x) => x.big), ...sprites.filter((x) => !x.big)]) {
    const pal = pals[assign[s.i]];
    const palette = assign[s.i] === 0 ? 2 : 3;
    const bx = s.b.px;
    const by = s.b.py;
    if (s.big) {
      const t4 = [0, 1, 2, 3].map((k) => cellTile(bx + (k & 1) * 8, by + (k >> 1) * 8, pal));
      const id = key(t4.map((t) => key(t)));
      let slot = bigSeen.get(id);
      if (slot === undefined) {
        slot = freeBig();
        if (slot < 0) return { ok: false, error: 'logoTooManyTiles' };
        [0, 1, 16, 17].forEach((d, k) => {
          used[slot + d] = 1;
          sheet.set(t4[k], (slot + d) * 32);
        });
        bigSeen.set(id, slot);
      }
      out.push({ x: x0 + bx, y: y0 + by, tile: first + slot, big: 1, palette });
    } else {
      const cx = bx + (s.k & 1) * 8;
      const cy = by + (s.k >> 1) * 8;
      const t = cellTile(cx, cy, pal);
      const id = key(t);
      let slot = smallSeen.get(id);
      if (slot === undefined) {
        slot = freeSmall();
        if (slot < 0) return { ok: false, error: 'logoTooManyTiles' };
        used[slot] = 1;
        sheet.set(t, slot * 32);
        smallSeen.set(id, slot);
      }
      out.push({ x: x0 + cx, y: y0 + cy, tile: first + slot, big: 0, palette });
    }
  }
  if (tm) {
    // TM at the bottom right of the logo, in OBJ palette 7
    const right = x0 + w;
    const bottom = y0 + h;
    tm.forEach((t, k) => {
      const slot = freeSmall();
      if (slot < 0) return;
      used[slot] = 1;
      sheet.set(t, slot * 32);
      out.push({
        x: Math.min(255 - 16, right) + k * 8,
        y: bottom - 8,
        tile: first + slot,
        big: 0,
        palette: 7,
      });
    });
  }

  // tile block: from FIRST_TILE up to the last used tile
  let last = used.length - 1;
  while (last > 0 && !used[last]) last--;
  const tiles = sheet.slice(0, (last + 1) * 32);

  // sprite list block
  const n = out.length;
  const list = new Uint8Array(4 + n * 4);
  list.set([1, n & 0xff, n >> 8, n]);
  const [ox, oy] = L.ORIGIN;
  out.forEach((s, i) => {
    list[4 + i] = (s.x - ox) & 0xff;
    list[4 + n + i] = (s.y - oy) & 0xff;
    list[4 + 2 * n + i] = s.tile & 0xff;
    list[4 + 3 * n + i] = (s.big << 4) | ((s.palette & 7) << 1) | (s.tile >> 8);
  });

  const palettes = pals.map((p) => {
    const raw = p.map(toRaw);
    while (raw.length < 15) raw.push(0);
    return raw.slice(0, 15);
  });
  return { ok: true, tiles, list, palettes, sprites: n, tileCount: last + 1 };
}

/**
 * buildLogo with as many colours per palette as fit in the ROM (15 down to 2).
 * @returns result of buildLogo plus { colors, size, capacity }; ok is false with
 *   error 'logoNoSpace' when even 2 colours do not fit
 */
export function buildLogoAuto(image, options = {}) {
  let last = null;
  for (let colors = 15; colors >= 2; colors--) {
    const built = buildLogo(image, { ...options, colors });
    if (!built.ok) return built;
    const size = logoSize(built);
    last = { ...built, colors, size, capacity: LOGO_CAPACITY };
    if (size <= LOGO_CAPACITY) return last;
  }
  return { ...last, ok: false, error: 'logoNoSpace' };
}
/** The 2 TM tiles of the logo as loaded (4bpp, 32 bytes each), or null */
export function originalTmTiles(rom) {
  const orig = rom.getOriginalData?.();
  if (!orig) return null;
  const h = rom.headerOffset || 0;
  const tiles = konamiDecompress(orig, L.TILES + h);
  const base = (L.ORIGINAL_DEST - 0x6000) / 16; // first OBJ tile of the block
  return L.TM_TILES.map((t) => tiles.slice((t - base) * 32, (t - base + 1) * 32));
}

// --- Write ---

function writeDest(rom, word) {
  rom.writeByte(L.TILE_DEST_ENTRY, word & 0xff);
  rom.writeByte(L.TILE_DEST_ENTRY + 1, word >> 8);
}

/** Room for both compressed blocks (tiles + sprite list) */
export const LOGO_CAPACITY = L.AREA[1] - L.AREA[0];

/**
 * Write a logo built by buildLogo: both blocks go in the logo area (tiles
 * first), the pointers and the VRAM address follow. The caller sets the
 * palettes.
 * @returns {{ ok: boolean, error?: string, size: number, capacity: number }}
 */
export function writeLogo(rom, built) {
  const tiles = konamiCompress(built.tiles);
  const list = konamiCompress(built.list);
  const size = tiles.length + list.length;
  if (size > LOGO_CAPACITY) {
    return { ok: false, error: 'logoNoSpace', size, capacity: LOGO_CAPACITY };
  }
  const [start, end] = L.AREA;
  rom.writeBytes(start, tiles);
  rom.writeBytes(start + tiles.length, list);
  for (let a = start + size; a < end; a++) rom.writeByte(a, 0xff);
  writePointer(rom, L.TILES_POINTER, start);
  writePointer(rom, L.LIST_POINTER, start + tiles.length);
  writeDest(rom, 0x6000 + L.FIRST_TILE * 16);
  return { ok: true, size, capacity: LOGO_CAPACITY };
}

/** Size a built logo takes in the ROM (compressed tiles + list) */
export const logoSize = (built) =>
  konamiCompress(built.tiles).length + konamiCompress(built.list).length;

/** Put the logo of the ROM as loaded back (blocks, pointers, VRAM address) */
export function restoreOriginalLogo(rom) {
  const orig = rom.getOriginalData?.();
  if (!orig) return { ok: false };
  const h = rom.headerOffset || 0;
  const copy = (a, b) => rom.writeBytes(a, orig.slice(a + h, b + h));
  copy(L.AREA[0], L.AREA[1]);
  copy(L.TILE_DEST_ENTRY, L.TILES_POINTER + 3);
  copy(L.LIST_POINTER, L.LIST_POINTER + 3);
  return { ok: true };
}
