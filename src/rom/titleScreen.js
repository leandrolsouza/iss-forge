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
import { TITLE_SCREEN, TEAMS, FLAG_DESIGN_ORDINALS, UNIFORM_COLORS } from './constants';
import { getHairSkinOffset } from './readers/UniformReader';
import { konamiDecompress } from './KonamiCodec';
import { TITLE_RAW_TILES } from './titleScreenLayout';
import {
  readTitleObjects,
  writeTitleObjects,
  shadowSprites,
  ballSprites,
  ballShadowTile,
} from './titleObjects';
import { readPoses, writePose, playerSprites, listPoseFrames } from './titlePlayers';
import { readLogoSprites, writeLogo, restoreOriginalLogo, isOriginalLogo } from './titleLogo';
import { pressStartAt, readTitleTexts } from './titleScreenText';
import { backgroundState, writeBackground } from './titleBackground';
import { OBJ_BASE, tilePixel, setPixel, drawSprites as drawObj } from './snesRender';

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
    background: backgroundState(rom),
    poses: readPoses(rom),
    objects: readTitleObjects(rom),
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
    else if (key.startsWith('pose:')) writePose(rom, key.slice(5), value);
    else if (key === 'objects') writeTitleObjects(rom, value);
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
// --- Background (BG1) ---

/**
 * Put a background built by buildBackground in the ROM. New images bring their
 * colours (stroke: BG palette 7, grass: palettes 2-3); a part that goes back
 * to the original gets its original colours back.
 * @param {{ top: string, grass: string }} modes - the modes the background was built with
 */
export function importTitleBackground(rom, built, modes) {
  const before = backgroundState(rom);
  const res = writeBackground(rom, built);
  if (!res.ok) return res;
  const orig = rom.getOriginalData?.();
  const h = rom.headerOffset || 0;
  const copy = (id) => {
    if (!orig) return;
    const { offset, count } = byId[id];
    rom.writeBytes(offset, orig.slice(offset + h, offset + h + count * 2));
  };
  const updates = {};
  if (built.colors.stroke) updates.stroke = built.colors.stroke;
  else if (modes.top === 'original' && before.top === 'custom') copy('stroke');
  if (built.colors.grass) updates.grass = built.colors.grass;
  else if (modes.grass === 'original' && before.grass === 'custom') copy('grass');
  applyTitleScreenUpdates(rom, updates);
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
  // $80:ADB3: when both teams have the same predominant colour ($81:8DB2[ordinal]),
  // team 2 (the right player) wears its second kit
  const predominant = (side) => {
    const index = state.teams[side];
    return index === null
      ? -1
      : rom.readByte(UNIFORM_COLORS.PREDOMINANT_COLOR_OFFSET + FLAG_DESIGN_ORDINALS[index]);
  };
  const clash = predominant('left') >= 0 && predominant('left') === predominant('right');
  const team = (side, row) => {
    const index = state.teams[side];
    const kit = side === 'right' && clash ? 'second' : 'first';
    const off = index === null ? null : getHairSkinOffset(TEAMS[index].id, kit);
    if (off !== null) put(row, 1, readColors(rom, off, 15));
  };
  team('left', 8);
  team('right', 9);
  // goalkeeper frames use rows 12-13: the keeper hair/skin + kit of the team (11 colours)
  const keeper = (side, row) => {
    const index = state.teams[side];
    const off = index === null ? null : getHairSkinOffset(TEAMS[index].id, 'goalkeeper');
    put(row, 1, Array(15).fill(0x739c));
    if (off !== null) put(row, 1, readColors(rom, off, 11));
  };
  keeper('left', 12);
  keeper('right', 13);
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

/**
 * priority: null = every tile, true / false = only tiles with / without the
 * priority bit (BG3 high-priority tiles are drawn above the sprites, mode 1 + BG3 priority).
 */
function drawBg(img, cg, vram, words, bg, palSize, haze = false, priority = null) {
  for (let ty = 0; ty < 28; ty++)
    for (let tx = 0; tx < 32; tx++) {
      const w = words
        ? words[ty * 32 + tx]
        : vram[bg.map + (ty * 32 + tx) * 2] | (vram[bg.map + (ty * 32 + tx) * 2 + 1] << 8);
      if (priority !== null && !!(w & 0x2000) !== priority) continue;
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
  drawObj(img, cg, vram, sprites, { objBase: OBJ_BASE });
}

/**
 * Render the title screen as the game shows it after the intro.
 * @param {object} rom - RomParser-like
 * @param {object} [state] - { colors, teams } (defaults to the ROM contents)
 * @param {{ pressStart?: boolean }} [options]
 * @returns {{ width: number, height: number, data: Uint8ClampedArray }}
 */
export function renderTitleScreen(rom, state = readTitleScreen(rom), { pressStart = true } = {}) {
  const vram = Uint8Array.from(buildVram(rom));
  const cg = buildCgram(rom, state);
  const img = { data: new Uint8ClampedArray(WIDTH * HEIGHT * 4), width: WIDTH, height: HEIGHT };
  for (let i = 0; i < WIDTH * HEIGHT; i++) setPixel(img, i % WIDTH, Math.floor(i / WIDTH), cg[0]);
  drawBg(img, cg, vram, null, BG1, 16, true);
  const bg3 = bg3Words(rom, vram, pressStart);
  drawBg(img, cg, vram, bg3, BG3, 4, false, false);
  const objects = state.objects || readTitleObjects(rom);
  vram.set(rom.readBytes(ballShadowTile(objects.ball.z), 32), (OBJ_BASE + 0x1b0 * 32) & 0xffff);
  drawSprites(img, cg, vram, shadowSprites(objects));
  const poses = state.poses || readPoses(rom);
  const feet = { left: objects.players.leftX, right: objects.players.rightX };
  for (const side of ['left', 'right']) {
    const team = state.teams?.[side];
    const ordinal = team === null || team === undefined ? 0 : FLAG_DESIGN_ORDINALS[team];
    const p = playerSprites(rom, side, poses[side], [feet[side], objects.players.y], ordinal);
    if (!p) continue;
    p.tiles.forEach(([tile, bytes]) => vram.set(bytes, (OBJ_BASE + tile * 32) & 0xffff));
    drawSprites(img, cg, vram, p.sprites);
  }
  drawSprites(img, cg, vram, readLogoSprites(rom));
  drawSprites(img, cg, vram, ballSprites(objects));
  // the copyright and PRESS START tiles have the priority bit: they cover the sprites
  drawBg(img, cg, vram, bg3, BG3, 4, false, true);
  return { width: WIDTH, height: HEIGHT, data: img.data };
}

/**
 * Every pose the game has, drawn for one player (with the colours of its team
 * and mirrored like on the screen), in a grid.
 * @returns {{ width: number, height: number, data: Uint8ClampedArray,
 *   frames: number[], columns: number, cell: [number, number] }}
 */
export function renderPoseSheet(rom, state, side, { columns = 12, cell = [40, 64] } = {}) {
  const frames = listPoseFrames(rom);
  const [cw, ch] = cell;
  const rows = Math.ceil(frames.length / columns);
  const img = {
    data: new Uint8ClampedArray(columns * cw * rows * ch * 4),
    width: columns * cw,
    height: rows * ch,
  };
  const cg = buildCgram(rom, state);
  const vram = new Uint8Array(0x10000);
  const team = state.teams?.[side];
  const ordinal = team === null || team === undefined ? 0 : FLAG_DESIGN_ORDINALS[team];
  frames.forEach((y, k) => {
    const x0 = (k % columns) * cw;
    const y0 = Math.floor(k / columns) * ch;
    const p = playerSprites(rom, side, y, [x0 + cw / 2, y0 + ch - 6], ordinal);
    if (!p) return;
    p.tiles.forEach(([tile, bytes]) => vram.set(bytes, (OBJ_BASE + tile * 32) & 0xffff));
    img.clip = [x0, y0, x0 + cw, y0 + ch];
    drawSprites(img, cg, vram, p.sprites);
  });
  return { width: img.width, height: img.height, data: img.data, frames, columns, cell };
}
