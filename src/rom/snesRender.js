/**
 * Generic SNES drawing helpers shared by the previews (title screen, players...).
 *
 * Images are `{ data: Uint8ClampedArray (RGBA), width, height, clip? }`, colours
 * raw BGR555 words, VRAM a 64 KB Uint8Array and CGRAM a Uint16Array(256).
 */

/** OBJ character base used by the title screen and the previews (VRAM byte address) */
export const OBJ_BASE = 0x6000 * 2;

/** Blank RGBA image (transparent) */
export function createImage(width, height) {
  return { data: new Uint8ClampedArray(width * height * 4), width, height };
}

/** Pixel (colour index) of a planar tile row */
export function tilePixel(vram, base, bpp, x, y) {
  let c = 0;
  for (let p = 0; p < bpp; p += 2) {
    const lo = vram[(base + y * 2 + p * 8) & 0xffff];
    const hi = vram[(base + y * 2 + p * 8 + 1) & 0xffff];
    c |= ((lo >> (7 - x)) & 1) << p;
    c |= ((hi >> (7 - x)) & 1) << (p + 1);
  }
  return c;
}

/** img: { data, width, height, clip?: [x0, y0, x1, y1] } */
export function setPixel(img, x, y, raw) {
  const [x0, y0, x1, y1] = img.clip || [0, 0, img.width, img.height];
  if (x < x0 || y < y0 || x >= x1 || y >= y1) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = (raw & 31) << 3;
  img.data[i + 1] = ((raw >> 5) & 31) << 3;
  img.data[i + 2] = ((raw >> 10) & 31) << 3;
  img.data[i + 3] = 255;
}

/** Fill the image (or its clip rectangle) with one colour */
export function fillImage(img, raw) {
  const [x0, y0, x1, y1] = img.clip || [0, 0, img.width, img.height];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) setPixel(img, x, y, raw);
}

/**
 * Draw OBJ sprites: [x, y, tile, big, palette, hFlip, vFlip], 4bpp tiles in VRAM at
 * `objBase`, colours from CGRAM rows 8-15. Colour 0 is transparent, and so is any
 * colour index in `skip` (a Set, or a function (colour, palette) => boolean).
 */
export function drawSprites(img, cg, vram, sprites, { objBase = OBJ_BASE, skip = null } = {}) {
  const skipped = typeof skip === 'function' ? skip : skip ? (c) => skip.has(c) : null;
  sprites.forEach(([sx, sy, tile, big, pal, hf, vf]) => {
    const n = big ? 2 : 1;
    for (let ty = 0; ty < n; ty++)
      for (let tx = 0; tx < n; tx++) {
        const t = tile + (hf ? n - 1 - tx : tx) + (vf ? n - 1 - ty : ty) * 16;
        const base = (objBase + (t & 0x1ff) * 32) & 0xffff;
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            const c = tilePixel(vram, base, 4, hf ? 7 - x : x, vf ? 7 - y : y);
            if (!c || skipped?.(c, pal)) continue;
            setPixel(img, sx + tx * 8 + x, sy + ty * 8 + y, cg[128 + pal * 16 + c]);
          }
      }
  });
}

/**
 * Raw BGR555 word of an editor colour: `raw` when present, else the 5-bit channels
 * (`r5`/`g5`/`b5`), else the 8-bit ones rounded like the writers do.
 */
export function colorToRaw(color) {
  if (!color) return 0;
  if (Number.isInteger(color.raw) && color.r5 === undefined) return color.raw & 0x7fff;
  const ch = (five, eight) =>
    Number.isInteger(five) ? five : Math.min(31, Math.round((eight || 0) / 8));
  return ch(color.r5, color.r) | (ch(color.g5, color.g) << 5) | (ch(color.b5, color.b) << 10);
}

/**
 * Image of a grid of colour indexes (e.g. a flag design): `palette[i]` raw colours,
 * index 0 transparent.
 * @param {number[][]} grid
 * @param {number[]} palette
 */
export function renderIndexed(grid, palette) {
  const h = grid.length;
  const w = h ? grid[0].length : 0;
  const img = createImage(w, h);
  grid.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c) setPixel(img, x, y, palette[c] ?? 0);
    }),
  );
  return img;
}

/** Draw an image onto a canvas element (sizes the canvas to the image) */
export function paintCanvas(canvas, { width, height, data }) {
  if (!canvas) return;
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
}
