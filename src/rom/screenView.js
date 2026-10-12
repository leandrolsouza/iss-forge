/**
 * Screen viewer: draws a game screen from the ROM the way the PPU shows it.
 *
 * A screen is described by a "recipe" (SCREEN_VIEWS) found by comparing save states
 * of the emulator with the ROM (research/tools/screen-recipe.mjs):
 *   - load lists of bank $82 (header 00 00 = VRAM: [dest word][ptr 24], 01 00 = WRAM:
 *     [dest 24][ptr 24], ended by FF) with Konami-compressed blocks; WRAM entries are the
 *     tilemap buffers ($7E:4390 = BG3 map, $7E:4B90 = its second half) copied to VRAM;
 *   - palette descriptors of bank $81 ([blob word in $85][byte offset into $81:86F3]);
 *   - the PPU setup read from the save state (mode 1, BG bases and sizes, layers on the
 *     main / sub screen, colour math and the colour window boxes).
 * Everything is read from the current ROM, so edits (and moved menu screens, whose
 * descriptors are updated) show up. Sprites are drawn only where the editor knows them
 * (main menu items). Texts the game draws by code at run time are added as overlays where
 * their place is known (training instructions, team description, joypad help).
 * See research/screen-viewer.md.
 */
import { konamiDecompress } from './KonamiCodec';
import { tilePixel } from './snesRender';
import { SCREEN_TEXT_PACKS, SCREEN_TEXTS, TEAMS, GAME_TEXTS } from './constants';
import { readSpriteEntries } from './menuSprites';
import { readScreenTexts, encodeScreenField } from './screenTexts';
import { readTrainingTexts, layoutFixed } from './gameTexts';
import { encodeScenarioText } from './scenario';
import { readTeamDescriptionRaw, TEAM_DESC } from './teamDescription';
import { boxWords, fixedWords } from './textRender';

const LIST_BANK = 0x10000; // bank $82
const PALETTE_DEST_TABLE = 0x86f3; // bank $81: CGRAM buffer addresses ($7E:3200 = colour 0)
const PALETTE_BANK = 0x28000; // bank $85
const WIDTH = 256;
const HEIGHT = 224;
/** Layer bits of TM / TS / CGADSUB */
export const LAYER_BIT = { bg1: 1, bg2: 2, bg3: 4, obj: 16, back: 32 };

const word = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
const fileOf = (ptr) => ((ptr >> 16) & 0x7f) * 0x8000 + ((ptr & 0xffff) - 0x8000);
const romData = (rom) => (rom.getRomData ? rom.getRomData() : rom.data);

/** File offset of a bank $82 list address ($82:8455 -> 0x10455) */
export const listFile = (snes) => LIST_BANK + ((snes & 0xffff) - 0x8000);

/**
 * Read a load list.
 * @returns {{ kind: 'vram'|'wram', entries: { dest: number, file: number }[] } | null}
 */
export function readLoadList(rom, file) {
  const kind = rom.readByte(file);
  if (rom.readByte(file + 1) !== 0 || kind > 1) return null;
  const step = kind === 0 ? 5 : 6;
  const entries = [];
  let a = file + 2;
  while (rom.readByte(a) !== 0xff && entries.length < 24) {
    const dest = kind === 0 ? word(rom, a) : word(rom, a) | (rom.readByte(a + 2) << 16);
    const ptr = word(rom, a + step - 3) | (rom.readByte(a + step - 1) << 16);
    entries.push({ dest, file: fileOf(ptr) });
    a += step;
  }
  return { kind: kind === 0 ? 'vram' : 'wram', entries };
}

/** WRAM tilemap buffers -> VRAM word address they are copied to */
const WRAM_TO_VRAM = { 0x7e4390: 0x1800, 0x7e4b90: 0x1c00 };

/**
 * 64 KB VRAM of a screen: the load lists applied in order.
 * @returns {{ vram: Uint8Array, sources: { start: number, end: number, file: number, list: number }[] }}
 *   sources: byte ranges of VRAM and the ROM block each came from (last write wins)
 */
export function buildScreenVram(rom, loads) {
  const data = romData(rom);
  const h = rom.headerOffset || 0;
  const vram = new Uint8Array(0x10000);
  const sources = [];
  for (const list of loads) {
    const parsed = readLoadList(rom, listFile(list));
    if (!parsed) continue;
    for (const e of parsed.entries) {
      const dest = parsed.kind === 'vram' ? e.dest : WRAM_TO_VRAM[e.dest];
      if (dest === undefined) continue;
      const out = konamiDecompress(data, e.file + h);
      const size = decompressedSize(data, e.file + h);
      const at = (dest * 2) & 0xffff;
      const n = Math.min(size, 0x10000 - at);
      vram.set(out.subarray(0, n), at);
      sources.push({ start: at, end: at + n, file: e.file, list });
    }
  }
  return { vram, sources };
}

/**
 * Bytes a Konami block expands to (konamiDecompress returns a 64 KB buffer).
 * The stream is walked with the same rules as the decoder.
 */
export function decompressedSize(data, offset) {
  const size = (data[offset] | (data[offset + 1] << 8)) & 0x7fff;
  let p = offset + 2;
  const end = offset + size;
  let out = 0;
  while (p < end && out < 0x10000) {
    const b = data[p++];
    const ctrl = (b >> 5) & 7;
    if (ctrl === 4) {
      out += b & 0x1f;
      p += b & 0x1f;
    } else if (ctrl === 5) {
      const n = (b & 0x1f) + 2;
      out += n * 2;
      p += n;
    } else if (ctrl === 6) {
      out += (b & 0x1f) + 2;
      p++;
    } else if (ctrl === 7) {
      if (b !== 0xff) out += (b & 0x1f) + 2;
      else out += data[p++] + 2;
    } else {
      out += (b >> 2) + 2;
      p++;
    }
  }
  return out;
}

/**
 * Apply palette descriptors (bank $81 addresses) to a 256-colour CGRAM, as $80:ACF0
 * does: the blob's size word counts bytes (the loop runs while it stays >= 0), colour 0
 * of each row after the first is skipped, and a word with bit 15 set writes (low byte)
 * black colours.
 */
export function buildScreenCgram(rom, descriptors, cg = new Uint16Array(256)) {
  for (const y of descriptors) {
    const ptr = word(rom, y);
    const blob = PALETTE_BANK + (ptr - 0x8000);
    let index = (word(rom, PALETTE_DEST_TABLE + rom.readByte(y + 2)) - 0x3200) >> 1;
    const count = (word(rom, blob) >> 1) + 1;
    let produced = 0;
    const put = (c) => {
      if (index > 0 && index % 16 === 0) index++;
      if (index >= 0 && index < 256) cg[index] = c;
      index++;
      produced++;
    };
    for (let a = blob + 2; produced < count && a < blob + 2 + 1024; a += 2) {
      const w = word(rom, a);
      if (w & 0x8000) for (let n = 0; n < (w & 0xff) && produced < count; n++) put(0);
      else put(w);
    }
  }
  return cg;
}

// --- Recipes ---

/** Menu screens: BG1 frames (4bpp, 64x64 map at $0000), BG2 "SUPER STAR SOCCER" background
 * (4bpp, 32x64 at $1000, scrolls up), BG3 texts (2bpp, 32x64 at $1800, priority);
 * BG2 is darkened (fixed colour subtracted) inside the colour window boxes. */
function menuPpu({ bg3Chars = 0x4000, window = [] } = {}) {
  return {
    bg: [
      { map: 0x0000, size: 3, chars: 0x2000, bpp: 4, hofs: 0, vofs: -1 },
      { map: 0x1000, size: 2, chars: 0x2000, bpp: 4, hofs: 0, vofs: 0 },
      { map: 0x1800, size: 2, chars: bg3Chars, bpp: 2, hofs: 0, vofs: -1 },
    ],
    bg3Priority: true,
    objBase: 0x6000,
    main: LAYER_BIT.bg1 | LAYER_BIT.bg2 | LAYER_BIT.bg3 | LAYER_BIT.obj,
    sub: 0,
    math: {
      layers: LAYER_BIT.bg2,
      subtract: true,
      half: false,
      source: 'fixed',
      fixed: [4, 3, 7],
      region: 'inside',
    },
    window,
  };
}

/** Palettes shared by most menus (pre-match, options, training...) */
const MENU_PALETTES = [0x8911, 0x8935, 0x8926, 0x892f, 0x88ea, 0x88ed];

/**
 * Screens the viewer can draw. `loads` = bank $82 load lists in order, `palettes` = bank
 * $81 descriptors in order, `state` = save state the recipe was taken from
 * (research/tools/emu-out), `text` = MENU_SCREENS id of the BG3 text screen.
 * Windows are [first line, lines, left, right] from the HDMA tables of the states.
 */
export const SCREEN_VIEWS = [
  { id: 'title', kind: 'title', state: 'title.st' },
  {
    id: 'mainMenu',
    state: 'mainmenu.st',
    loads: [0x828455, 0x8285b6],
    palettes: [0x890e, 0x8911, 0x8917, 0x891d, 0x8926],
    sprites: 'mainMenu',
    ppu: {
      ...menuPpu({ bg3Chars: 0x5000 }),
      // BG2 minus the blue streaks of BG3 (sub screen), halved
      main: LAYER_BIT.bg2 | LAYER_BIT.obj,
      sub: LAYER_BIT.bg3,
      math: {
        layers: LAYER_BIT.bg2,
        subtract: true,
        half: true,
        source: 'sub',
        fixed: [0, 0, 0],
        region: 'always',
      },
    },
  },
  {
    id: 'prematch',
    state: 'pm.st',
    text: 'prematch',
    loads: [0x8286dc, 0x828321, 0x8284e7, 0x828419, 0x8285b6, 0x8284fe],
    palettes: MENU_PALETTES,
    ppu: menuPpu({
      bg3Chars: 0x5000,
      window: [
        [31, 104, 71, 185],
        [135, 74, 71, 185],
      ],
    }),
  },
  {
    id: 'prematchCup',
    state: 'ws.st',
    text: 'prematchCup',
    loads: [0x8286dc, 0x828321, 0x828531, 0x82824b, 0x8285b6, 0x828552],
    palettes: MENU_PALETTES,
    ppu: menuPpu({
      bg3Chars: 0x5000,
      window: [
        [39, 78, 71, 194],
        [117, 80, 71, 194],
      ],
    }),
  },
  {
    id: 'substitution',
    state: 'premenu.st',
    loads: [0x8286dc, 0x828321, 0x828300, 0x8284c3, 0x8284a7, 0x8286ee, 0x8285b6],
    palettes: [0x8911, 0x8941, 0x8926, 0x8950, 0x8944, 0x89b3, 0x8947],
    ppu: menuPpu({
      window: [
        [31, 112, 151, 240],
        [143, 66, 151, 240],
        [143, 66, 16, 153],
      ],
    }),
  },
  {
    id: 'teamSelect',
    state: 'teamsel.st',
    loads: [0x8286dc, 0x828300, 0x82855b, 0x8286ee, 0x8285b6],
    palettes: [0x8911, 0x890e, 0x8941, 0x8926],
    // description of player 1's team ($80:E2AC at $246)
    overlays: [{ row: 18, col: 6, source: 'teamDescription', team: 'ITALY' }],
    ppu: menuPpu({
      window: [
        [31, 112, 175, 242],
        [143, 66, 175, 242],
        [135, 74, 48, 169],
      ],
    }),
  },
  {
    id: 'options',
    state: 'options.st',
    text: 'options',
    loads: [0x8286dc, 0x828300, 0x82857f, 0x8285b6, 0x8285a0],
    palettes: MENU_PALETTES,
    ppu: menuPpu({
      window: [
        [23, 88, 15, 240],
        [111, 68, 15, 240],
      ],
    }),
  },
  {
    id: 'joypad',
    state: 'joy.st',
    // reached from Options: its list, then the joypad frames over BG1 (1P / 2P are BG1 tiles)
    loads: [0x8286dc, 0x82857f, 0x8285a9, 0x828300, 0x8285b6],
    palettes: [0x8911, 0x8935, 0x892c, 0x8941, 0x8926, 0x8959],
    // button labels of both players, PLAYER CHANGE and the help of the selected button
    overlays: [
      ...['lob', 'pass', 'shoot', 'dash'].flatMap((field, k) =>
        [4, 18].map((col) => ({ row: 4 + k * 2, col, source: 'screen', screen: 'joypad', field })),
      ),
      ...[4, 18].map((col) => ({
        row: 13,
        col,
        source: 'screen',
        screen: 'joypad',
        field: 'playerChange',
      })),
      { row: 18, col: 3, source: 'screen', screen: 'joypad', field: 'namePass' },
      { row: 20, col: 3, source: 'screen', screen: 'joypad', field: 'helpPass' },
    ],
    ppu: menuPpu({
      window: [
        [31, 97, 23, 120],
        [143, 73, 24, 232],
        [31, 97, 135, 232],
      ],
    }),
  },
  {
    id: 'enterPassword',
    state: 'ppw.st',
    text: 'enterPassword',
    loads: [0x8286dc, 0x828300, 0x82883f, 0x8285b6, 0x82886d],
    palettes: [0x8935, 0x8911, 0x8926, 0x895f, 0x88f0],
    ppu: menuPpu({
      window: [
        [39, 58, 31, 233],
        [109, 108, 31, 233],
      ],
    }),
  },
  {
    id: 'trainingIntro',
    state: 'intro.st',
    loads: [0x8286dc, 0x828300, 0x82878e, 0x8287d1, 0x828754, 0x8285b6],
    palettes: MENU_PALETTES,
    // level, title and instructions of the first exercise ($187 / $0812: row 12, col 7, 8 x 18)
    overlays: [
      { row: 6, col: 8, source: 'screen', screen: 'training', field: 'level' },
      { row: 10, col: 7, source: 'trainingTitle', index: 0 },
      { row: 12, col: 7, source: 'trainingIntro', index: 0 },
    ],
    ppu: menuPpu({
      window: [
        [47, 17, 55, 144],
        [79, 92, 55, 200],
      ],
    }),
  },
  {
    id: 'trainingName',
    state: 'tr4.st',
    text: 'trainingName',
    loads: [0x8286dc, 0x828300, 0x82878e, 0x8287af, 0x828754, 0x8285b6, 0x8287b7],
    palettes: MENU_PALETTES,
    ppu: menuPpu({
      window: [
        [47, 89, 72, 176],
        [152, 25, 104, 144],
      ],
    }),
  },
];

// --- Texts drawn by code ---

/**
 * Tilemap words of an overlay (a text the game draws at run time), from the current ROM.
 * @returns {{ words: Uint16Array, columns: number } | null}
 */
export function overlayWords(rom, o, cache = {}) {
  if (o.source === 'screen') {
    const f = SCREEN_TEXTS.find((s) => s.id === o.screen)?.fields.find((x) => x.id === o.field);
    if (!f) return null;
    cache.screens ??= readScreenTexts(rom);
    const res = encodeScreenField(f, cache.screens[o.screen][o.field]);
    if (!res.bytes) return null;
    return f.kind === 'box'
      ? { words: boxWords(rom, res.bytes, f.lines, f.columns), columns: f.columns }
      : { words: fixedWords(rom, res.bytes, f.lines || 1, f.columns), columns: f.columns };
  }
  if (o.source === 'trainingTitle' || o.source === 'trainingIntro') {
    cache.training ??= readTrainingTexts(rom);
    if (o.source === 'trainingTitle') {
      const cols = GAME_TEXTS.TITLE_LENGTH;
      const { codes } = layoutFixed(cache.training.titles[o.index] ?? '', 1, cols);
      return { words: fixedWords(rom, codes, 1, cols), columns: cols };
    }
    const { lines, columns } = GAME_TEXTS.INTRO_BOX;
    const { bytes } = encodeScenarioText(cache.training.intros[o.index] ?? '', columns);
    return { words: boxWords(rom, bytes, lines, columns), columns };
  }
  if (o.source === 'teamDescription') {
    const team = TEAMS.findIndex((t) => t.id === o.team);
    if (team < 0) return null;
    const bytes = readTeamDescriptionRaw(rom, team);
    return {
      words: boxWords(rom, bytes, TEAM_DESC.LINES, TEAM_DESC.COLUMNS),
      columns: TEAM_DESC.COLUMNS,
    };
  }
  return null;
}

/** Where an overlay text is edited (path as in the texts JSON) */
export function overlayLabel(o) {
  if (o.source === 'screen') return `screens.${o.screen}.${o.field}`;
  if (o.source === 'trainingTitle') return `training.titles[${o.index}]`;
  if (o.source === 'trainingIntro') return `training.intros[${o.index}]`;
  if (o.source === 'teamDescription') return `teamDescriptions.${o.team}`;
  return o.source;
}

/** Write the overlays into the BG3 map (blank cells are left as they are) */
function applyOverlays(rom, view, vram, sources) {
  const map = view.ppu.bg[2].map * 2;
  const cache = {};
  for (const o of view.overlays || []) {
    const res = overlayWords(rom, o, cache);
    if (!res) continue;
    const { words, columns } = res;
    for (let k = 0; k < words.length; k++) {
      if (!(words[k] & 0x3ff)) continue;
      const row = o.row + Math.floor(k / columns);
      const col = o.col + (k % columns);
      if (row >= 32 || col >= 32) continue;
      const at = (map + (row * 32 + col) * 2) & 0xffff;
      vram[at] = words[k] & 0xff;
      vram[at + 1] = words[k] >> 8;
      sources.push({ start: at, end: at + 2, overlay: o });
    }
  }
}

// --- PPU ---

/** Tilemap word of a BG at tile (tx, ty) of its map (sizes: 0 32x32, 1 64x32, 2 32x64, 3 64x64) */
function mapAddress(bg, tx, ty) {
  const wide = bg.size & 1;
  const tall = bg.size & 2;
  tx &= wide ? 63 : 31;
  ty &= tall ? 63 : 31;
  let w = (ty & 31) * 32 + (tx & 31);
  if (tx >= 32) w += 0x400;
  if (ty >= 32) w += wide ? 0x800 : 0x400;
  return (bg.map * 2 + w * 2) & 0xffff;
}
function mapWord(vram, bg, tx, ty) {
  const a = mapAddress(bg, tx, ty);
  return vram[a] | (vram[a + 1] << 8);
}

/** Colour index (in CGRAM) and priority of each pixel of a BG layer; -1 = transparent */
function renderBg(vram, bg) {
  const color = new Int16Array(WIDTH * HEIGHT).fill(-1);
  const prio = new Uint8Array(WIDTH * HEIGHT);
  const palSize = bg.bpp === 2 ? 4 : 16;
  for (let y = 0; y < HEIGHT; y++) {
    // VOFS is one line behind the screen: $FFFF (-1) shows map line 0 on the first line
    const ly = y + (bg.vofs ?? -1) + 1;
    for (let x = 0; x < WIDTH; x++) {
      const lx = x + (bg.hofs ?? 0);
      const w = mapWord(vram, bg, lx >> 3, ly >> 3);
      const tile = w & 0x3ff;
      const px = w & 0x4000 ? 7 - (lx & 7) : lx & 7;
      const py = w & 0x8000 ? 7 - (ly & 7) : ly & 7;
      const c = tilePixel(vram, (bg.chars * 2 + tile * bg.bpp * 8) & 0xffff, bg.bpp, px, py);
      if (!c) continue;
      const i = y * WIDTH + x;
      color[i] = ((w >> 10) & 7) * palSize + c;
      prio[i] = (w >> 13) & 1;
    }
  }
  return { color, prio };
}

/** OBJ layer from [x, y, tile, big, palette, hFlip, vFlip, priority] sprites (first = top) */
function renderObj(vram, sprites, objBase) {
  const color = new Int16Array(WIDTH * HEIGHT).fill(-1);
  const prio = new Uint8Array(WIDTH * HEIGHT);
  for (let s = sprites.length - 1; s >= 0; s--) {
    const [sx, sy, tile, big, pal, hf, vf, pr = 3] = sprites[s];
    const n = big ? 2 : 1;
    for (let ty = 0; ty < n; ty++)
      for (let tx = 0; tx < n; tx++) {
        const t = tile + (hf ? n - 1 - tx : tx) + (vf ? n - 1 - ty : ty) * 16;
        const base = (objBase * 2 + (t & 0x1ff) * 32) & 0xffff;
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            const c = tilePixel(vram, base, 4, hf ? 7 - x : x, vf ? 7 - y : y);
            const X = sx + tx * 8 + x;
            const Y = sy + ty * 8 + y;
            if (!c || X < 0 || Y < 0 || X >= WIDTH || Y >= HEIGHT) continue;
            color[Y * WIDTH + X] = 128 + pal * 16 + c;
            prio[Y * WIDTH + X] = pr;
          }
      }
  }
  return { color, prio };
}

/** Mode 1 drawing order, front to back ([layer, priority]) */
function mode1Order(bg3Priority) {
  return [
    ...(bg3Priority ? [['bg3', 1]] : []),
    ['obj', 3],
    ['bg1', 1],
    ['bg2', 1],
    ['obj', 2],
    ['bg1', 0],
    ['bg2', 0],
    ['obj', 1],
    ...(bg3Priority ? [] : [['bg3', 1]]),
    ['obj', 0],
    ['bg3', 0],
  ];
}

/** Is (x, y) inside one of the colour window boxes ([first line, lines, left, right]) */
const inWindow = (boxes, x, y) =>
  boxes.some(([l0, n, left, right]) => y >= l0 && y < l0 + n && x >= left && x <= right);

/**
 * Main menu items: the 8 sprite lists of the pack table (bank $88), around (128, 112),
 * OBJ palette 6 (attr bits 1-3). The selected item's palette is swapped by the game.
 */
export function mainMenuSprites(rom) {
  const pack = SCREEN_TEXT_PACKS.mainMenu;
  const out = [];
  for (let i = 0; i < 8; i++) {
    const at = pack.bank + (word(rom, pack.table + i * 2) - 0x8000);
    for (const e of readSpriteEntries(rom, at))
      out.push([128 + e.dx, 112 + e.dy, e.tile, e.big ? 1 : 0, 6, 0, 0, 3]);
  }
  return out;
}

/**
 * Draw a screen.
 * @param {object} rom - RomParser
 * @param {object} view - SCREEN_VIEWS entry
 * @param {{ layers?: { bg1?: boolean, bg2?: boolean, bg3?: boolean, obj?: boolean, math?: boolean,
 *   texts?: boolean },
 *   scroll?: { bg2?: [number, number] } }} [options] - hide layers / turn colour math off
 * @returns {{ width: number, height: number, data: Uint8ClampedArray, vram: Uint8Array,
 *   cgram: Uint16Array, sources: object[], topLayer: Uint8Array }} topLayer: 0 backdrop, 1-3 BG, 4 OBJ
 */
export function renderScreenView(rom, view, { layers = {}, scroll = {} } = {}) {
  const { vram, sources } = buildScreenVram(rom, view.loads);
  if (layers.texts !== false) applyOverlays(rom, view, vram, sources);
  const cg = buildScreenCgram(rom, view.palettes);
  const ppu = view.ppu;
  const show = (id) => layers[id] !== false;
  const buffers = {};
  const bgs = ['bg1', 'bg2', 'bg3'].map((id, n) => {
    const bg = { ...ppu.bg[n] };
    if (scroll[id]) [bg.hofs, bg.vofs] = scroll[id];
    buffers[id] = show(id) ? renderBg(vram, bg) : null;
    return bg;
  });
  const sprites = view.sprites === 'mainMenu' ? mainMenuSprites(rom) : [];
  buffers.obj = show('obj') && sprites.length ? renderObj(vram, sprites, ppu.objBase) : null;

  const order = mode1Order(ppu.bg3Priority);
  const pick = (mask, i) => {
    for (const [id, p] of order) {
      const b = buffers[id];
      if (!(mask & LAYER_BIT[id]) || !b || b.color[i] < 0 || b.prio[i] !== p) continue;
      return { id, c: b.color[i] };
    }
    return null;
  };
  const math = ppu.math && layers.math !== false ? ppu.math : null;
  const boxes = ppu.window || [];
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  const TOP_CODE = { bg1: 1, bg2: 2, bg3: 3, obj: 4 };
  const topLayer = new Uint8Array(WIDTH * HEIGHT); // 0 = backdrop
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const i = y * WIDTH + x;
      const top = pick(ppu.main, i);
      if (top) topLayer[i] = TOP_CODE[top.id];
      let raw = top ? cg[top.c] : cg[0];
      const layer = top ? top.id : 'back';
      const objMath = layer !== 'obj' || top.c >= 192; // OBJ palettes 4-7 only
      const region =
        !math ||
        math.region === 'always' ||
        (math.region === 'inside' && inWindow(boxes, x, y)) ||
        (math.region === 'outside' && !inWindow(boxes, x, y));
      if (math && region && objMath && math.layers & LAYER_BIT[layer]) {
        let add = math.fixed;
        let half = math.half;
        if (math.source === 'sub') {
          const sub = pick(ppu.sub, i);
          if (sub) add = [cg[sub.c] & 31, (cg[sub.c] >> 5) & 31, (cg[sub.c] >> 10) & 31];
          else half = false; // the fixed colour backdrop of the sub screen is not halved
        }
        const ch = [raw & 31, (raw >> 5) & 31, (raw >> 10) & 31].map((v, k) => {
          let r = math.subtract ? v - add[k] : v + add[k];
          if (half) r >>= 1;
          return Math.max(0, Math.min(31, r));
        });
        raw = ch[0] | (ch[1] << 5) | (ch[2] << 10);
      }
      data[i * 4] = (raw & 31) << 3;
      data[i * 4 + 1] = ((raw >> 5) & 31) << 3;
      data[i * 4 + 2] = ((raw >> 10) & 31) << 3;
      data[i * 4 + 3] = 255;
    }
  return { width: WIDTH, height: HEIGHT, data, vram, cgram: cg, sources, topLayer, bgs };
}

/**
 * Tiles of a VRAM area drawn in a grid with one palette (tile explorer).
 * @param {{ chars: number, bpp: 2|4, palette: number, count?: number, columns?: number,
 *   obj?: boolean }} opts - chars: VRAM word address; palette: row (BG) or OBJ row 0-7
 * @returns {{ width: number, height: number, data: Uint8ClampedArray, columns: number }}
 */
export function renderTileSheet(
  vram,
  cgram,
  { chars, bpp, palette, count = 256, columns = 16, obj = false },
) {
  const rows = Math.ceil(count / columns);
  const width = columns * 8;
  const height = rows * 8;
  const data = new Uint8ClampedArray(width * height * 4);
  const palSize = bpp === 2 ? 4 : 16;
  const first = obj ? 128 + palette * 16 : palette * palSize;
  for (let t = 0; t < count; t++) {
    const base = (chars * 2 + t * bpp * 8) & 0xffff;
    const ox = (t % columns) * 8;
    const oy = Math.floor(t / columns) * 8;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const c = tilePixel(vram, base, bpp, x, y);
        const i = ((oy + y) * width + ox + x) * 4;
        // colour 0 (transparent) as a checker, so empty tiles are visible
        const raw = c ? cgram[first + c] : (x ^ y) & 4 ? 0x2108 : 0x1084;
        data[i] = (raw & 31) << 3;
        data[i + 1] = ((raw >> 5) & 31) << 3;
        data[i + 2] = ((raw >> 10) & 31) << 3;
        data[i + 3] = 255;
      }
  }
  return { width, height, data, columns };
}

/**
 * What is under a pixel of a rendered screen: the visible layer and, for each BG, the
 * tilemap word, the tile and the ROM blocks the tile and the map cell came from (to find
 * where a graphic lives).
 * @returns {{ top: 'back'|'bg1'|'bg2'|'bg3'|'obj', layers: object[] }}
 */
export function inspectScreenPixel(rendered, x, y) {
  const { vram, sources, bgs, topLayer } = rendered;
  const from = (a) => [...sources].reverse().find((s) => a >= s.start && a < s.end) || null;
  const top = ['back', 'bg1', 'bg2', 'bg3', 'obj'][topLayer[y * WIDTH + x]];
  const layers = bgs.map((bg, n) => {
    const ly = y + (bg.vofs ?? -1) + 1;
    const lx = x + (bg.hofs ?? 0);
    const mapAt = mapAddress(bg, lx >> 3, ly >> 3);
    const w = vram[mapAt] | (vram[mapAt + 1] << 8);
    const tile = w & 0x3ff;
    const charAt = (bg.chars * 2 + tile * bg.bpp * 8) & 0xffff;
    return {
      layer: `bg${n + 1}`,
      bpp: bg.bpp,
      chars: bg.chars,
      word: w,
      tile,
      palette: (w >> 10) & 7,
      priority: (w >> 13) & 1,
      vramTile: charAt >> 1,
      vramMap: mapAt >> 1,
      tileSource: from(charAt),
      mapSource: from(mapAt),
    };
  });
  return { top, layers };
}
