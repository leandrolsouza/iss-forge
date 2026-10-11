/**
 * Screen texts — fixed texts drawn by code (joypad controls, scenario screen,
 * cup group line, World Series ordinals, training "LEVEL").
 *
 * See SCREEN_TEXTS in constants.js and research/game-texts.md.
 */
import { SCREEN_TEXTS, SCREEN_TEXT_PACKS, SCREEN_TEXT_RANGES, MENU_SCREENS } from './constants';
import { decodeIss, encodeIss, layoutFixed, findInvalidBoxChars } from './gameTexts';
import { decodeScenarioText, encodeScenarioText } from './scenario';
import {
  layoutSpriteText,
  encodeSpriteEntries,
  readSpriteEntries,
  decodeSpriteEntries,
  menuSpriteFont,
  installedMenuGlyphs,
  menuFontNeeds,
  writeMenuFont,
} from './menuSprites';
import { readTitleText, checkTitleText, writeTitleScreen } from './titleScreens';

const BANK_FILE_BASE = 0x10000; // bank $02
const PALETTE = 0xfe; // FE xx: palette of the next cells (takes no cell)
const LOW_DOT = 0x55;

const word = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
const writeWord = (rom, a, v) => {
  rom.writeByte(a, v & 0xff);
  rom.writeByte(a + 1, (v >> 8) & 0xff);
};
const toFile = (ptr, bank = BANK_FILE_BASE) => bank + (ptr - 0x8000);
const toPtr = (file, bank = BANK_FILE_BASE) => file - bank + 0x8000;

/** File offset of a field (direct, through a word table, or through its pack table) */
export function screenFieldAddress(rom, field) {
  if (field.pack) {
    const pack = SCREEN_TEXT_PACKS[field.pack];
    return toFile(word(rom, pack.table + field.index * 2), pack.bank);
  }
  if (field.table !== undefined) return toFile(word(rom, field.table + field.index * 2));
  return field.at;
}

/** Bytes a packed field takes now in the ROM (sprite lists keep their exact bytes when unchanged) */
function currentSpriteBytes(rom, field) {
  const addr = screenFieldAddress(rom, field);
  return Array.from(rom.readBytes(addr, 1 + rom.readByte(addr) * 4));
}

// --- Cells (FE xx takes no cell) ---

function readCells(rom, addr, columns) {
  let text = '';
  let p = addr;
  for (let cells = 0; cells < columns;) {
    const b = rom.readByte(p);
    if (b === PALETTE) {
      text += decodeIss([b, rom.readByte(p + 1)]);
      p += 2;
      continue;
    }
    text += decodeIss([b]);
    p++;
    cells++;
  }
  return text;
}

/** Text -> { codes, cells, invalid }; {fe}{xx} keeps its byte and takes no cell */
export function encodeCells(text) {
  const { codes, invalid } = encodeIss(text);
  let cells = 0;
  for (let i = 0; i < codes.length; i++) {
    if (codes[i] === PALETTE) i++;
    else cells++;
  }
  return { codes, cells, invalid };
}

/** Visible cells of a fixed text (palette codes excluded) */
export const screenTextCells = (text) => encodeCells(text).cells;

// --- Read ---

function readField(rom, field, font) {
  if (field.kind === 'title') return readTitleText(rom, field.offset);
  const addr = screenFieldAddress(rom, field);
  switch (field.kind) {
    case 'sprite':
      return decodeSpriteEntries(readSpriteEntries(rom, addr), font);
    case 'box':
      return decodeScenarioText(rom, addr, field);
    case 'label':
      return readCells(rom, addr, field.columns).replace(/[, ]+$/, '');
    case 'repeat':
      return readCells(rom, addr, field.columns).replace(/ +$/, '');
    default: {
      const lines = [];
      for (let l = 0; l < (field.lines || 1); l++) {
        lines.push(readCells(rom, addr + l * field.columns, field.columns).replace(/ +$/, ''));
      }
      while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
      return lines.join('\n');
    }
  }
}

/** { screenId: { fieldId: text } } */
export function readScreenTexts(rom) {
  const font = menuSpriteFont(installedMenuGlyphs(rom));
  return Object.fromEntries(
    SCREEN_TEXTS.map((s) => [
      s.id,
      Object.fromEntries(s.fields.map((f) => [f.id, readField(rom, f, font)])),
    ]),
  );
}

// --- Encode / validate ---

/**
 * Bytes of a field, or an error:
 *   tooLong (cells > columns), tooManyLines, noRoom (bytes > room)
 * @returns {{ bytes?: number[], error?: string, cells?: number, lineCount?: number, invalid: string[] }}
 */
export function encodeScreenField(field, text) {
  const value = String(text ?? '');
  if (field.kind === 'title') return checkTitleText(value);
  if (field.kind === 'sprite') {
    const res = layoutSpriteText(value, field);
    const bytes = encodeSpriteEntries(res.entries);
    const out = { bytes, invalid: res.invalid, right: res.right, sprites: res.entries.length };
    if (res.error) out.error = res.error;
    else if (res.invalid.length) out.error = 'noGlyph';
    return out;
  }
  if (field.kind === 'box') {
    const { bytes, lineCount } = encodeScenarioText(value, field.columns);
    const invalid = findInvalidBoxChars(value);
    if (lineCount > field.lines) return { error: 'tooManyLines', lineCount, invalid };
    if (field.room && bytes.length > field.room) return { error: 'noRoom', bytes, invalid };
    return { bytes, lineCount, invalid };
  }
  if (field.lines > 1) {
    const { codes, overflow } = layoutFixed(value, field.lines, field.columns);
    const invalid = encodeIss(value.replace(/\n/g, '')).invalid;
    if (overflow) return { error: 'tooManyLines', invalid };
    return { bytes: codes, invalid };
  }
  const { codes, cells, invalid } = encodeCells(value.replace(/\n/g, ' '));
  if (cells > field.columns) return { error: 'tooLong', cells, invalid };
  const pad = field.kind === 'label' ? LOW_DOT : 0x00;
  const bytes = [...codes];
  for (let c = cells; c < field.columns; c++) bytes.push(pad);
  const room = field.room ?? field.columns;
  if (bytes.length > room) return { error: 'noRoom', bytes, cells, invalid };
  while (bytes.length < room) bytes.push(0x00);
  return { bytes, cells, invalid };
}

/** Bytes used / available by each pack */
export function measureScreenPacks(texts) {
  const out = {};
  for (const [id, pack] of Object.entries(SCREEN_TEXT_PACKS)) {
    let used = 0;
    for (const s of SCREEN_TEXTS) {
      for (const f of s.fields) {
        if (f.pack !== id) continue;
        const text = String(texts?.[s.id]?.[f.id] ?? '');
        used +=
          f.kind === 'sprite'
            ? encodeScreenField(f, text).bytes.length
            : encodeScenarioText(text, f.columns).bytes.length;
      }
    }
    out[id] = { used, capacity: pack.area[1] - pack.area[0] };
  }
  return out;
}

/** Problems that block writing: [{ screen, field, error }] (error 'packFull' has no field) */
export function validateScreenTexts(texts) {
  const issues = [];
  for (const s of SCREEN_TEXTS) {
    for (const f of s.fields) {
      const res = encodeScreenField(f, texts?.[s.id]?.[f.id]);
      if (res.error) issues.push({ screen: s.id, field: f.id, error: res.error });
    }
  }
  for (const [id, m] of Object.entries(measureScreenPacks(texts))) {
    if (m.used > m.capacity) issues.push({ pack: id, error: 'packFull', ...m });
  }
  // An extra letter of the menu font takes the tiles of another one: not both
  for (const [extra, replaced] of menuFontNeeds(mainMenuTexts(texts)).conflicts) {
    issues.push({ screen: 'mainMenu', error: 'fontConflict', letters: [extra, replaced] });
  }
  return issues;
}

const mainMenuTexts = (texts) =>
  SCREEN_TEXTS.find((s) => s.id === 'mainMenu').fields.map((f) =>
    String(texts?.mainMenu?.[f.id] ?? ''),
  );

// --- Write ---

/**
 * Write every screen text. In-place texts keep their address; the texts of a
 * pack are re-packed in its area and its word table updated.
 * @returns {{ ok: boolean, issues?: object[] }}
 */
export function writeScreenTexts(rom, texts) {
  const issues = validateScreenTexts(texts);
  if (issues.length) return { ok: false, error: 'screenTextsInvalid', issues };

  const current = readScreenTexts(rom);
  const packs = {};
  const titles = [];
  for (const s of SCREEN_TEXTS) {
    for (const f of s.fields) {
      if (f.kind === 'title') {
        if (texts[s.id][f.id] !== current[s.id][f.id]) titles.push({ s, f });
        continue;
      }
      let { bytes } = encodeScreenField(f, texts[s.id][f.id]);
      // An unchanged menu item keeps its original sprite list (hand-kerned by Konami)
      if (f.kind === 'sprite' && texts[s.id][f.id] === current[s.id][f.id]) {
        bytes = currentSpriteBytes(rom, f);
      }
      if (f.pack) {
        (packs[f.pack] ||= []).push({ f, bytes });
        continue;
      }
      const addr = screenFieldAddress(rom, f);
      if (f.kind === 'box') {
        const room = new Array(f.room).fill(0xff);
        bytes.forEach((b, i) => (room[i] = b));
        rom.writeBytes(addr, room);
      } else if (f.kind === 'repeat') {
        for (let k = 0; k < f.count; k++) rom.writeBytes(addr + k * f.columns, bytes);
      } else {
        rom.writeBytes(addr, bytes);
        if (f.mirror) rom.writeBytes(addr + f.mirror, bytes);
      }
    }
  }
  for (const [id, items] of Object.entries(packs)) {
    const pack = SCREEN_TEXT_PACKS[id];
    // every list is read before writing (unchanged lists may move)
    let p = pack.area[0];
    for (const { f, bytes } of items.sort((a, b) => a.f.index - b.f.index)) {
      writeWord(rom, pack.table + f.index * 2, toPtr(p, pack.bank));
      rom.writeBytes(p, bytes);
      p += bytes.length;
    }
    rom.writeBytes(p, new Array(pack.area[1] - p).fill(0xff));
  }
  // Menu font: draw the extra letters the items need (put the original ones back otherwise)
  const install = menuFontNeeds(mainMenuTexts(texts)).install;
  if (install.join() !== installedMenuGlyphs(rom).join()) {
    const res = writeMenuFont(rom, install);
    if (!res.ok)
      return { ok: false, error: 'menuFontFull', issues: [{ error: 'menuFontFull', ...res }] };
  }
  // Titles are compressed tilemaps placed like the menu screens (may move)
  const failed = [];
  const moved = [];
  for (const { s, f } of titles) {
    const res = writeTitleScreen(rom, f.offset, texts[s.id][f.id]);
    if (!res.ok)
      failed.push({ screen: s.id, field: f.id, error: res.error || 'titleNoRoom', ...res });
    else if (res.moved) moved.push(MENU_SCREENS.find((m) => m.offset === f.offset)?.id ?? f.id);
  }
  if (failed.length) return { ok: false, error: 'titleNoRoom', issues: failed, moved };
  return { ok: true, moved };
}

// --- Undo ---

export function readScreenTextBytes(rom) {
  return SCREEN_TEXT_RANGES.map(([s, e]) => Array.from(rom.readBytes(s, e - s)));
}

export function restoreScreenTextBytes(rom, snap) {
  if (!Array.isArray(snap)) return;
  SCREEN_TEXT_RANGES.forEach(([s], i) => snap[i] && rom.writeBytes(s, snap[i]));
}
