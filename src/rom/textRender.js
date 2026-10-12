/**
 * Text previews drawn with the game's own fonts (BG3 text layer, 2bpp).
 *
 * Every text routine of the game writes tilemap words into one 32x32 layer
 * (WRAM $7E:4390 -> VRAM word $1800), with the characters at VRAM word $4000:
 *   - load list $82:8300 (file 0x10300): 6 Konami-compressed blocks = the 8x8 font
 *     (A-Z, digits, a-z, punctuation) and the 8x16 font;
 *   - 8x8 box texts (scenario, training intros/results, team descriptions):
 *     ASCII -> tile through the table $82:8C80 (file 0x10C80), routine $80:E2AC;
 *     FE xx = attribute (palette (xx >> 2) & 7), FD = rest of the line blank, FF = end;
 *   - 8x16 fixed texts and menu screens: ISS codes -> tile pair (FONT16_TABLE).
 * Colours: 1 = fill, 2 = shade, 3 = outline, 0 = transparent (CGRAM pal * 4 + c).
 * See research/game-texts.md, section "Como o jogo desenha os textos".
 */
import { FONT16_TABLE } from './constants';
import { konamiDecompress } from './KonamiCodec';
import { createImage, fillImage, setPixel, tilePixel } from './snesRender';

export const TEXT_FONT_LIST = 0x10300;
export const BOX_FONT_TABLE = 0x10c80;
/** BG3 character base (byte address of VRAM word $4000) */
const CHARS = 0x8000;
const ATTR = 0xfe;
const NEWLINE = 0xfd;
const END = 0xff;
const BLANK = 0x2000;

/**
 * CGRAM blobs (bank $85: size word + colours; colour 0 of rows 1+ is not stored).
 * training = pre-match menu and training screens, selection = team selection / joypad.
 */
export const TEXT_PALETTES = { training: 0x2e2dd, selection: 0x2f3db };

/** Inside of the text boxes (dark navy, the frame is drawn on another layer) */
export const BOX_BACKGROUND = 5 << 10;

const word = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
const fileOf = (ptr) => ((ptr >> 16) & 0x7f) * 0x8000 + ((ptr & 0xffff) - 0x8000);

/**
 * 256-colour CGRAM from a palette blob, as the loader ($80:ACF0) writes it: row 0
 * complete (backdrop + 15), then 15 colours per row (colour 0 skipped). A word with
 * bit 15 set repeats black n times.
 */
export function readCgramBlob(rom, file) {
  const cg = new Uint16Array(256);
  const size = word(rom, file);
  let index = 0;
  let produced = 0;
  const put = (c) => {
    if (index > 0 && index % 16 === 0) index++; // colour 0 of the next row is skipped
    if (index < 256) cg[index++] = c;
    produced++;
  };
  for (let a = file + 2; produced < size && a < file + 2 + 1024; a += 2) {
    const w = word(rom, a);
    if (w & 0x8000) for (let n = 0; n < (w & 0x7fff) && produced < size; n++) put(0);
    else put(w);
  }
  return cg;
}

let vramCache = null;

/** VRAM with the text fonts loaded (characters at byte 0x8000), cached per ROM contents */
export function buildTextVram(rom) {
  const data = rom.getRomData ? rom.getRomData() : rom.data;
  const h = rom.headerOffset || 0;
  const entries = [];
  let a = TEXT_FONT_LIST + 2; // 00 00 = VRAM list
  while (rom.readByte(a) !== 0xff && entries.length < 16) {
    const ptr = word(rom, a + 2) | (rom.readByte(a + 4) << 16);
    entries.push({ dest: word(rom, a), file: fileOf(ptr) });
    a += 5;
  }
  const key = entries
    .map(({ dest, file }) => {
      const size = word(rom, file) & 0x7fff;
      let sum = 0;
      for (let i = 0; i < size; i++) sum = (sum * 31 + data[file + h + i]) >>> 0;
      return `${dest}:${file}:${size}:${sum}`;
    })
    .join('|');
  if (vramCache && vramCache.data === data && vramCache.key === key) return vramCache.vram;
  const vram = new Uint8Array(0x10000);
  entries.forEach(({ dest, file }) => {
    const out = konamiDecompress(data, file + h);
    vram.set(out.subarray(0, Math.max(0, 0x10000 - dest * 2)), dest * 2);
  });
  vramCache = { data, key, vram };
  return vram;
}

/**
 * Tilemap words of an 8x8 box text, as $80:E2AC writes them.
 * @param {number[]} bytes - ASCII + FE/FD/FF codes
 * @returns {Uint16Array} lines x columns words
 */
export function boxWords(rom, bytes, lines, columns) {
  const words = new Uint16Array(lines * columns).fill(BLANK);
  let attr = BLANK;
  let row = 0;
  let col = 0;
  for (let i = 0; i < bytes.length && row < lines; i++) {
    const b = bytes[i];
    if (b === END) break;
    if (b === ATTR) {
      attr = ((bytes[++i] ?? 0x20) << 8) | BLANK;
      continue;
    }
    if (b === NEWLINE) {
      row++;
      col = 0;
      continue;
    }
    words[row * columns + col] = rom.readByte(BOX_FONT_TABLE + b) | attr;
    if (++col >= columns) {
      row++;
      col = 0;
    }
  }
  return words;
}

/** Tile pair of an 8x16 character code (table $82:8AF4) */
export function font16Pair(rom, code) {
  const add = code * 2 < 0x10c ? 0x30 : 0x110;
  return [
    rom.readByte(FONT16_TABLE + code * 2) + add,
    rom.readByte(FONT16_TABLE + code * 2 + 1) + add,
  ];
}

/**
 * Tilemap words of an 8x16 fixed text: each code takes a column of 2 rows; code 0 is
 * blank; FE xx changes the palette and takes no cell.
 * @param {number[]} codes - lines x columns cells (layoutFixed / encodeCells)
 * @returns {Uint16Array} (lines * 2) x columns words
 */
export function fixedWords(rom, codes, lines, columns) {
  const words = new Uint16Array(lines * 2 * columns).fill(BLANK);
  let attr = BLANK;
  let cell = 0;
  for (let i = 0; i < codes.length && cell < lines * columns; i++) {
    const code = codes[i];
    if (code === ATTR) {
      attr = ((codes[++i] ?? 0x20) << 8) | BLANK;
      continue;
    }
    const line = Math.floor(cell / columns);
    const col = cell % columns;
    if (code) {
      const [top, bottom] = font16Pair(rom, code);
      words[line * 2 * columns + col] = top | attr;
      words[(line * 2 + 1) * columns + col] = bottom | attr;
    }
    cell++;
  }
  return words;
}

/** Draw BG3 words (2bpp, 4-colour palettes) into an image */
export function drawTextWords(img, cg, vram, words, columns, { x0 = 0, y0 = 0 } = {}) {
  const rows = Math.ceil(words.length / columns);
  for (let ty = 0; ty < rows; ty++)
    for (let tx = 0; tx < columns; tx++) {
      const w = words[ty * columns + tx];
      const tile = w & 0x3ff;
      if (!tile) continue;
      const pal = (w >> 10) & 7;
      const base = CHARS + tile * 16;
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const c = tilePixel(vram, base, 2, w & 0x4000 ? 7 - x : x, w & 0x8000 ? 7 - y : y);
          if (c) setPixel(img, x0 + tx * 8 + x, y0 + ty * 8 + y, cg[pal * 4 + c]);
        }
    }
}

function render(rom, words, columns, rows, palette, background, padding) {
  const cg = readCgramBlob(rom, TEXT_PALETTES[palette] ?? TEXT_PALETTES.training);
  const img = createImage(columns * 8 + padding * 2, rows * 8 + padding * 2);
  fillImage(img, background ?? cg[0]);
  drawTextWords(img, cg, buildTextVram(rom), words, columns, { x0: padding, y0: padding });
  return img;
}

/**
 * An 8x8 box text as the game draws it.
 * @param {object} rom - RomParser
 * @param {number[]} bytes - encodeScenarioText(...).bytes, encodeTeamDescription(...)...
 * @param {{ lines: number, columns: number, palette?: 'training'|'selection',
 *   background?: number, padding?: number }} box
 */
export function renderBoxText(rom, bytes, { lines, columns, palette, background, padding = 4 }) {
  return render(
    rom,
    boxWords(rom, bytes, lines, columns),
    columns,
    lines,
    palette,
    background,
    padding,
  );
}

/** An 8x16 fixed text (codes from layoutFixed) as the game draws it */
export function renderFixedText(rom, codes, { lines, columns, palette, background, padding = 4 }) {
  const words = fixedWords(rom, codes, lines, columns);
  return render(rom, words, columns, lines * 2, palette, background, padding);
}

/**
 * The text layer of a menu screen (32 x 28 cells, 256 x 224 pixels): tilemap words from
 * readScreenWords / buildScreenWords. The frames and backgrounds are on other layers
 * whose setup is not known yet, so only the texts are drawn, over the backdrop colour.
 */
export function renderMenuText(rom, words, { palette = 'training', background } = {}) {
  return render(rom, words.subarray(0, 32 * 28), 32, 28, palette, background, 0);
}
