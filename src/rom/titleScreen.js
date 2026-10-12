/**
 * Title screen ("INTERNATIONAL SUPERSTAR SOCCER" + PRESS START): colours, the
 * teams of the two players and a preview renderer.
 *
 * Colours are raw SNES 15-bit values. The logo flash steps and the "sky fill"
 * (used while the grass / players / logo fade in) are kept in step with the
 * edited colours, so the intro animation keeps working.
 *
 * See TITLE_SCREEN in constants.js and research/title-screen.md.
 */
import { TITLE_SCREEN, TEAMS, FLAG_DESIGN_ORDINALS } from './constants';
import { getHairSkinOffset } from './readers/UniformReader';
import { konamiDecompress } from './KonamiCodec';
import { TITLE_PLAYER_SPRITES, TITLE_RAW_TILES } from './titleScreenLayout';
import { readLogoSprites, writeLogo, restoreOriginalLogo, isOriginalLogo } from './titleLogo';
import { pressStartAt, readTitleTexts } from './titleScreenText';

const T = TITLE_SCREEN;
const byId = Object.fromEntries(T.COLORS.map((c) => [c.id, c]));

export const TITLE_COLOR_IDS = T.COLORS.map((c) => c.id);

const readWord = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
const writeWord = (rom, a, v) => {
  rom.writeByte(a, v & 0xff);
  rom.writeByte(a + 1, (v >> 8) & 0xff);
};
/** Colour of a palette word: command words ($8000 + n = n x black) read as black */
const colorOf = (word) => (word & 0x8000 ? 0 : word);

function readColors(rom, offset, count) {
  return Array.from({ length: count }, (_, i) => colorOf(readWord(rom, offset + i * 2)));
}

// --- Teams ---

const teamFromByte = (b) => {
  const index = FLAG_DESIGN_ORDINALS.indexOf(b >> 1);
  return index >= 0 ? index : null;
};
const teamByte = (teamIndex) => FLAG_DESIGN_ORDINALS[teamIndex] * 2;

// --- Read ---

/**
 * @returns {{ colors: Object<string, number[]>, teams: { left: number|null, right: number|null },
 *   texts: { copyright: string, pressStart: string }, logo: { original: boolean, sprites: number } }}
 */
export function readTitleScreen(rom) {
  const colors = {};
  T.COLORS.forEach(({ id, offset, count }) => (colors[id] = readColors(rom, offset, count)));
  return {
    colors,
    teams: {
      left: teamFromByte(rom.readByte(T.TEAM_LEFT)),
      right: teamFromByte(rom.readByte(T.TEAM_RIGHT)),
    },
    texts: readTitleTexts(rom),
    logo: { original: isOriginalLogo(rom), sprites: readLogoSprites(rom).length },
  };
}

// --- Write ---

const channels = (raw) => [raw & 31, (raw >> 5) & 31, (raw >> 10) & 31];
const fromChannels = ([r, g, b]) => {
  const c = (v) => Math.max(0, Math.min(31, Math.round(v)));
  return c(r) | (c(g) << 5) | (c(b) << 10);
};

/** Write colours, only where they change (keeps command words that still match) */
function writeColors(rom, offset, colors) {
  colors.forEach((raw, i) => {
    const a = offset + i * 2;
    if (colorOf(readWord(rom, a)) !== (raw & 0x7fff)) writeWord(rom, a, raw & 0x7fff);
  });
}

/**
 * Move the logo flash steps along with a logo colour change: each step keeps
 * its difference (per channel) to the normal colour.
 */
function syncLogoFlash(rom, id, before, after) {
  const part = id === 'logoTop' ? 0 : 15;
  T.LOGO_FLASH.forEach((base) => {
    const offset = base + part * 2;
    const flash = readColors(rom, offset, 15);
    const next = flash.map((f, i) => {
      if (before[i] === after[i]) return f;
      const [o, w, n] = [channels(before[i]), channels(f), channels(after[i])];
      return fromChannels(n.map((v, k) => v + (w[k] - o[k])));
    });
    writeColors(rom, offset, next);
  });
}

/** Replace one colour group (see TITLE_SCREEN.COLORS) */
export function writeTitleColors(rom, id, colors) {
  const def = byId[id];
  if (!def) throw new Error(`Unknown title screen colour group: ${id}`);
  if (!Array.isArray(colors) || colors.length !== def.count) {
    throw new Error(`Title colour group ${id} needs ${def.count} colours`);
  }
  const before = readColors(rom, def.offset, def.count);
  writeColors(rom, def.offset, colors);
  if (id === 'sky') {
    writeColors(rom, T.SKY_FILL.offset, Array(T.SKY_FILL.count).fill(colors[0]));
  } else if (id === 'logoTop' || id === 'logoBottom') {
    syncLogoFlash(rom, id, before, colors);
  }
}

/** Set the team of the left or right player (TEAMS index) */
export function writeTitleTeam(rom, side, teamIndex) {
  if (!TEAMS[teamIndex]) throw new Error('Invalid team');
  rom.writeByte(side === 'left' ? T.TEAM_LEFT : T.TEAM_RIGHT, teamByte(teamIndex));
}

/**
 * Apply a batch of edits as one step.
 * Keys: colour group id → colours; `team:left` / `team:right` → TEAMS index.
 */
export function applyTitleScreenUpdates(rom, updates) {
  Object.entries(updates).forEach(([key, value]) => {
    if (key.startsWith('team:')) writeTitleTeam(rom, key.slice(5), value);
    else writeTitleColors(rom, key, value);
  });
}

// --- Logo ---

/**
 * Put a logo built by buildLogo in the ROM, with its two palettes (OBJ rows 10
 * and 11, flash steps follow). `hideStroke` paints the red brush stroke with
 * the sky colour, so it disappears.
 * @returns {{ ok: boolean, error?: string, size?: number, capacity?: number }}
 */
export function importTitleLogo(rom, built, { hideStroke = false } = {}) {
  const res = writeLogo(rom, built);
  if (!res.ok) return res;
  const updates = { logoTop: built.palettes[0], logoBottom: built.palettes[1] };
  if (hideStroke) {
    const sky = readColors(rom, byId.sky.offset, 1)[0];
    updates.stroke = Array(byId.stroke.count).fill(sky);
  }
  applyTitleScreenUpdates(rom, updates);
  return res;
}

/** The original logo again: blocks, logo colours + flash steps and (when hidden) the brush stroke */
export function restoreTitleLogo(rom) {
  const orig = rom.getOriginalData?.();
  if (!orig) return { ok: false };
  const h = rom.headerOffset || 0;
  const copy = (a, b) => rom.writeBytes(a, orig.slice(a + h, b + h));
  const stroke = readColors(rom, byId.stroke.offset, byId.stroke.count);
  const sky = readColors(rom, byId.sky.offset, 1)[0];
  const res = restoreOriginalLogo(rom);
  const span = (id) => [byId[id].offset, byId[id].offset + byId[id].count * 2];
  copy(...span('logoTop'));
  copy(...span('logoBottom'));
  T.LOGO_FLASH.forEach((a) => copy(a, a + 60));
  if (stroke.every((v) => v === sky)) copy(...span('stroke'));
  return res;
}
// --- Undo snapshots (exact bytes) ---

export function readTitleScreenBytes(rom) {
  return T.RANGES.map(([s, e]) => Array.from(rom.readBytes(s, e - s)));
}

export function restoreTitleScreenBytes(rom, snapshot) {
  if (!Array.isArray(snapshot)) return;
  T.RANGES.forEach(([s], i) => snapshot[i] && rom.writeBytes(s, snapshot[i]));
}

// --- Preview ---

const BG1 = { map: 0x1000 * 2, chars: 0x2000 * 2, bpp: 4 };
const BG3 = { map: 0x5c00 * 2, chars: 0x5000 * 2, bpp: 2 };
const OBJ_BASE = 0x6000 * 2;
const WIDTH = 256;
const HEIGHT = 224;

/** File offset of a LoROM 24-bit pointer */
const fileOf = (ptr) => ((ptr >> 16) & 0x7f) * 0x8000 + ((ptr & 0xffff) - 0x8000);

/** Graphics are the same for every colour edit: cache per ROM buffer + compressed bytes */
let gfxCache = null;

/** 64 KB VRAM image of the screen, built from the load lists (+ streamed player tiles) */
function buildVram(rom) {
  const data = rom.getRomData ? rom.getRomData() : rom.data;
  const h = rom.headerOffset || 0;
  const entries = [];
  T.LOAD_LISTS.forEach((list) => {
    let a = list + 2; // header 00 00 = VRAM list
    while (rom.readByte(a) !== 0xff && entries.length < 32) {
      const dest = readWord(rom, a);
      const ptr = readWord(rom, a + 2) | (rom.readByte(a + 4) << 16);
      entries.push({ dest, file: fileOf(ptr) });
      a += 5;
    }
  });
  // Cache key: the compressed bytes of every block (they never change from colour edits)
  const key = entries
    .map(({ dest, file }) => {
      const size = readWord(rom, file) & 0x7fff;
      let sum = 0;
      for (let i = 0; i < size; i++) sum = (sum * 31 + data[file + h + i]) >>> 0;
      return `${dest}:${file}:${size}:${sum}`;
    })
    .join('|');
  const rawKey = TITLE_RAW_TILES.map(([, off, n]) =>
    Array.from(rom.readBytes(off, n * 32)).join(','),
  ).join('|');
  if (gfxCache && gfxCache.key === key && gfxCache.rawKey === rawKey) return gfxCache.vram;

  const vram = new Uint8Array(0x10000);
  entries.forEach(({ dest, file }) => {
    const out = konamiDecompress(data, file + h);
    const at = dest * 2;
    for (let i = 0; i < out.length && at + i < vram.length; i++) vram[at + i] = out[i];
  });
  TITLE_RAW_TILES.forEach(([tile, off, n]) => {
    vram.set(rom.readBytes(off, n * 32), (OBJ_BASE + tile * 32) & 0xffff);
  });
  gfxCache = { key, rawKey, vram };
  return vram;
}

/** Pixel (colour index) of a tile row */
function tilePixel(vram, base, bpp, x, y) {
  let c = 0;
  for (let p = 0; p < bpp; p += 2) {
    const lo = vram[(base + y * 2 + p * 8) & 0xffff];
    const hi = vram[(base + y * 2 + p * 8 + 1) & 0xffff];
    c |= ((lo >> (7 - x)) & 1) << p;
    c |= ((hi >> (7 - x)) & 1) << (p + 1);
  }
  return c;
}

/** 256-colour CGRAM of the screen for the given state */
function buildCgram(rom, state) {
  const cg = new Uint16Array(256);
  const put = (row, first, colors) => colors.forEach((c, i) => (cg[row * 16 + first + i] = c));
  put(0, 0, readColors(rom, 0x2d49e, 16));
  T.COLORS.forEach(({ id, row, first }) => {
    const colors = state.colors[id];
    if (id === 'grass') {
      put(2, 1, colors.slice(0, 15));
      put(3, 1, colors.slice(15));
    } else put(row, first, colors);
  });
  const team = (side, row) => {
    const index = state.teams[side];
    const off = index === null ? null : getHairSkinOffset(TEAMS[index].id, 'first');
    if (off !== null) put(row, 1, readColors(rom, off, 15));
  };
  team('left', 8);
  team('right', 9);
  const B = T.BALL_PALETTE;
  put(B.row, B.first, readColors(rom, B.offset, B.count));
  return cg;
}

/** BG3 map words with PRESS START written in (the game blinks it every 32 frames) */
function bg3Words(rom, vram, withPressStart) {
  const words = new Uint16Array(1024);
  for (let i = 0; i < 1024; i++)
    words[i] = vram[BG3.map + i * 2] | (vram[BG3.map + i * 2 + 1] << 8);
  if (!withPressStart) return words;
  const P = T.PRESS_START;
  const at = pressStartAt(rom);
  let cell = readWord(rom, at) - 0x5c00;
  for (let a = at + 2; rom.readByte(a) !== 0xff && a < at + 40; a++) {
    if (cell >= 0 && cell < 1024) words[cell] = rom.readByte(a) | P.attr;
    cell++;
  }
  return words;
}

/**
 * Colour addition on BG1 (fixed colour per scanline): a light haze over the
 * far end of the pitch, then +1 down to the bottom. Measured from the game:
 * [red, green, blue] added on lines 112-127.
 */
// prettier-ignore
const HAZE = [
  [16, 17, 17], [16, 16, 16], [14, 15, 16], [13, 14, 14], [13, 13, 13], [12, 12, 13], [10, 12, 12], [10, 10, 10],
  [9, 9, 10], [7, 9, 9], [7, 7, 7], [6, 6, 7], [4, 6, 6], [4, 4, 4], [3, 3, 4], [1, 3, 3],
];
const HAZE_FROM = 112;

function hazed(raw, y) {
  if (y < HAZE_FROM) return raw;
  const [r, g, b] = HAZE[y - HAZE_FROM] || [1, 1, 1];
  const add = (v, d) => Math.min(31, v + d);
  return add(raw & 31, r) | (add((raw >> 5) & 31, g) << 5) | (add((raw >> 10) & 31, b) << 10);
}

function drawBg(img, cg, vram, words, bg, palSize, haze = false) {
  for (let ty = 0; ty < 28; ty++)
    for (let tx = 0; tx < 32; tx++) {
      const w = words
        ? words[ty * 32 + tx]
        : vram[bg.map + (ty * 32 + tx) * 2] | (vram[bg.map + (ty * 32 + tx) * 2 + 1] << 8);
      const tile = w & 0x3ff;
      const pal = (w >> 10) & 7;
      const base = bg.chars + tile * bg.bpp * 8;
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const c = tilePixel(vram, base, bg.bpp, w & 0x4000 ? 7 - x : x, w & 0x8000 ? 7 - y : y);
          if (!c) continue;
          const py = ty * 8 + y;
          const raw = cg[pal * palSize + c];
          setPixel(img, tx * 8 + x, py, haze ? hazed(raw, py) : raw);
        }
    }
}

function drawSprites(img, cg, vram, sprites) {
  sprites.forEach(([sx, sy, tile, big, pal, hf, vf]) => {
    const n = big ? 2 : 1;
    for (let ty = 0; ty < n; ty++)
      for (let tx = 0; tx < n; tx++) {
        const t = tile + (hf ? n - 1 - tx : tx) + (vf ? n - 1 - ty : ty) * 16;
        const base = (OBJ_BASE + (t & 0x1ff) * 32) & 0xffff;
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            const c = tilePixel(vram, base, 4, hf ? 7 - x : x, vf ? 7 - y : y);
            if (c) setPixel(img, sx + tx * 8 + x, sy + ty * 8 + y, cg[128 + pal * 16 + c]);
          }
      }
  });
}

function setPixel(img, x, y, raw) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 4;
  img[i] = (raw & 31) << 3;
  img[i + 1] = ((raw >> 5) & 31) << 3;
  img[i + 2] = ((raw >> 10) & 31) << 3;
  img[i + 3] = 255;
}

/**
 * Render the title screen as the game shows it after the intro.
 * @param {object} rom - RomParser-like
 * @param {object} [state] - { colors, teams } (defaults to the ROM contents)
 * @param {{ pressStart?: boolean }} [options]
 * @returns {{ width: number, height: number, data: Uint8ClampedArray }}
 */
export function renderTitleScreen(rom, state = readTitleScreen(rom), { pressStart = true } = {}) {
  const vram = buildVram(rom);
  const cg = buildCgram(rom, state);
  const img = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let i = 0; i < WIDTH * HEIGHT; i++) setPixel(img, i % WIDTH, Math.floor(i / WIDTH), cg[0]);
  drawBg(img, cg, vram, null, BG1, 16, true);
  drawBg(img, cg, vram, bg3Words(rom, vram, pressStart), BG3, 4);
  drawSprites(img, cg, vram, TITLE_PLAYER_SPRITES.slice(0, -1));
  drawSprites(img, cg, vram, readLogoSprites(rom));
  drawSprites(img, cg, vram, TITLE_PLAYER_SPRITES.slice(-1));
  return { width: WIDTH, height: HEIGHT, data: img };
}
