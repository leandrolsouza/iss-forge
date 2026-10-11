/**
 * Menu screens — text inside the compressed 32x32 tilemaps
 *
 * See MENU_SCREENS in constants.js and research/game-texts.md.
 */
import { MENU_SCREENS, MENU_FREE_SPACE, FONT16_TABLE, FONT16_EXTRA_PAIRS } from './constants';
import { konamiDecompress, konamiCompress } from './KonamiCodec';
import { decodeIss, encodeIss } from './gameTexts';

const COLS = 32;
const ROWS = 32;
const TILE = 0x3ff;

/** Tile pair of a character code (table $82:8AF4) */
function codePair(rom, code) {
  const add = code * 2 < 0x10c ? 0x30 : 0x110;
  return [
    rom.readByte(FONT16_TABLE + code * 2) + add,
    rom.readByte(FONT16_TABLE + code * 2 + 1) + add,
  ];
}

/** "top,bottom" -> text (single char or token) for every glyph of the font */
function pairMap(rom) {
  const map = {};
  for (let code = 0x52; code < 0xa0; code++) {
    const ch = decodeIss([code]);
    if (/^\{[0-9a-f]{2}\}$/.test(ch)) continue; // no glyph
    const key = codePair(rom, code).join(',');
    if (!map[key]) map[key] = ch;
  }
  return { ...FONT16_EXTRA_PAIRS, ...map };
}

/** Decode one screen: 1024 tilemap words (follows the pointer of a moved screen) */
export function readScreenWords(rom, offset, follow = true) {
  const screen = follow && rom.readByte ? screenById(offset) : null;
  const at = screen ? screenLocation(rom, screen) : offset;
  const out = konamiDecompress(
    rom.getRomData ? rom.getRomData() : rom,
    at + (rom.headerOffset || 0),
  );
  const words = new Uint16Array(COLS * ROWS);
  for (let i = 0; i < words.length; i++) words[i] = out[i * 2] | (out[i * 2 + 1] << 8);
  return words;
}

/**
 * Text runs of a screen. A run is a row of glyph cells (single blank cells
 * allowed between words). maxLength includes the blank cells after it.
 */
export function findTextRuns(words, map, edge) {
  const tile = (r, c) => (r < ROWS ? words[r * COLS + c] & TILE : 0);
  const glyph = (r, c) => map[`${tile(r, c)},${tile(r + 1, c)}`];
  const blank = (r, c) => tile(r, c) === 0 && tile(r + 1, c) === 0;
  const used = new Set();
  const runs = [];
  for (let r = 0; r < ROWS - 1; r++) {
    let c = 0;
    while (c < COLS) {
      if (used.has(r * COLS + c) || !glyph(r, c)) {
        c++;
        continue;
      }
      const start = c;
      let text = '';
      let end = c;
      while (c < COLS) {
        const g = glyph(r, c);
        if (g) {
          text += g;
          end = c + 1;
          c++;
        } else if (blank(r, c) && c + 1 < COLS && glyph(r, c + 1)) {
          text += ' ';
          c++;
        } else break;
      }
      const letters = text.replace(/[^A-Za-z0-9]/g, '').length;
      if (letters >= 2 || (letters >= 1 && end - start >= 2)) {
        runs.push({ row: r, col: start, length: end - start, maxLength: end - start, text });
        for (let k = start; k < end; k++) used.add((r + 1) * COLS + k);
      }
      c = Math.max(c, end) + 1;
    }
  }
  // Free room: window frames are drawn on another layer, so empty cells can lie
  // outside the visible box. A run may only grow up to the right edge of the
  // screen's text block (+2 cells), over cells that are empty on both rows, and
  // keeps one empty cell before whatever comes next (e.g. "TIME PER HALF  3.5.7").
  const rightEdge =
    edge ?? Math.min(COLS - 1, Math.max(0, ...runs.map((x) => x.col + x.length)) + 2);
  for (const run of runs) {
    const free = (c) => c >= rightEdge || blank(run.row, c);
    while (
      run.col + run.maxLength < rightEdge &&
      blank(run.row, run.col + run.maxLength) &&
      free(run.col + run.maxLength + 1)
    ) {
      run.maxLength++;
    }
  }
  // "1ST SEASON", "1ST STAGE ...": the game draws the ordinal (1ST, 2ND, ...) over
  // the first 3 cells at run time, so only the text after it is editable
  for (const run of runs) {
    const m = /^(1ST|2ND) /.exec(run.text);
    if (!m) continue;
    const skip = m[0].length;
    run.col += skip;
    run.length -= skip;
    run.maxLength -= skip;
    run.text = run.text.slice(skip);
    run.prefix = m[1];
  }
  return runs;
}

/**
 * Text runs of a screen as it is now. The layout (position, room) always comes
 * from the screen as loaded, so it does not change after edits (a longer text
 * could otherwise touch the next one and be read as a single run); only the
 * letters are read from the current tilemap.
 */
function screenRuns(rom, offset, map, words) {
  const orig = rom.getOriginalData ? rom.getOriginalData() : null;
  const origWords = orig
    ? readScreenWords({ getRomData: () => orig, headerOffset: rom.headerOffset }, offset, false)
    : words;
  const layout = findTextRuns(origWords, map, COLS - 1);
  const edge = Math.min(COLS - 1, Math.max(0, ...layout.map((x) => x.col + x.length)) + 2);
  return findTextRuns(origWords, map, edge).map((run) => ({
    ...run,
    original: run.text,
    text: decodeCells(words, map, run.row, run.col, run.maxLength).replace(/ +$/, ''),
  }));
}

/** Text of `count` cells starting at (row, col); unknown tile pairs become {??} */
function decodeCells(words, map, row, col, count) {
  let s = '';
  for (let c = col; c < col + count; c++) {
    const top = words[row * COLS + c] & TILE;
    const bottom = words[(row + 1) * COLS + c] & TILE;
    s += top === 0 && bottom === 0 ? ' ' : (map[`${top},${bottom}`] ?? '{??}');
  }
  return s;
}

/** All menu screens with their text runs (title screens are edited elsewhere) */
export function readMenuScreens(rom) {
  const map = pairMap(rom);
  return MENU_SCREENS.filter((s) => !s.title).map((s) => {
    const words = readScreenWords(rom, s.offset);
    return { ...s, ...screenSlot(rom, s.offset), runs: screenRuns(rom, s.offset, map, words) };
  });
}

/** Split text into cells (tokens such as {1S} count as one cell) */
function cells(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      const end = text.indexOf('}', i);
      if (end > i) {
        out.push(text.slice(i, end + 1));
        i = end;
        continue;
      }
    }
    out.push(text[i]);
  }
  return out;
}

export const menuTextLength = (text) => cells(text).length;

/** Characters without a glyph */
export const findInvalidMenuChars = (text) => encodeIss(text).invalid;

/**
 * Build the new tilemap of a screen. `texts` maps run index -> new text.
 * Cells that keep their character keep the original tile words.
 */
export function buildScreenWords(rom, offset, texts) {
  const map = pairMap(rom);
  const words = readScreenWords(rom, offset);
  const runs = screenRuns(rom, offset, map, words);
  for (const [k, text] of Object.entries(texts)) {
    const run = runs[Number(k)];
    if (!run || text === run.text) continue;
    const before = cells(run.text);
    const after = cells(text);
    if (after.length > run.maxLength) throw new Error('menuTextTooLong');
    // Palette + priority of the run; flip bits are per tile (the "T" variant is a
    // flipped tile) and must not leak into the new characters
    const attr = words[run.row * COLS + run.col] & 0x3c00;
    for (let i = 0; i < run.maxLength; i++) {
      const ch = after[i] ?? ' ';
      if (ch === (before[i] ?? ' ')) continue;
      const top = run.row * COLS + run.col + i;
      const bottom = top + COLS;
      if (ch === ' ') {
        words[top] = attr;
        words[bottom] = attr;
        continue;
      }
      const code = encodeIss(ch).codes[0];
      const [t, b] = codePair(rom, code);
      words[top] = attr | t;
      words[bottom] = attr | b;
    }
  }
  return words;
}

// --- Location of each screen (screens can be moved to free space) ---

const screenById = (offset) => MENU_SCREENS.find((s) => s.offset === offset);
const blockSize = (rom, at) => (rom.readByte(at) | (rom.readByte(at + 1) << 8)) & 0x7fff;

function pointerTarget(rom, p) {
  const lo = rom.readByte(p);
  const hi = rom.readByte(p + 1);
  const bank = rom.readByte(p + 2) & 0x7f;
  return bank * 0x8000 + ((lo | (hi << 8)) - 0x8000);
}

function writePointer(rom, p, fileOffset) {
  const addr = (fileOffset & 0x7fff) | 0x8000;
  rom.writeByte(p, addr & 0xff);
  rom.writeByte(p + 1, addr >> 8);
  rom.writeByte(p + 2, (fileOffset >> 15) | 0x80);
}

/** Current file offset of a screen (follows its pointer when it was moved) */
export function screenLocation(rom, screen) {
  return screen.pointers?.length ? pointerTarget(rom, screen.pointers[0]) : screen.offset;
}

/** Room of the original slot (block + trailing 0xFF), measured on the ROM as loaded */
function originalCapacity(rom, screen) {
  const orig = rom.getOriginalData ? rom.getOriginalData() : null;
  const at = (a) => (orig ? orig[a + (rom.headerOffset || 0)] : rom.readByte(a));
  let capacity = (at(screen.offset) | (at(screen.offset + 1) << 8)) & 0x7fff;
  while (capacity < 0x1000 && at(screen.offset + capacity) === 0xff) capacity++;
  return capacity;
}

/** Areas where moved screens may live: free padding + original slots of moved screens */
function relocationRegions(rom) {
  const regions = MENU_FREE_SPACE.map(([s, e]) => [s, e]);
  for (const s of MENU_SCREENS) {
    if (s.pointers.length && screenLocation(rom, s) !== s.offset) {
      regions.push([s.offset, s.offset + originalCapacity(rom, s)]);
    }
  }
  return regions;
}

/** [start, end) used by every screen except `skip` */
function usedIntervals(rom, skip) {
  return MENU_SCREENS.filter((s) => s !== skip).map((s) => {
    const at = screenLocation(rom, s);
    return [at, at + (at === s.offset ? originalCapacity(rom, s) : blockSize(rom, at))];
  });
}

/** Free intervals of the relocation regions (largest first) */
function freeIntervals(rom, skip) {
  const used = usedIntervals(rom, skip).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [rs, re] of relocationRegions(rom)) {
    let p = rs;
    for (const [us, ue] of used) {
      if (ue <= p || us >= re) continue;
      if (us > p) out.push([p, us]);
      p = Math.max(p, ue);
    }
    if (p < re) out.push([p, re]);
  }
  return out.sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
}

const overlaps = (a, b) => a[0] < b[1] && b[0] < a[1];

/** Room available where the screen is now (without moving it) */
function currentCapacity(rom, screen) {
  const at = screenLocation(rom, screen);
  if (at === screen.offset) return originalCapacity(rom, screen);
  const free = freeIntervals(rom, screen).find(([s, e]) => s <= at && at < e);
  return free ? free[1] - at : blockSize(rom, at);
}

function screenSlot(rom, offset) {
  const screen = screenById(offset) || { offset, pointers: [] };
  const location = screenLocation(rom, screen);
  return {
    location,
    moved: location !== offset,
    size: blockSize(rom, location),
    capacity: currentCapacity(rom, screen),
  };
}

/** Compress the screen with new texts (no write) */
function packScreen(rom, offset, texts) {
  return packScreenWords(buildScreenWords(rom, offset, texts));
}

/**
 * Write the texts of one screen. When the result no longer fits, a screen with
 * known pointers is moved to free space (best fit) and its pointers updated;
 * it moves back to its original slot as soon as it fits there again.
 * @returns {{ ok: boolean, error?: string, size: number, capacity: number, moved?: boolean }}
 */
export function writeMenuScreen(rom, offset, texts) {
  const screen = screenById(offset) || { offset, pointers: [] };
  let packed;
  try {
    packed = packScreen(rom, offset, texts);
  } catch (e) {
    return { ok: false, error: e.message, size: 0, capacity: currentCapacity(rom, screen) };
  }
  return placeScreenBlock(rom, offset, packed);
}

/** Compress a full tilemap (1024 words) */
export function packScreenWords(words) {
  const raw = new Uint8Array(words.length * 2);
  words.forEach((w, i) => {
    raw[i * 2] = w & 0xff;
    raw[i * 2 + 1] = w >> 8;
  });
  return konamiCompress(raw);
}

/**
 * Write a compressed block for a screen of MENU_SCREENS: in its slot, where it
 * is now, in free space or after re-arranging every movable screen.
 */
export function placeScreenBlock(rom, offset, packed) {
  const screen = screenById(offset) || { offset, pointers: [] };
  const n = packed.length;
  const here = screenLocation(rom, screen);
  const write = (at) => {
    rom.writeBytes(at, packed);
    if (at !== here) screen.pointers.forEach((p) => writePointer(rom, p, at));
    return { ok: true, size: n, capacity: currentCapacity(rom, screen), moved: at !== offset };
  };

  // 1. Back home (or still home) when it fits in the original slot
  const home = [offset, offset + originalCapacity(rom, screen)];
  const homeFree = !usedIntervals(rom, screen).some((u) => overlaps(u, home));
  if (n <= home[1] - home[0] && homeFree) return write(offset);
  // 2. Where it is now
  if (here !== offset && n <= currentCapacity(rom, screen)) return write(here);
  // 3. Somewhere else
  if (screen.pointers.length) {
    const fit = freeIntervals(rom, screen)
      .filter(([s, e]) => e - s >= n)
      .sort((a, b) => a[1] - a[0] - (b[1] - b[0]))[0];
    if (fit) return write(fit[0]);
    // 4. Rearrange every movable screen at once (earlier moves may block the space)
    if (repackScreens(rom, { [offset]: packed })) {
      const at = screenLocation(rom, screen);
      return {
        ok: true,
        size: n,
        capacity: currentCapacity(rom, screen),
        moved: at !== offset,
        repacked: true,
      };
    }
  }
  const best = screen.pointers.length
    ? Math.max(currentCapacity(rom, screen), ...freeIntervals(rom, screen).map(([s, e]) => e - s))
    : currentCapacity(rom, screen);
  return { ok: false, error: 'menuScreenFull', size: n, capacity: best };
}

/**
 * Place every movable screen again (bin packing over their original slots and
 * the free areas). Screens stay home whenever possible. `override` maps a
 * screen offset to its new packed bytes.
 * @returns {boolean} false when no arrangement fits (nothing is written)
 */
function repackScreens(rom, override = {}) {
  const movable = MENU_SCREENS.filter((s) => s.pointers.length);
  const items = movable.map((s) => {
    const at = screenLocation(rom, s);
    const bytes = override[s.offset] ?? rom.readBytes(at, blockSize(rom, at));
    return { screen: s, bytes: Uint8Array.from(bytes) };
  });
  const bins = [
    ...movable.map((s) => ({ start: s.offset, cap: originalCapacity(rom, s), home: s })),
    ...MENU_FREE_SPACE.map(([s, e]) => ({ start: s, cap: e - s, home: null })),
  ];
  const free = bins.map((b) => b.cap);
  const order = [...items].sort((a, b) => b.bytes.length - a.bytes.length);
  const choice = new Map();
  let steps = 0;
  const place = (i) => {
    if (i === order.length) return true;
    if (++steps > 200000) return false;
    const it = order[i];
    const n = it.bytes.length;
    const candidates = bins
      .map((b, k) => k)
      .filter((k) => free[k] >= n)
      .sort((a, b) => {
        const ha = bins[a].home === it.screen ? 0 : 1;
        const hb = bins[b].home === it.screen ? 0 : 1;
        return ha - hb || free[a] - free[b];
      });
    for (const k of candidates) {
      free[k] -= n;
      choice.set(it, k);
      if (place(i + 1)) return true;
      free[k] += n;
    }
    return false;
  };
  if (!place(0)) return false;

  // Write: every block is already in memory, so overlapping old/new places are safe
  const cursor = bins.map((b) => b.start);
  // Within a bin, the home screen goes first (keeps it at its original offset)
  const sorted = [...order].sort(
    (a, b) =>
      (bins[choice.get(a)].home === a.screen ? -1 : 0) -
      (bins[choice.get(b)].home === b.screen ? -1 : 0),
  );
  for (const it of sorted) {
    const k = choice.get(it);
    const at = cursor[k];
    cursor[k] += it.bytes.length;
    rom.writeBytes(at, it.bytes);
    it.screen.pointers.forEach((p) => writePointer(rom, p, at));
  }
  return true;
}

/**
 * Write several screens, letting moved screens free their slot for the others.
 * @param {{ offset: number, texts: object }[]} changes
 * @returns {Map<number, object>} offset -> result of writeMenuScreen
 */
export function writeMenuScreens(rom, changes) {
  const results = new Map();
  let pending = [...changes];
  // Largest first: big screens take the big free areas, smaller ones use the slots they leave
  const sizeOf = (c) => {
    try {
      return packScreen(rom, c.offset, c.texts).length;
    } catch {
      return 0;
    }
  };
  pending.sort((a, b) => sizeOf(b) - sizeOf(a));
  let progress = true;
  while (pending.length && progress) {
    progress = false;
    const next = [];
    for (const c of pending) {
      const res = writeMenuScreen(rom, c.offset, c.texts);
      results.set(c.offset, res);
      if (res.ok) progress = true;
      else if (res.error === 'menuScreenFull') next.push(c);
    }
    pending = next;
  }
  return results;
}

// --- Undo ---

const UNDO_RANGES = () => [
  ...MENU_SCREENS.map((s) => [s.offset, null]),
  ...MENU_FREE_SPACE,
  ...MENU_SCREENS.flatMap((s) => s.pointers.map((p) => [p, p + 3])),
];

/** Raw bytes of every slot, free area and pointer (for undo) */
export function readMenuScreenBytes(rom) {
  return UNDO_RANGES().map(([s, e]) => {
    const end = e ?? s + originalCapacity(rom, screenById(s));
    return Array.from(rom.readBytes(s, end - s));
  });
}

export function restoreMenuScreenBytes(rom, snap) {
  if (!Array.isArray(snap)) return;
  UNDO_RANGES().forEach(([s], i) => snap[i] && rom.writeBytes(s, snap[i]));
}
