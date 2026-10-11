/**
 * Screen texts — fixed texts drawn by code (joypad controls, scenario screen,
 * cup group line, World Series ordinals, training "LEVEL").
 *
 * See SCREEN_TEXTS in constants.js and research/game-texts.md.
 */
import { SCREEN_TEXTS, SCREEN_TEXT_PACKS, SCREEN_TEXT_RANGES } from './constants';
import { decodeIss, encodeIss, layoutFixed, findInvalidBoxChars } from './gameTexts';
import { decodeScenarioText, encodeScenarioText } from './scenario';

const BANK_FILE_BASE = 0x10000; // bank $02
const PALETTE = 0xfe; // FE xx: palette of the next cells (takes no cell)
const LOW_DOT = 0x55;

const word = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
const writeWord = (rom, a, v) => {
  rom.writeByte(a, v & 0xff);
  rom.writeByte(a + 1, (v >> 8) & 0xff);
};
const toFile = (ptr) => BANK_FILE_BASE + (ptr - 0x8000);
const toPtr = (file) => file - BANK_FILE_BASE + 0x8000;

/** File offset of a field (direct, through a word table, or through its pack table) */
export function screenFieldAddress(rom, field) {
  if (field.pack) return toFile(word(rom, SCREEN_TEXT_PACKS[field.pack].table + field.index * 2));
  if (field.table !== undefined) return toFile(word(rom, field.table + field.index * 2));
  return field.at;
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

function readField(rom, field) {
  const addr = screenFieldAddress(rom, field);
  switch (field.kind) {
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
  return Object.fromEntries(
    SCREEN_TEXTS.map((s) => [
      s.id,
      Object.fromEntries(s.fields.map((f) => [f.id, readField(rom, f)])),
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
        used += encodeScenarioText(String(texts?.[s.id]?.[f.id] ?? ''), f.columns).bytes.length;
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
  return issues;
}

// --- Write ---

/**
 * Write every screen text. In-place texts keep their address; the texts of a
 * pack are re-packed in its area and its word table updated.
 * @returns {{ ok: boolean, issues?: object[] }}
 */
export function writeScreenTexts(rom, texts) {
  const issues = validateScreenTexts(texts);
  if (issues.length) return { ok: false, error: 'screenTextsInvalid', issues };

  const packs = {};
  for (const s of SCREEN_TEXTS) {
    for (const f of s.fields) {
      const { bytes } = encodeScreenField(f, texts[s.id][f.id]);
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
    let p = pack.area[0];
    for (const { f, bytes } of items.sort((a, b) => a.f.index - b.f.index)) {
      writeWord(rom, pack.table + f.index * 2, toPtr(p));
      rom.writeBytes(p, bytes);
      p += bytes.length;
    }
    rom.writeBytes(p, new Array(pack.area[1] - p).fill(0xff));
  }
  return { ok: true };
}

// --- Undo ---

export function readScreenTextBytes(rom) {
  return SCREEN_TEXT_RANGES.map(([s, e]) => Array.from(rom.readBytes(s, e - s)));
}

export function restoreScreenTextBytes(rom, snap) {
  if (!Array.isArray(snap)) return;
  SCREEN_TEXT_RANGES.forEach(([s], i) => snap[i] && rom.writeBytes(s, snap[i]));
}
