/**
 * Game texts — training mode (intros, result comments, messages, titles)
 *
 * See GAME_TEXTS in constants.js and research/game-texts.md.
 */
import { GAME_TEXTS, ISS_FONT16_CHARS, SCENARIO_TEXT_CHARSET } from './constants';
import { decodeScenarioText, encodeScenarioText, wrapScenarioText } from './scenario';

const G = GAME_TEXTS;

const word = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
const writeWord = (rom, a, v) => {
  rom.writeByte(a, v & 0xff);
  rom.writeByte(a + 1, (v >> 8) & 0xff);
};
const toFile = (ptr) => G.BANK_FILE_BASE + (ptr - 0x8000);
const toPtr = (file) => file - G.BANK_FILE_BASE + 0x8000;

// --- ISS charset (8x16 font) ---

const ISS_REVERSE = Object.fromEntries(
  Object.entries(ISS_FONT16_CHARS).map(([code, ch]) => [ch, Number(code)]),
);
const TOKENS = { 0x59: '{1S}', 0x5a: '{T}', 0x60: '{2N}', 0x61: '{D}' };
const TOKEN_REVERSE = Object.fromEntries(Object.entries(TOKENS).map(([c, t]) => [t, Number(c)]));

/** Bytes -> text. Codes without a glyph mapping become {xx} so they survive a round trip. */
export function decodeIss(bytes) {
  let s = '';
  for (const b of bytes) {
    if (ISS_FONT16_CHARS[b] !== undefined) s += ISS_FONT16_CHARS[b];
    else if (TOKENS[b]) s += TOKENS[b];
    else s += `{${b.toString(16).padStart(2, '0')}}`;
  }
  return s;
}

/** Text -> codes; returns { codes, invalid } (invalid chars become spaces). */
export function encodeIss(text) {
  const codes = [];
  const invalid = new Set();
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      const end = text.indexOf('}', i);
      const token = end > i ? text.slice(i, end + 1) : '';
      if (TOKEN_REVERSE[token] !== undefined) {
        codes.push(TOKEN_REVERSE[token]);
        i = end;
        continue;
      }
      if (/^\{[0-9a-fA-F]{2}\}$/.test(token)) {
        codes.push(parseInt(token.slice(1, 3), 16));
        i = end;
        continue;
      }
    }
    const code = ISS_REVERSE[text[i]];
    if (code === undefined) {
      invalid.add(text[i]);
      codes.push(0x00);
    } else codes.push(code);
  }
  return { codes, invalid: [...invalid] };
}

/** Visible length of an ISS text (tokens count as 1 cell). */
export const issLength = (text) => encodeIss(text).codes.length;

/** Characters of a box text without a glyph in the 8x8 ASCII font */
export function findInvalidBoxChars(text) {
  const bad = new Set();
  for (const ch of text.replace(/\n/g, '')) if (!SCENARIO_TEXT_CHARSET.includes(ch)) bad.add(ch);
  return [...bad];
}

/** Characters of a fixed text without a glyph in the 8x16 font */
export const findInvalidIssChars = (text) => encodeIss(text.replace(/\n/g, '')).invalid;

// --- Fixed-length ISS texts (lines x columns, padded with spaces) ---

function readFixed(rom, addr, lines, columns) {
  const out = [];
  for (let l = 0; l < lines; l++) {
    const bytes = rom.readBytes(addr + l * columns, columns);
    out.push(decodeIss(bytes).replace(/\s+$/, ''));
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/** Lay out text in a fixed lines x columns grid; returns { codes, overflow } */
export function layoutFixed(text, lines, columns) {
  // Wrap on visible cells (tokens are 1 cell): wrap the decoded form with a placeholder
  const wrapped = [];
  for (const paragraph of String(text).split('\n')) {
    if (issLength(paragraph) <= columns) wrapped.push(paragraph);
    else wrapped.push(...wrapScenarioText(paragraph, columns));
  }
  const codes = [];
  wrapped.slice(0, lines).forEach((line) => {
    const c = encodeIss(line).codes.slice(0, columns);
    while (c.length < columns) c.push(0x00);
    codes.push(...c);
  });
  while (codes.length < lines * columns) codes.push(0x00);
  return { codes, overflow: wrapped.length > lines };
}

// --- Read ---

export function readTrainingTexts(rom) {
  const box = (addr, b) => decodeScenarioText(rom, addr, b);
  const intros = Array.from({ length: G.INTRO_COUNT }, (_, i) =>
    box(toFile(word(rom, G.INTRO_TABLE + i * 2)), G.INTRO_BOX),
  );
  const results = Array.from({ length: G.RESULT_GROUPS }, (_, g) => {
    const table = toFile(word(rom, G.RESULT_TABLE + g * 2));
    return Array.from({ length: G.RESULT_PER_GROUP }, (_, k) =>
      box(toFile(word(rom, table + k * 2)), G.RESULT_BOX),
    );
  });
  const record = box(toFile(word(rom, G.RECORD_OPERAND)), G.RESULT_BOX);
  const messages = Array.from({ length: G.MESSAGE_COUNT }, (_, i) =>
    readFixed(
      rom,
      toFile(word(rom, G.MESSAGE_TABLE + i * 2)),
      G.MESSAGE_BOX.lines,
      G.MESSAGE_BOX.columns,
    ),
  );
  const titles = Array.from({ length: G.TITLE_COUNT }, (_, i) =>
    readFixed(rom, toFile(word(rom, G.TITLE_TABLE + i * 2)), 1, G.TITLE_LENGTH),
  );
  return { intros, results, record, messages, titles };
}

// --- Write ---

const boxBytes = (text, b) => encodeScenarioText(text, b.columns);

/** Bytes used by the two packed areas for a set of texts */
export function measureTrainingTexts(texts) {
  const intro = texts.intros.reduce((n, t) => n + boxBytes(t, G.INTRO_BOX).bytes.length, 0);
  const tables = G.RESULT_GROUPS * G.RESULT_PER_GROUP * 2;
  const result =
    tables +
    texts.results.flat().reduce((n, t) => n + boxBytes(t, G.RESULT_BOX).bytes.length, 0) +
    boxBytes(texts.record, G.RESULT_BOX).bytes.length;
  return {
    intro,
    introCapacity: G.INTRO_AREA[1] - G.INTRO_AREA[0],
    result,
    resultCapacity: G.RESULT_AREA[1] - G.RESULT_AREA[0],
  };
}

/** Problems that block writing: 'tooManyLines' / 'introFull' / 'resultFull' */
export function validateTrainingTexts(texts) {
  const issues = [];
  const lines = (t, b) => boxBytes(t, b).lineCount > b.lines;
  texts.intros.forEach((t, i) => lines(t, G.INTRO_BOX) && issues.push({ kind: 'intro', index: i }));
  texts.results.forEach((group, g) =>
    group.forEach(
      (t, k) => lines(t, G.RESULT_BOX) && issues.push({ kind: 'result', index: g * 4 + k }),
    ),
  );
  if (lines(texts.record, G.RESULT_BOX)) issues.push({ kind: 'record' });
  texts.messages.forEach(
    (t, i) =>
      layoutFixed(t, G.MESSAGE_BOX.lines, G.MESSAGE_BOX.columns).overflow &&
      issues.push({ kind: 'message', index: i }),
  );
  texts.titles.forEach(
    (t, i) =>
      layoutFixed(t, 1, G.TITLE_LENGTH).overflow && issues.push({ kind: 'title', index: i }),
  );
  const m = measureTrainingTexts(texts);
  if (m.intro > m.introCapacity) issues.push({ kind: 'introFull' });
  if (m.result > m.resultCapacity) issues.push({ kind: 'resultFull' });
  return issues;
}

/**
 * Write all training texts. Box texts are re-packed in their areas and the
 * pointer tables updated; fixed texts are written in place.
 * @returns {{ ok: boolean, error?: string }}
 */
export function writeTrainingTexts(rom, texts) {
  const issues = validateTrainingTexts(texts);
  if (issues.length) return { ok: false, error: 'gameTextsInvalid', issues };

  // Intros: strings packed from the start of the area, table at INTRO_TABLE
  let p = G.INTRO_AREA[0];
  texts.intros.forEach((t, i) => {
    const { bytes } = boxBytes(t, G.INTRO_BOX);
    writeWord(rom, G.INTRO_TABLE + i * 2, toPtr(p));
    rom.writeBytes(p, bytes);
    p += bytes.length;
  });
  rom.writeBytes(p, new Uint8Array(G.INTRO_AREA[1] - p).fill(0xff));

  // Results: 5 sub-tables first, then the 20 strings and the record text
  const tablesStart = G.RESULT_AREA[0];
  p = tablesStart + G.RESULT_GROUPS * G.RESULT_PER_GROUP * 2;
  texts.results.forEach((group, g) => {
    const table = tablesStart + g * G.RESULT_PER_GROUP * 2;
    writeWord(rom, G.RESULT_TABLE + g * 2, toPtr(table));
    group.forEach((t, k) => {
      const { bytes } = boxBytes(t, G.RESULT_BOX);
      writeWord(rom, table + k * 2, toPtr(p));
      rom.writeBytes(p, bytes);
      p += bytes.length;
    });
  });
  const record = boxBytes(texts.record, G.RESULT_BOX).bytes;
  writeWord(rom, G.RECORD_OPERAND, toPtr(p));
  rom.writeBytes(p, record);
  p += record.length;
  rom.writeBytes(p, new Uint8Array(G.RESULT_AREA[1] - p).fill(0xff));

  // Fixed texts, in place
  texts.messages.forEach((t, i) => {
    const addr = toFile(word(rom, G.MESSAGE_TABLE + i * 2));
    rom.writeBytes(addr, layoutFixed(t, G.MESSAGE_BOX.lines, G.MESSAGE_BOX.columns).codes);
  });
  texts.titles.forEach((t, i) => {
    const addr = toFile(word(rom, G.TITLE_TABLE + i * 2));
    rom.writeBytes(addr, layoutFixed(t, 1, G.TITLE_LENGTH).codes);
  });
  return { ok: true };
}

/** Raw bytes of every area touched by writeTrainingTexts (for undo) */
export function readTrainingTextBytes(rom) {
  const span = (a, b) => Array.from(rom.readBytes(a, b - a));
  return {
    introTable: span(G.INTRO_TABLE, G.INTRO_AREA[1]),
    results: span(G.RESULT_TABLE, G.RESULT_AREA[1]),
    record: span(G.RECORD_OPERAND, G.RECORD_OPERAND + 2),
    fixed: span(
      G.MESSAGE_TABLE,
      G.TITLE_TABLE + G.TITLE_COUNT * 2 + G.TITLE_COUNT * G.TITLE_LENGTH,
    ),
  };
}

export function restoreTrainingTextBytes(rom, snap) {
  if (!snap) return;
  rom.writeBytes(G.INTRO_TABLE, snap.introTable);
  rom.writeBytes(G.RESULT_TABLE, snap.results);
  rom.writeBytes(G.RECORD_OPERAND, snap.record);
  rom.writeBytes(G.MESSAGE_TABLE, snap.fixed);
}
