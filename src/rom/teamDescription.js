/**
 * Team descriptions shown on the team selection screen
 * ("Offensive 4-4-2" title + a short text).
 *
 * Reverse engineered (Europe ROM):
 *   Pointers: 0x38000 ($87:8000) — 27 x 16-bit, ROM ordinal order, bank $02
 *   Texts:    0x1202C-0x12A93 (2664 bytes), ASCII, rendered 8 lines x 15 columns
 *     FE xx = colour/attribute change (0x2C / 0x24 = title styles, 0x20 = normal)
 *     FD    = new line (rest of the line is cleared)
 *     FF    = end of text
 *   Layout in the original: title (line 1), blank line, body (up to 6 lines).
 *   Like the scenario texts, some originals overlap (a text "runs into" the
 *   next one and is simply cut at 8 lines).
 */
import { FLAG_DESIGN_ORDINALS, SCENARIO_TEXT_CHARSET } from './constants';
import { wrapScenarioText } from './scenario';

export const TEAM_DESC = {
  POINTERS: 0x38000,
  BANK_FILE_BASE: 0x10000, // bank $02
  AREA_START: 0x1202c,
  AREA_END: 0x12a94, // exclusive
  COLUMNS: 15,
  LINES: 8,
  BODY_LINES: 6,
  ATTR: 0xfe,
  NEWLINE: 0xfd,
  END: 0xff,
  NORMAL_COLOR: 0x20,
};

/** Title colours found in the ROM */
export const TITLE_COLORS = [
  { id: 0x2c, key: 'descTitleOffensive' },
  { id: 0x24, key: 'descTitleDefensive' },
];

export const TEAM_DESC_CAPACITY = TEAM_DESC.AREA_END - TEAM_DESC.AREA_START;
const D = TEAM_DESC;

function pointerAddress(teamIndex) {
  return D.POINTERS + FLAG_DESIGN_ORDINALS[teamIndex] * 2;
}

function textAddress(rom, teamIndex) {
  const p = pointerAddress(teamIndex);
  const ptr = rom.readByte(p) | (rom.readByte(p + 1) << 8);
  return D.BANK_FILE_BASE + (ptr - 0x8000);
}

/**
 * Decode as the game renders it.
 * @returns {{ title: string, titleColor: number, body: string }}
 */
export function readTeamDescription(rom, teamIndex) {
  let p = textAddress(rom, teamIndex);
  const lines = [];
  let titleColor = 0x2c;
  let sawColor = false;
  let ended = false;
  for (let line = 0; line < D.LINES; line++) {
    let text = '';
    let col = 0;
    while (!ended && col < D.COLUMNS) {
      const c = rom.readByte(p);
      if (c === D.END) {
        ended = true;
        break;
      }
      if (c === D.ATTR) {
        if (!sawColor) {
          titleColor = rom.readByte(p + 1);
          sawColor = true;
        }
        p += 2;
        continue;
      }
      p++;
      if (c === D.NEWLINE) break;
      text += c === 0x60 ? "'" : String.fromCharCode(c);
      col++;
    }
    lines.push(text.replace(/\s+$/, ''));
  }
  const title = lines[0] || '';
  let bodyLines = lines.slice(1);
  if (bodyLines[0] === '') bodyLines = bodyLines.slice(1);
  while (bodyLines.length && bodyLines[bodyLines.length - 1] === '') bodyLines.pop();
  return { title, titleColor, body: bodyLines.join('\n') };
}

export function readTeamDescriptions(rom, count = FLAG_DESIGN_ORDINALS.length) {
  return Array.from({ length: count }, (_, i) => readTeamDescription(rom, i));
}

const toByte = (ch) => (SCENARIO_TEXT_CHARSET.includes(ch) ? ch.charCodeAt(0) : 0x20);

/** Body wrapped into display lines of 15 columns */
export function wrapDescriptionBody(body) {
  const lines = wrapScenarioText(body || '', D.COLUMNS);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Encode one description. */
export function encodeTeamDescription({ title, titleColor, body }) {
  const bytes = [D.ATTR, titleColor & 0xff];
  const t = (title || '').slice(0, D.COLUMNS);
  for (const ch of t) bytes.push(toByte(ch));
  bytes.push(D.ATTR, D.NORMAL_COLOR);
  // End the title line (a full 15-char title wraps by itself), then one blank line
  if (t.length < D.COLUMNS) bytes.push(D.NEWLINE);
  bytes.push(D.NEWLINE);
  const lines = wrapDescriptionBody(body);
  lines.forEach((line, i) => {
    for (const ch of line) bytes.push(toByte(ch));
    if (i < lines.length - 1 && line.length < D.COLUMNS) bytes.push(D.NEWLINE);
  });
  bytes.push(D.END);
  return bytes;
}

/**
 * Re-pack all descriptions into the original area and rewrite the pointers.
 * @param {object[]} descriptions - one per team (TEAMS order)
 */
export function writeTeamDescriptions(rom, descriptions) {
  const encoded = descriptions.map(encodeTeamDescription);
  const used = encoded.reduce((n, b) => n + b.length, 0);
  if (used > TEAM_DESC_CAPACITY) return { ok: false, used, capacity: TEAM_DESC_CAPACITY };
  let p = D.AREA_START;
  encoded.forEach((bytes, teamIndex) => {
    const ptr = p - D.BANK_FILE_BASE + 0x8000;
    const pa = pointerAddress(teamIndex);
    rom.writeByte(pa, ptr & 0xff);
    rom.writeByte(pa + 1, ptr >> 8);
    rom.writeBytes(p, bytes);
    p += bytes.length;
  });
  for (; p < D.AREA_END; p++) rom.writeByte(p, D.END);
  return { ok: true, used, capacity: TEAM_DESC_CAPACITY };
}

/** Change one team's description (re-packs everything; others render identically) */
export function writeTeamDescription(rom, teamIndex, desc) {
  const all = readTeamDescriptions(rom);
  all[teamIndex] = desc;
  return writeTeamDescriptions(rom, all);
}

export function measureTeamDescriptions(descriptions) {
  return descriptions.reduce((n, d) => n + encodeTeamDescription(d).length, 0);
}

/** Raw bytes of the description area + pointer table (exact undo/redo) */
export function readTeamDescriptionBytes(rom) {
  return [
    Array.from(rom.readBytes(D.POINTERS, FLAG_DESIGN_ORDINALS.length * 2)),
    Array.from(rom.readBytes(D.AREA_START, TEAM_DESC_CAPACITY)),
  ];
}

export function writeTeamDescriptionBytes(rom, snapshot) {
  if (!Array.isArray(snapshot) || snapshot.length !== 2) return;
  rom.writeBytes(D.POINTERS, snapshot[0]);
  rom.writeBytes(D.AREA_START, snapshot[1]);
}

/** Replace the "x-x-x" formation in a title (e.g. after editing the formation) */
export function withFormationInTitle(title, formationName) {
  if (/\d-\d-\d/.test(title)) return title.replace(/\d-\d-\d/, formationName);
  const next = `${title} ${formationName}`.trim();
  return next.slice(0, D.COLUMNS);
}
