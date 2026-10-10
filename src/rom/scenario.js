/**
 * Scenario mode — read/write the 9 pre-set match situations
 *
 * See SCENARIO_DATA in constants.js for the reverse-engineered layout.
 */
import { SCENARIO_DATA, SCENARIO_TEXT_CHARSET, FLAG_DESIGN_ORDINALS } from './constants';

const S = SCENARIO_DATA;

// --- Team id conversion (ROM ordinal <-> TEAMS index) ---

const ORDINAL_TO_INDEX = (() => {
  const map = [];
  FLAG_DESIGN_ORDINALS.forEach((ordinal, index) => (map[ordinal] = index));
  return map;
})();

export function ordinalToTeamIndex(ordinal) {
  return ORDINAL_TO_INDEX[ordinal] ?? -1;
}

export function teamIndexToOrdinal(teamIndex) {
  return FLAG_DESIGN_ORDINALS[teamIndex];
}

// --- BCD clock (word: high byte = minutes, low byte = seconds) ---

const fromBcd = (b) => (b >> 4) * 10 + (b & 0x0f);
const toBcd = (n) => ((Math.floor(n / 10) % 10) << 4) | (n % 10);

/** @returns {{ minutes: number, seconds: number }} */
export function decodeClock(word) {
  return { minutes: fromBcd((word >> 8) & 0xff), seconds: fromBcd(word & 0xff) };
}

export function encodeClock(minutes, seconds) {
  const m = Math.max(0, Math.min(S.MAX_MINUTES, Math.floor(minutes) || 0));
  const s = Math.max(0, Math.min(59, Math.floor(seconds) || 0));
  return (toBcd(m) << 8) | toBcd(s);
}

export function clockToSeconds(word) {
  const { minutes, seconds } = decodeClock(word);
  return minutes * 60 + seconds;
}

export function secondsToClock(total) {
  const t = Math.max(0, Math.min(S.MAX_MINUTES * 60 + 59, Math.round(total) || 0));
  return encodeClock(Math.floor(t / 60), t % 60);
}

// --- Text ---

/**
 * Decode a text exactly as the game renders it ($00:E31F):
 * 8 lines x 23 columns, 0xFD = new line, 0xFF = end. Trailing spaces trimmed.
 * @returns {string} lines joined by "\n"
 */
export function decodeScenarioText(rom, fileOffset) {
  const lines = [];
  let p = fileOffset;
  let ended = false;
  for (let line = 0; line < S.TEXT_LINES; line++) {
    let text = '';
    if (!ended) {
      for (let col = 0; col < S.TEXT_COLUMNS; col++) {
        const c = rom.readByte(p);
        if (c === S.TEXT_END) {
          ended = true;
          break;
        }
        p++;
        if (c === S.TEXT_NEWLINE) break;
        text += c === 0x60 ? "'" : String.fromCharCode(c); // ` renders as '
      }
    }
    lines.push(text.replace(/\s+$/, ''));
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

/** Characters not supported by the scenario font */
export function findInvalidChars(text) {
  const bad = new Set();
  for (const ch of text.replace(/\n/g, '')) if (!SCENARIO_TEXT_CHARSET.includes(ch)) bad.add(ch);
  return [...bad];
}

/**
 * Word-wrap free text into display lines of 23 columns (explicit "\n" kept).
 * Long words are hard-split.
 */
export function wrapScenarioText(text, columns = S.TEXT_COLUMNS) {
  const out = [];
  for (const paragraph of String(text).split('\n')) {
    // Lines that already fit are kept verbatim (preserves intentional spacing)
    if (paragraph.length <= columns) {
      out.push(paragraph.replace(/\s+$/, ''));
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/ +/)) {
      if (!word) continue;
      let w = word;
      while (w.length > columns) {
        if (line) {
          out.push(line);
          line = '';
        }
        out.push(w.slice(0, columns));
        w = w.slice(columns);
      }
      if (!line) line = w;
      else if (line.length + 1 + w.length <= columns) line += ` ${w}`;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * Encode display lines into bytes (FD between lines, FF at the end).
 * A line that fills all 23 columns wraps automatically, so no FD is needed after it.
 */
export function encodeScenarioText(text) {
  const lines = wrapScenarioText(text);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  const bytes = [];
  lines.forEach((line, i) => {
    for (const ch of line) {
      const code = ch.charCodeAt(0);
      bytes.push(SCENARIO_TEXT_CHARSET.includes(ch) ? code : 0x20);
    }
    if (i < lines.length - 1 && line.length < S.TEXT_COLUMNS) bytes.push(S.TEXT_NEWLINE);
  });
  bytes.push(S.TEXT_END);
  return { bytes, lineCount: lines.length };
}

export const TEXT_CAPACITY = S.TEXT_AREA_END - S.TEXT_AREA_START;

// --- Records ---

function recordAddress(rom, index) {
  const ptrAddr = S.RECORD_PTRS + index * 2;
  const ptr = rom.readByte(ptrAddr) | (rom.readByte(ptrAddr + 1) << 8);
  return S.RECORD_BANK_FILE_BASE + (ptr - 0x8000);
}

function textAddress(rom, index) {
  const ptrAddr = S.TEXT_PTRS + index * 2;
  const ptr = rom.readByte(ptrAddr) | (rom.readByte(ptrAddr + 1) << 8);
  return S.TEXT_BANK_FILE_BASE + (ptr - 0x8000);
}

const word = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
const writeWord = (rom, a, v) => {
  rom.writeByte(a, v & 0xff);
  rom.writeByte(a + 1, (v >> 8) & 0xff);
};

export function readScenario(rom, index) {
  const r = recordAddress(rom, index);
  return {
    index,
    team1: ordinalToTeamIndex(rom.readByte(S.TEAM_TABLE + index * 2) >> 1),
    team2: ordinalToTeamIndex(rom.readByte(S.TEAM_TABLE + index * 2 + 1) >> 1),
    matchClock: word(rom, r),
    displayClock: word(rom, r + 2),
    goals1: rom.readByte(r + 4),
    goals2: rom.readByte(r + 5),
    state: rom.readByte(r + 6),
    flag: rom.readByte(r + 7),
    ballX: word(rom, r + 8),
    ballY: word(rom, r + 10),
    text: decodeScenarioText(rom, textAddress(rom, index)),
  };
}

export function readScenarios(rom) {
  return Array.from({ length: S.COUNT }, (_, i) => readScenario(rom, i));
}

/** Write everything except the text */
export function writeScenarioData(rom, index, sc) {
  const o1 = teamIndexToOrdinal(sc.team1);
  const o2 = teamIndexToOrdinal(sc.team2);
  if (o1 === undefined || o2 === undefined) throw new Error('Invalid team');
  rom.writeByte(S.TEAM_TABLE + index * 2, o1 * 2);
  rom.writeByte(S.TEAM_TABLE + index * 2 + 1, o2 * 2);

  const r = recordAddress(rom, index);
  writeWord(rom, r, sc.matchClock);
  writeWord(rom, r + 2, sc.displayClock);
  rom.writeByte(r + 4, Math.max(0, Math.min(S.MAX_GOALS, sc.goals1 | 0)));
  rom.writeByte(r + 5, Math.max(0, Math.min(S.MAX_GOALS, sc.goals2 | 0)));
  rom.writeByte(r + 6, sc.state & 0xff);
  rom.writeByte(r + 7, sc.flag & 0xff);
  writeWord(rom, r + 8, sc.ballX);
  writeWord(rom, r + 10, sc.ballY);
}

/**
 * Re-pack all 9 texts into the text area and update the pointer table.
 * @param {string[]} texts
 * @returns {{ ok: boolean, used: number, capacity: number }}
 */
export function writeScenarioTexts(rom, texts) {
  const encoded = texts.map((t) => encodeScenarioText(t).bytes);
  const used = encoded.reduce((n, b) => n + b.length, 0);
  if (used > TEXT_CAPACITY) return { ok: false, used, capacity: TEXT_CAPACITY };

  let p = S.TEXT_AREA_START;
  encoded.forEach((bytes, i) => {
    const ptr = p - S.TEXT_BANK_FILE_BASE + 0x8000;
    writeWord(rom, S.TEXT_PTRS + i * 2, ptr);
    rom.writeBytes(p, bytes);
    p += bytes.length;
  });
  // Clear the leftover space (FF = empty text)
  for (; p < S.TEXT_AREA_END; p++) rom.writeByte(p, S.TEXT_END);
  return { ok: true, used, capacity: TEXT_CAPACITY };
}

/** Bytes needed by a set of texts */
export function measureScenarioTexts(texts) {
  return texts.reduce((n, t) => n + encodeScenarioText(t).bytes.length, 0);
}

/**
 * Write a full scenario. Texts are only re-packed when the text changed,
 * so editing numbers never touches the text area.
 * @returns {{ ok: boolean, error?: string, used?: number, capacity?: number }}
 */
export function writeScenario(rom, index, sc) {
  const current = readScenarios(rom);
  if (sc.text !== current[index].text) {
    const texts = current.map((c) => c.text);
    texts[index] = sc.text;
    const lines = encodeScenarioText(sc.text).lineCount;
    if (lines > S.TEXT_LINES) return { ok: false, error: 'scenarioTooManyLines' };
    const res = writeScenarioTexts(rom, texts);
    if (!res.ok) return { ok: false, error: 'scenarioTextFull', ...res };
  }
  writeScenarioData(rom, index, sc);
  return { ok: true };
}

/** Validation warnings for the UI */
export function validateScenario(sc) {
  const w = [];
  if (sc.team1 === sc.team2) w.push('scenarioSameTeam');
  if (findInvalidChars(sc.text).length) w.push('scenarioInvalidChars');
  if (encodeScenarioText(sc.text).lineCount > S.TEXT_LINES) w.push('scenarioTooManyLines');
  if (sc.displayClock && clockToSeconds(sc.matchClock) < clockToSeconds(sc.displayClock)) {
    w.push('scenarioClockOrder');
  }
  return w;
}
