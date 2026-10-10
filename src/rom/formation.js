/**
 * Team formation (default tactical setup) — read/write + helpers
 *
 * See FORMATION_DATA in constants.js for the reverse-engineered layout.
 */
import {
  FORMATION_DATA,
  FORMATION_ROLES,
  FORMATION_PRESETS,
  FLAG_DESIGN_ORDINALS,
} from './constants';

/** Most common behaviour byte per role in the original ROM (used when a role changes) */
export const DEFAULT_BEHAVIOR_BY_ROLE = {
  0: 0x37,
  1: 0x32,
  2: 0x42,
  7: 0x32,
  3: 0x74,
  4: 0x54,
  5: 0x74,
  6: 0x30,
};

export function getRole(roleId) {
  return FORMATION_ROLES.find((r) => r.id === roleId) || null;
}

/**
 * File offset of a team's formation record, resolved through the pointer table.
 * @param {import('./RomParser').default} rom
 * @param {number} teamIndex - index in TEAMS
 */
export function getFormationAddress(rom, teamIndex) {
  const ordinal = FLAG_DESIGN_ORDINALS[teamIndex];
  const ptrAddr = FORMATION_DATA.POINTER_TABLE + ordinal * 2;
  const ptr = rom.readByte(ptrAddr) | (rom.readByte(ptrAddr + 1) << 8);
  return FORMATION_DATA.BANK_FILE_BASE + (ptr - 0x8000);
}

/** Decode 44 bytes into 11 slot objects */
export function decodeFormation(bytes) {
  const slots = [];
  for (let i = 0; i < FORMATION_DATA.SLOTS; i++) {
    const o = i * FORMATION_DATA.SLOT_LENGTH;
    slots.push({
      depth: bytes[o],
      lateral: (bytes[o + 1] >> 4) & 0x0f,
      line: bytes[o + 1] & 0x0f,
      role: bytes[o + 2],
      behavior: bytes[o + 3],
    });
  }
  return slots;
}

/** Encode 11 slot objects into 44 bytes */
export function encodeFormation(slots) {
  const out = new Uint8Array(FORMATION_DATA.RECORD_LENGTH);
  slots.slice(0, FORMATION_DATA.SLOTS).forEach((s, i) => {
    const o = i * FORMATION_DATA.SLOT_LENGTH;
    out[o] = clamp(s.depth, 0, 0xff);
    out[o + 1] = (clamp(s.lateral, 0, 15) << 4) | clamp(s.line, 0, 15);
    out[o + 2] = clamp(s.role, 0, 0xff);
    out[o + 3] = clamp(s.behavior, 0, 0xff);
  });
  return out;
}

function clamp(v, min, max) {
  const n = Number.isFinite(v) ? Math.round(v) : min;
  return Math.max(min, Math.min(max, n));
}

/**
 * @returns {{ slots: object[], name: string, address: number }}
 */
export function readFormation(rom, teamIndex) {
  const address = getFormationAddress(rom, teamIndex);
  const slots = decodeFormation(rom.readBytes(address, FORMATION_DATA.RECORD_LENGTH));
  return { slots, name: getFormationName(slots), address };
}

export function writeFormation(rom, teamIndex, slots) {
  if (!Array.isArray(slots) || slots.length !== FORMATION_DATA.SLOTS) {
    throw new Error(`Formation must have ${FORMATION_DATA.SLOTS} slots`);
  }
  const address = getFormationAddress(rom, teamIndex);
  rom.writeBytes(address, encodeFormation(slots));
}

/** "4-4-2" style name from the line of each outfield slot */
export function getFormationName(slots) {
  const counts = [0, 0, 0];
  slots.forEach((s) => {
    if (s.line >= 1 && s.line <= 3) counts[s.line - 1]++;
  });
  return counts.join('-');
}

/**
 * Human friendly position label derived from line, role and lateral position.
 * @returns {'GK'|'SW'|'LB'|'CB'|'RB'|'DM'|'AM'|'LM'|'CM'|'RM'|'LW'|'ST'|'RW'}
 */
export function getPositionLabel(slot) {
  if (!slot) return 'SUB';
  const { line, role, lateral } = slot;
  if (line === 0 || role === 0) return 'GK';
  if (line === 1) {
    if (role === 7) return 'SW';
    if (lateral <= 2) return 'LB';
    if (lateral >= 12) return 'RB';
    return 'CB';
  }
  if (line === 2) {
    if (lateral <= 3) return 'LM';
    if (lateral >= 11) return 'RM';
    if (role === 3) return 'DM';
    if (role === 5) return 'AM';
    return 'CM';
  }
  if (lateral <= 3) return 'LW';
  if (lateral >= 11) return 'RW';
  return 'ST';
}

/** 'gk' | 'def' | 'mid' | 'fwd' */
export function getLineCategory(line) {
  return ['gk', 'def', 'mid', 'fwd'][line] || 'mid';
}

/** Slots for a preset id */
export function getPresetSlots(presetId) {
  const preset = FORMATION_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`Unknown formation preset: ${presetId}`);
  const bytes = new Uint8Array(preset.hex.match(/../g).map((h) => parseInt(h, 16)));
  return decodeFormation(bytes);
}

/**
 * Change the role of a slot keeping the data coherent: the line follows the
 * role and the AI behaviour is reset to the game's usual value for that role.
 */
export function withRole(slot, roleId) {
  const role = getRole(roleId);
  if (!role) return slot;
  return {
    ...slot,
    role: roleId,
    line: role.line,
    behavior: DEFAULT_BEHAVIOR_BY_ROLE[roleId] ?? slot.behavior,
  };
}

/** Simple structural validation; returns a list of warning keys */
export function validateFormation(slots) {
  const warnings = [];
  if (slots[0]?.role !== 0 || slots[0]?.line !== 0) warnings.push('formationGkSlot');
  if (slots.slice(1).some((s) => s.role === 0 || s.line === 0)) warnings.push('formationExtraGk');
  const counts = getFormationName(slots).split('-').map(Number);
  if (counts[0] < 2) warnings.push('formationFewDefenders');
  if (slots.some((s) => getRole(s.role) && getRole(s.role).line !== s.line)) {
    warnings.push('formationRoleLineMismatch');
  }
  return warnings;
}
