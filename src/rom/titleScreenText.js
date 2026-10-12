/**
 * Title screen texts: the copyright lines (BG3 map) and PRESS START (a string
 * drawn by code, blinking).
 *
 * Characters of the shaded Konami font (A-Z . 1 5 9 ©) use its tiles 0x01-0x1F.
 * The copyright may also use digits and punctuation: those are drawn in the
 * same shaded style over the plain-font tile of the character (tile = ASCII
 * code), in the plain font block, which only the title screen (and the
 * wrong-region warning) loads. PRESS START is also drawn by another screen, so
 * it only takes the Konami font characters.
 *
 * See TITLE_SCREEN.TEXT in constants.js and research/title-screen.md.
 */
import { TITLE_SCREEN, MENU_SCREENS } from './constants';
import { konamiDecompress, konamiCompress } from './KonamiCodec';
import { readScreenWords, packScreenWords, placeScreenBlock, screenLocation } from './menuScreens';

const X = TITLE_SCREEN.TEXT;

/** Konami (shaded) font: character -> tile */
const KONAMI_TILES = { ' ': 0, '.': 0x1b, 1: 0x1c, 5: 0x1d, 9: 0x1e, '©': 0x1f };
for (let i = 0; i < 26; i++) KONAMI_TILES[String.fromCharCode(65 + i)] = i + 1;
const KONAMI_CHARS = Object.keys(KONAMI_TILES).join('');

/** Plain font characters (tiles 0x20-0x5F) that can be redrawn in the shaded style */
const PLAIN_CHARS = Array.from({ length: 0x3f }, (_, i) => String.fromCharCode(0x21 + i))
  .filter((ch) => ch !== '@')
  .join('');

/** Characters allowed in the copyright lines / in PRESS START */
export const TITLE_COPYRIGHT_CHARS = [...new Set([...KONAMI_CHARS, ...PLAIN_CHARS])]
  .sort()
  .join('');
export const TITLE_PRESS_CHARS = KONAMI_CHARS;

const tileChar = (t) => {
  if (t >= 0x20 && t < 0x60) return String.fromCharCode(t);
  const hit = Object.entries(KONAMI_TILES).find(([, v]) => v === t);
  return hit ? hit[0] : '?';
};
const charTile = (ch) => KONAMI_TILES[ch] ?? ch.charCodeAt(0);
const norm = (s) => String(s ?? '').toUpperCase();

// --- Locations ---

const screenOf = (offset) => MENU_SCREENS.find((s) => s.offset === offset);
const fontAt = (rom) => screenLocation(rom, screenOf(X.FONT));
const readPtr = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
/** File offset of the PRESS START string (bank $81) */
export const pressStartAt = (rom) => 0x8000 + (readPtr(rom, X.PRESS_POINTERS[1]) - 0x8000);

// --- Read ---

function decodeRow(words, row) {
  let s = '';
  for (let c = 0; c < X.COLUMNS; c++) s += tileChar(words[row * X.COLUMNS + c] & 0x3ff);
  return s.trim();
}

/** @returns {{ copyright: string, pressStart: string }} copyright lines joined with \n */
export function readTitleTexts(rom) {
  const words = readScreenWords(rom, X.MAP);
  const lines = X.MAP_ROWS.map((r) => decodeRow(words, r));
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  let press = '';
  const at = pressStartAt(rom);
  for (let a = at + 2; a < at + 2 + X.COLUMNS && rom.readByte(a) !== 0xff; a++) {
    press += tileChar(rom.readByte(a));
  }
  return { copyright: lines.join('\n'), pressStart: press.trim() };
}

// --- Check ---

const linesOf = (text) =>
  norm(text)
    .split('\n')
    .map((l) => l.trim());

/**
 * @returns {{ error?: string, invalid: string[] }} error: noGlyph, tooManyLines, tooWide, empty
 */
export function checkTitleTexts({ copyright, pressStart }) {
  const res = { invalid: [] };
  if (copyright !== undefined) {
    const lines = linesOf(copyright);
    res.invalid.push(
      ...lines
        .join('')
        .split('')
        .filter((ch) => !TITLE_COPYRIGHT_CHARS.includes(ch)),
    );
    if (!res.error && lines.length > X.MAP_ROWS.length) res.error = 'tooManyLines';
    if (!res.error && lines.some((l) => l.length > X.COLUMNS)) res.error = 'tooWide';
  }
  if (pressStart !== undefined) {
    const p = norm(pressStart).trim();
    res.invalid.push(...p.split('').filter((ch) => !TITLE_PRESS_CHARS.includes(ch)));
    if (!res.error && !p) res.error = 'empty';
    if (!res.error && p.length > X.COLUMNS) res.error = 'tooWide';
  }
  res.invalid = [...new Set(res.invalid)];
  if (res.invalid.length) res.error = 'noGlyph';
  return res;
}

// --- Write: plain font tiles ---

const decompressAt = (rom, data, at) => konamiDecompress(data, at + (rom.headerOffset || 0));
const originalOf = (rom) => (rom.getOriginalData ? rom.getOriginalData() : null);

/** Plain font tiles as in the ROM when it was loaded (or now, without an original copy) */
function originalFont(rom) {
  const orig = originalOf(rom);
  if (!orig) return decompressAt(rom, rom.getRomData(), fontAt(rom));
  const h = rom.headerOffset || 0;
  const p = screenOf(X.FONT).pointers[0] + h;
  const ptr = orig[p] | (orig[p + 1] << 8);
  const at = (orig[p + 2] & 0x7f) * 0x8000 + (ptr - 0x8000);
  return konamiDecompress(orig, at + h);
}

/** 2bpp tile: a plain glyph redrawn with the shaded font colours (rows) */
function shadedGlyph(font, ch) {
  const t = ch.charCodeAt(0);
  const out = new Uint8Array(16);
  for (let y = 0; y < 8; y++) {
    const ink = font[t * 16 + y * 2] | font[t * 16 + y * 2 + 1];
    const c = X.GLYPH_ROW_COLORS[y];
    out[y * 2] = c & 1 ? ink : 0;
    out[y * 2 + 1] = c & 2 ? ink : 0;
  }
  return out;
}

/** Font with the extra copyright characters drawn in */
function buildFont(rom, copyright) {
  const base = originalFont(rom);
  const font = Uint8Array.from(base);
  const extra = new Set(
    linesOf(copyright)
      .join('')
      .split('')
      .filter((ch) => KONAMI_TILES[ch] === undefined),
  );
  for (const ch of extra) font.set(shadedGlyph(base, ch), ch.charCodeAt(0) * 16);
  return { font, same: font.every((b, i) => b === base[i]) };
}

/** Compressed bytes of a block as loaded (when the content went back to the original) */
function originalBlock(rom, offset) {
  const orig = originalOf(rom);
  if (!orig) return null;
  const h = rom.headerOffset || 0;
  const size = (orig[offset + h] | (orig[offset + h + 1] << 8)) & 0x7fff;
  return orig.slice(offset + h, offset + h + size);
}

// --- Write: map ---

function buildMap(rom, copyright) {
  const words = readScreenWords(rom, X.MAP);
  X.MAP_ROWS.forEach((r) => {
    for (let c = 0; c < X.COLUMNS; c++) words[r * X.COLUMNS + c] = X.ATTR;
  });
  linesOf(copyright).forEach((line, i) => {
    const row = X.MAP_ROWS[i];
    const col = Math.ceil((X.COLUMNS - line.length) / 2);
    [...line].forEach((ch, k) => (words[row * X.COLUMNS + col + k] = X.ATTR | charTile(ch)));
  });
  return words;
}

const sameWords = (a, b) => a.length === b.length && a.every((w, i) => w === b[i]);

function originalMapWords(rom) {
  const orig = originalOf(rom);
  if (!orig) return null;
  return readScreenWords(orig, X.MAP + (rom.headerOffset || 0), false);
}

// --- Write: PRESS START ---

const SPARE_END = 0x10000;

/** String bytes: VRAM word address (row PRESS_ROW, centred) + tiles + 0xFF */
function pressBytes(text) {
  const v = 0x5c00 + X.PRESS_ROW * X.COLUMNS + Math.floor((X.COLUMNS - text.length) / 2);
  return [v & 0xff, v >> 8, ...[...text].map(charTile), 0xff];
}

/**
 * Up to 11 letters stay in the original slot (padded with spaces, as the
 * original "PRESS START" fills it); longer texts go to the reserved end of
 * bank $81 and both pointers follow.
 */
function writePressStart(rom, text) {
  const p = norm(text).trim();
  const home = p.length <= X.PRESS_HOME_LENGTH;
  if (!home && pressStartAt(rom) !== X.PRESS_SPARE) {
    for (let a = X.PRESS_SPARE; a < SPARE_END; a++) {
      if (rom.readByte(a) !== 0xff) return { ok: false, error: 'noSpace' };
    }
  }
  for (let a = X.PRESS_SPARE; a < SPARE_END; a++) rom.writeByte(a, 0xff);
  let at = X.PRESS_SPARE;
  if (home) {
    const pad = X.PRESS_HOME_LENGTH - p.length;
    const left = Math.floor(pad / 2);
    rom.writeBytes(X.PRESS_HOME, pressBytes(' '.repeat(left) + p + ' '.repeat(pad - left)));
    at = X.PRESS_HOME;
  } else {
    rom.writeBytes(at, pressBytes(p));
  }
  X.PRESS_POINTERS.forEach((ptr) => {
    rom.writeByte(ptr, at & 0xff);
    rom.writeByte(ptr + 1, (at >> 8) & 0xff);
  });
  return { ok: true };
}

function writeCopyright(rom, copyright) {
  // plain font: extra characters drawn in the shaded style
  const { font, same } = buildFont(rom, copyright);
  const fontBytes = (same && originalBlock(rom, X.FONT)) || konamiCompress(font);
  const f = placeScreenBlock(rom, X.FONT, fontBytes);
  if (!f.ok) return { ...f, error: 'titleTextFull' };
  // map
  const words = buildMap(rom, copyright);
  const orig = originalMapWords(rom);
  const mapBytes =
    (orig && sameWords(words, orig) && originalBlock(rom, X.MAP)) || packScreenWords(words);
  const m = placeScreenBlock(rom, X.MAP, mapBytes);
  if (!m.ok) return { ...m, error: 'titleTextFull' };
  return { ok: true };
}

/**
 * Write the copyright lines and/or PRESS START. All or nothing: on failure
 * the ROM is left as it was.
 * @param {{ copyright?: string, pressStart?: string }} texts
 * @returns {{ ok: boolean, error?: string, invalid?: string[], size?: number, capacity?: number }}
 */
export function writeTitleTexts(rom, texts) {
  const check = checkTitleTexts(texts);
  if (check.error) return { ok: false, error: check.error, invalid: check.invalid };
  const data = rom.getRomData();
  const backup = data.slice();
  const steps = [
    texts.copyright !== undefined && (() => writeCopyright(rom, texts.copyright)),
    texts.pressStart !== undefined && (() => writePressStart(rom, texts.pressStart)),
  ].filter(Boolean);
  for (const step of steps) {
    const res = step();
    if (!res.ok) {
      data.set(backup);
      return res;
    }
  }
  return { ok: true };
}
