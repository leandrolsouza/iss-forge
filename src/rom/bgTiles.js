/**
 * 4bpp BG tiles from RGBA images: tile encoding, a tile sheet that reuses equal and
 * flipped tiles, and the cells of an image. Shared by the title screen background
 * (titleBackground.js) and the menu background (menuBackground.js).
 */
import { rgb5, toRaw, nearest } from './quantize';

/** 4bpp bytes of an 8x8 tile given 64 colour indexes */
export function encodeTile(px) {
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
export function decodeTile(t) {
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

export const flipPx = (px, h, v) => {
  const out = new Array(64);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) out[y * 8 + x] = px[(v ? 7 - y : y) * 8 + (h ? 7 - x : x)];
  return out;
};

/**
 * Tile sheet with deduplication (flipped copies reuse a tile). An empty tile is
 * always tile 0.
 * @param {{ first: number, last: number, reserved?: [number, number] }} range - tile
 *   numbers new tiles may take; `reserved` [start, end) is skipped
 */
export function tileSheet({ first, last, reserved = null }) {
  const tiles = new Map(); // index -> bytes
  const seen = new Map(); // key -> index
  let next = first;
  const isReserved = (i) => reserved && i >= reserved[0] && i < reserved[1];
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
      while (isReserved(next)) next++;
      if (next > last) return -1;
      const index = next++;
      tiles.set(index, encodeTile(px));
      seen.set(px.join(','), index);
      return index;
    },
  };
}

/** Cells of an RGBA image: { cells: { cx, cy, pixels: [r,g,b][] (opaque) }[], at(x, y) -> colour|null } */
export function imageCells(image, alphaThreshold = 128) {
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

/** 64 colour indexes of the cell at (cx, cy): 0 = transparent, n = pal[n - 1] */
export const cellIndexes = (at, cx, cy, pal) => {
  const px = new Array(64).fill(0);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const c = at(cx + x, cy + y);
      if (c) px[y * 8 + x] = nearest(pal, c).index + 1;
    }
  return px;
};

/** 15 raw colours of a palette ([r,g,b] 5-bit), black after the last one */
export const padPalette = (pal) => {
  const raw = pal.map(toRaw);
  while (raw.length < 15) raw.push(0);
  return raw.slice(0, 15);
};
