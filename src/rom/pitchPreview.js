/**
 * Match pitch preview: the real grass tiles of the match screen with the edited
 * grass palettes.
 *
 * Match screen (mode 1): BG2 = pitch, tilemap at VRAM word $1000 (64x64), 4bpp chars
 * at word $2000. The chars come from the load list $82:806C (file 0x1006C, 5 Konami
 * blocks; identical to the VRAM of every match savestate). The tilemap is built by
 * code while the camera scrolls (not stored in the ROM): the grass is a repeating
 * 8 x 8 cell pattern of tiles 0x01-0x17 on palettes 2 and 3 (GRASS_PATTERN, read from
 * the VRAM of a match), with the pitch lines drawn over it in perspective.
 * Only pitch type B has been dumped; types A/C use other mowing tiles (source unknown),
 * so their colours are shown on the B tiles. See research/match-palettes.md.
 */
import { konamiDecompress } from './KonamiCodec';
import { createImage, setPixel, tilePixel } from './snesRender';

export const PITCH_TILE_LIST = 0x1006c;
const CHARS = 0x2000 * 2;

// prettier-ignore
/** [palette, tile] of the grass cells, 8 x 8 (the game shifts it 4 cells every 4 rows) */
export const GRASS_PATTERN = [
  [0x305, 0x306, 0x307, 0x308, 0x301, 0x302, 0x303, 0x304],
  [0x30c, 0x30d, 0x30e, 0x30f, 0x307, 0x309, 0x30a, 0x30b],
  [0x307, 0x308, 0x213, 0x206, 0x210, 0x211, 0x201, 0x312],
  [0x30e, 0x30f, 0x316, 0x20d, 0x217, 0x215, 0x207, 0x209],
  [0x301, 0x302, 0x303, 0x304, 0x305, 0x306, 0x307, 0x308],
  [0x307, 0x309, 0x30a, 0x30b, 0x30c, 0x30d, 0x30e, 0x30f],
  [0x210, 0x211, 0x201, 0x312, 0x307, 0x308, 0x213, 0x206],
  [0x217, 0x215, 0x207, 0x209, 0x30e, 0x30f, 0x316, 0x20d],
];

const word = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
const fileOf = (ptr) => ((ptr >> 16) & 0x7f) * 0x8000 + ((ptr & 0xffff) - 0x8000);

let cache = null;

/** VRAM with the pitch characters (load list 0x1006C) */
export function buildPitchVram(rom) {
  const data = rom.getRomData ? rom.getRomData() : rom.data;
  const h = rom.headerOffset || 0;
  if (cache && cache.data === data && cache.stamp === stamp(rom)) return cache.vram;
  const vram = new Uint8Array(0x10000);
  for (const { dest, file } of entries(rom)) {
    const out = konamiDecompress(data, file + h);
    vram.set(out.subarray(0, Math.max(0, 0x10000 - dest * 2)), dest * 2);
  }
  cache = { data, stamp: stamp(rom), vram };
  return vram;
}

function entries(rom) {
  const out = [];
  let a = PITCH_TILE_LIST + 2; // 00 00 = VRAM list
  while (rom.readByte(a) !== 0xff && out.length < 16) {
    const ptr = word(rom, a + 2) | (rom.readByte(a + 4) << 16);
    out.push({ dest: word(rom, a), file: fileOf(ptr) });
    a += 5;
  }
  return out;
}

/** Cheap fingerprint of the compressed blocks (they change only if graphics are edited) */
function stamp(rom) {
  return entries(rom)
    .map(({ file }) => {
      const size = word(rom, file) & 0x7fff;
      let sum = 0;
      for (let i = 0; i < size; i += 7) sum = (sum * 31 + rom.readByte(file + i)) >>> 0;
      return `${file}:${size}:${sum}`;
    })
    .join('|');
}

/**
 * Grass of the match drawn with the real tiles, with the pitch lines drawn as a plan
 * (the game draws them in perspective; the line pixels of its tiles use colours 6-8
 * of the grass palette, the lines here use colour 8 of the cell's palette).
 * @param {object} rom - RomParser
 * @param {number[]} grass - 30 raw colours (MATCH_PALETTES grass*: rows 2 and 3, colours 1-15)
 * @param {{ width?: number, height?: number, lines?: boolean }} [options] - size in pixels
 */
export function renderPitch(rom, grass, { width = 256, height = 128, lines = true } = {}) {
  const vram = buildPitchVram(rom);
  const cg = new Uint16Array(128);
  grass.slice(0, 15).forEach((c, i) => (cg[2 * 16 + 1 + i] = c));
  grass.slice(15, 30).forEach((c, i) => (cg[3 * 16 + 1 + i] = c));
  const img = createImage(width, height);
  const palAt = (x, y) => GRASS_PATTERN[(y >> 3) % 8][(x >> 3) % 8] >> 8;
  for (let ty = 0; ty < Math.ceil(height / 8); ty++)
    for (let tx = 0; tx < Math.ceil(width / 8); tx++) {
      const cell = GRASS_PATTERN[ty % 8][tx % 8];
      const pal = cell >> 8;
      const base = CHARS + (cell & 0xff) * 32;
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const c = tilePixel(vram, base, 4, x, y);
          setPixel(img, tx * 8 + x, ty * 8 + y, cg[pal * 16 + c] || cg[pal * 16 + 1]);
        }
    }
  if (lines) drawPitchLines(img, (x, y) => cg[palAt(x, y) * 16 + 8]);
  return img;
}

/** Plan view of the pitch markings, 1 pixel wide */
function drawPitchLines(img, colorAt) {
  const { width: w, height: h } = img;
  const dot = (x, y) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < w && y < h) setPixel(img, x, y, colorAt(x, y));
  };
  const hline = (x0, x1, y) => {
    for (let x = x0; x <= x1; x++) dot(x, y);
  };
  const vline = (x, y0, y1) => {
    for (let y = y0; y <= y1; y++) dot(x, y);
  };
  const rect = (x0, y0, x1, y1) => {
    hline(x0, x1, y0);
    hline(x0, x1, y1);
    vline(x0, y0, y1);
    vline(x1, y0, y1);
  };
  const m = 6;
  const [x0, y0, x1, y1] = [m, m, w - 1 - m, h - 1 - m];
  const cy = (y0 + y1) / 2;
  rect(x0, y0, x1, y1);
  vline(Math.round(w / 2), y0, y1);
  const r = Math.round((y1 - y0) * 0.15);
  for (let a = 0; a < 360; a += 1) {
    dot(w / 2 + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180));
  }
  const boxW = Math.round((x1 - x0) * 0.13);
  const boxH = Math.round((y1 - y0) * 0.55);
  const sixW = Math.round(boxW * 0.38);
  const sixH = Math.round(boxH * 0.45);
  rect(x0, Math.round(cy - boxH / 2), x0 + boxW, Math.round(cy + boxH / 2));
  rect(x1 - boxW, Math.round(cy - boxH / 2), x1, Math.round(cy + boxH / 2));
  rect(x0, Math.round(cy - sixH / 2), x0 + sixW, Math.round(cy + sixH / 2));
  rect(x1 - sixW, Math.round(cy - sixH / 2), x1, Math.round(cy + sixH / 2));
}
