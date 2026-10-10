/**
 * Match palettes — pitch (per type/weather), ball and referee.
 * See MATCH_PALETTES in constants.js for the reverse-engineered locations.
 *
 * Colours are kept as raw SNES 15-bit values (0bbbbbgggggrrrrr) so a
 * read/write round-trip is lossless.
 */
import { MATCH_PALETTES, CROWD_DATA, FLAG_DESIGN_ORDINALS, TEAMS } from './constants';

const byId = Object.fromEntries(MATCH_PALETTES.map((p) => [p.id, p]));

export function getPaletteDef(id) {
  const def = byId[id];
  if (!def) throw new Error(`Unknown palette: ${id}`);
  return def;
}

// --- Colour conversion ---

/** Raw SNES colour → { r, g, b } in 0-255 (same scale as the rest of the editor: c5 * 8) */
export function rawToRgb(raw) {
  return { r: (raw & 31) * 8, g: ((raw >> 5) & 31) * 8, b: ((raw >> 10) & 31) * 8 };
}

/** { r, g, b } 0-255 → raw SNES colour */
export function rgbToRaw({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(31, Math.round(v / 8)));
  return c(r) | (c(g) << 5) | (c(b) << 10);
}

export function rawToHex(raw) {
  const { r, g, b } = rawToRgb(raw);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function hexToRaw(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  return rgbToRaw({ r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) });
}

// --- ROM access ---

export function readMatchPalette(rom, id) {
  const { offset, count } = getPaletteDef(id);
  return readColors(rom, offset, count);
}

export function readMatchPalettes(rom) {
  return {
    ...Object.fromEntries(MATCH_PALETTES.map((p) => [p.id, readMatchPalette(rom, p.id)])),
    crowds: readCrowdPalettes(rom),
    crowdMap: readCrowdMap(rom),
  };
}

export function writeMatchPalette(rom, id, colors) {
  const { offset, count } = getPaletteDef(id);
  if (!Array.isArray(colors) || colors.length !== count) {
    throw new Error(`Palette ${id} needs ${count} colours`);
  }
  writeColors(rom, offset, colors);
}

function writeColors(rom, offset, colors) {
  colors.forEach((raw, i) => {
    const v = raw & 0x7fff;
    rom.writeByte(offset + i * 2, v & 0xff);
    rom.writeByte(offset + i * 2 + 1, v >> 8);
  });
}

function readColors(rom, offset, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(rom.readByte(offset + i * 2) | (rom.readByte(offset + i * 2 + 1) << 8));
  }
  return out;
}

// --- Crowd (per home team) ---

const C = CROWD_DATA;
const crowdDescriptor = (n) => C.DESCRIPTOR_START + n * C.DESCRIPTOR_STEP;

/** File offset of the first visible colour of crowd palette n */
export function getCrowdOffset(rom, n) {
  const d = crowdDescriptor(n);
  const ptr = rom.readByte(d) | (rom.readByte(d + 1) << 8);
  return C.BLOB_BANK_FILE_BASE + (ptr - 0x8000) + 2; // skip the size word
}

export function readCrowdPalettes(rom) {
  return Array.from({ length: C.COUNT }, (_, n) =>
    readColors(rom, getCrowdOffset(rom, n), C.COLORS),
  );
}

export function writeCrowdPalette(rom, n, colors) {
  if (n < 0 || n >= C.COUNT) throw new Error('Invalid crowd palette');
  if (!Array.isArray(colors) || colors.length !== C.COLORS) {
    throw new Error(`Crowd palette needs ${C.COLORS} colours`);
  }
  writeColors(rom, getCrowdOffset(rom, n), colors);
}

/** Crowd palette index (0-19) used when each team (TEAMS order) plays at home */
export function readCrowdMap(rom) {
  return TEAMS.map((_, teamIndex) => {
    const a = C.TEAM_TABLE + FLAG_DESIGN_ORDINALS[teamIndex] * 2;
    const desc = rom.readByte(a) | (rom.readByte(a + 1) << 8);
    const n = (desc - C.DESCRIPTOR_START) / C.DESCRIPTOR_STEP;
    return Number.isInteger(n) && n >= 0 && n < C.COUNT ? n : -1;
  });
}

export function writeTeamCrowd(rom, teamIndex, n) {
  if (n < 0 || n >= C.COUNT) throw new Error('Invalid crowd palette');
  const a = C.TEAM_TABLE + FLAG_DESIGN_ORDINALS[teamIndex] * 2;
  const desc = crowdDescriptor(n);
  rom.writeByte(a, desc & 0xff);
  rom.writeByte(a + 1, desc >> 8);
}

/**
 * Apply a batch of palette edits.
 * Keys: MATCH_PALETTES id → colours; `crowd:N` → 30 colours; `crowdMap:TEAM_INDEX` → crowd index.
 */
export function applyPaletteUpdates(rom, updates) {
  Object.entries(updates).forEach(([key, value]) => {
    if (key.startsWith('crowd:')) writeCrowdPalette(rom, Number(key.slice(6)), value);
    else if (key.startsWith('crowdMap:')) writeTeamCrowd(rom, Number(key.slice(9)), value);
    else writeMatchPalette(rom, key, value);
  });
}

/** Turn a full palette state into update entries (used by undo/redo) */
export function paletteStateToUpdates(state, current) {
  const updates = {};
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  MATCH_PALETTES.forEach(({ id }) => {
    if (state[id] && !same(state[id], current?.[id])) updates[id] = state[id];
  });
  (state.crowds || []).forEach((colors, n) => {
    if (!same(colors, current?.crowds?.[n])) updates[`crowd:${n}`] = colors;
  });
  (state.crowdMap || []).forEach((n, teamIndex) => {
    if (n >= 0 && n !== current?.crowdMap?.[teamIndex]) updates[`crowdMap:${teamIndex}`] = n;
  });
  return updates;
}

// --- HSL helpers (for whole-palette recolouring) ---

function rgbToHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function hslToRgb({ h, s, l }) {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: f(hue + 1 / 3) * 255, g: f(hue) * 255, b: f(hue - 1 / 3) * 255 };
}

/**
 * Recolour a palette: rotate hue, scale saturation and lightness.
 * Greys (pitch lines) are barely affected because their saturation is ~0.
 */
export function adjustPalette(colors, { hue = 0, saturation = 1, lightness = 1 } = {}) {
  return colors.map((raw) => {
    const hsl = rgbToHsl(rawToRgb(raw));
    return rgbToRaw(
      hslToRgb({
        h: hsl.h + hue,
        s: Math.max(0, Math.min(1, hsl.s * saturation)),
        l: Math.max(0, Math.min(1, hsl.l * lightness)),
      }),
    );
  });
}

/**
 * Build a dark→light ramp of `count` shades from a base colour
 * (used for kit parts: the original referee shirt is 3 shades of grey).
 */
export function shadeRamp(baseRaw, count) {
  const base = rgbToHsl(rawToRgb(baseRaw));
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 1 : i / (count - 1); // 0 = darkest, 1 = base
    out.push(rgbToRaw(hslToRgb({ ...base, l: base.l * (0.35 + 0.65 * t) })));
  }
  return out;
}

/** Grass recolour presets (applied to the original grass palette) */
export const GRASS_PRESETS = [
  { id: 'original', adjust: null },
  { id: 'vivid', adjust: { hue: 0, saturation: 1.6, lightness: 1.05 } },
  { id: 'dark', adjust: { hue: 0, saturation: 1.1, lightness: 0.75 } },
  { id: 'dry', adjust: { hue: -35, saturation: 0.9, lightness: 1.05 } },
  { id: 'blue', adjust: { hue: 110, saturation: 1.3, lightness: 1 } },
  { id: 'red', adjust: { hue: -100, saturation: 1.3, lightness: 0.95 } },
];
