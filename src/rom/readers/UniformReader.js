/**
 * Uniform, Hair/Skin, and Flag color readers
 */
import {
  TEAMS,
  UNIFORM_COLORS,
  UNIFORM_RANGE1_TEAMS,
  UNIFORM_RANGE2_TEAMS,
  UNIFORM_KEEPER_RANGE1_TEAMS,
  HAIR_SKIN_COLORS,
  FLAG_COLORS,
  FLAG_RANGE1_TEAMS,
  FLAG_RANGE2_TEAMS,
  SPECIAL_HAIR,
  SPECIAL_SKIN,
  FLAG_DESIGN_ORDINALS,
} from '../constants';

// --- Shared color parsing ---

export function parseSnesColor(lo, hi) {
  const raw = (hi << 8) | lo;
  const r = raw & 0x1f;
  const g = (raw >> 5) & 0x1f;
  const b = (raw >> 10) & 0x1f;
  return { r: r * 8, g: g * 8, b: b * 8, r5: r, g5: g, b5: b, raw };
}

// --- Kit offset helpers ---

export function getKitOffset(teamId, kitType) {
  const UC = UNIFORM_COLORS;
  const pos1 = UNIFORM_RANGE1_TEAMS.indexOf(teamId);
  const pos2 = UNIFORM_RANGE2_TEAMS.indexOf(teamId);

  if (kitType === 'goalkeeper') {
    const kPos1 = UNIFORM_KEEPER_RANGE1_TEAMS.indexOf(teamId);
    if (kPos1 >= 0) return UC.KEEPER_KIT_RANGE1_OFFSET + kPos1 * UC.KEEPER_KIT_STEP;
    if (pos2 >= 0) return UC.KEEPER_KIT_RANGE2_OFFSET + pos2 * UC.KEEPER_KIT_STEP;
    if (teamId === 'SUPERSTAR') {
      const belgiumPos = UNIFORM_KEEPER_RANGE1_TEAMS.indexOf('BELGIUM');
      return UC.KEEPER_KIT_RANGE1_OFFSET + belgiumPos * UC.KEEPER_KIT_STEP;
    }
    return null;
  }

  if (kitType === 'home') {
    if (pos1 >= 0) return UC.FIRST_KIT_RANGE1_OFFSET + pos1 * UC.TEAM_KIT_STEP;
    if (pos2 >= 0) return UC.FIRST_KIT_RANGE2_OFFSET + pos2 * UC.TEAM_KIT_STEP;
  } else {
    if (pos1 >= 0) return UC.SECOND_KIT_RANGE1_OFFSET + pos1 * UC.TEAM_KIT_STEP;
    if (pos2 >= 0) return UC.SECOND_KIT_RANGE2_OFFSET + pos2 * UC.TEAM_KIT_STEP;
  }
  return null;
}

export function getHairSkinOffset(teamId, kitType) {
  const HS = HAIR_SKIN_COLORS;
  const pos1 = UNIFORM_RANGE1_TEAMS.indexOf(teamId);
  const pos2 = UNIFORM_RANGE2_TEAMS.indexOf(teamId);

  if (kitType === 'goalkeeper') {
    const kPos1 = UNIFORM_KEEPER_RANGE1_TEAMS.indexOf(teamId);
    if (kPos1 >= 0) return HS.KEEPER_RANGE1_OFFSET + kPos1 * HS.KEEPER_STEP;
    if (pos2 >= 0) return HS.KEEPER_RANGE2_OFFSET + pos2 * HS.KEEPER_STEP;
    if (teamId === 'SUPERSTAR') {
      const bPos = UNIFORM_KEEPER_RANGE1_TEAMS.indexOf('BELGIUM');
      return HS.KEEPER_RANGE1_OFFSET + bPos * HS.KEEPER_STEP;
    }
    return null;
  }
  if (kitType === 'first') {
    if (pos1 >= 0) return HS.FIRST_RANGE1_OFFSET + pos1 * HS.OUTFIELD_STEP;
    if (pos2 >= 0) return HS.FIRST_RANGE2_OFFSET + pos2 * HS.OUTFIELD_STEP;
  } else {
    if (pos1 >= 0) return HS.SECOND_RANGE1_OFFSET + pos1 * HS.OUTFIELD_STEP;
    if (pos2 >= 0) return HS.SECOND_RANGE2_OFFSET + pos2 * HS.OUTFIELD_STEP;
  }
  return null;
}

export function getFlagOffset(teamId) {
  const FC = FLAG_COLORS;
  const pos1 = FLAG_RANGE1_TEAMS.indexOf(teamId);
  if (pos1 >= 0) return FC.RANGE1_OFFSET + pos1 * FC.STEP;
  const pos2 = FLAG_RANGE2_TEAMS.indexOf(teamId);
  if (pos2 >= 0) return FC.RANGE2_OFFSET + pos2 * FC.STEP;
  return null;
}

// --- Readers ---

export function readUniformColors(rom, teamIndex) {
  const teamId = TEAMS[teamIndex].id;

  const readMainKit = (kitType) => {
    const offset = getKitOffset(teamId, kitType);
    if (offset === null) return null;
    const bytes = rom.readBytes(offset, 16);
    const readColors = (start, count) => {
      const colors = [];
      for (let i = 0; i < count; i++)
        colors.push(parseSnesColor(bytes[start + i * 2], bytes[start + i * 2 + 1]));
      return colors;
    };
    return { shirt: readColors(0, 3), shorts: readColors(6, 3), socks: readColors(12, 2) };
  };

  const readKeeperKit = () => {
    const offset = getKitOffset(teamId, 'goalkeeper');
    if (offset === null) return null;
    const bytes = rom.readBytes(offset, 12);
    const readColors = (start, count) => {
      const colors = [];
      for (let i = 0; i < count; i++)
        colors.push(parseSnesColor(bytes[start + i * 2], bytes[start + i * 2 + 1]));
      return colors;
    };
    return { shirtAndSocks: readColors(0, 5), shorts: readColors(10, 1) };
  };

  return { home: readMainKit('home'), away: readMainKit('away'), goalkeeper: readKeeperKit() };
}

export function readHairSkinColors(rom, teamIndex) {
  const teamId = TEAMS[teamIndex].id;

  const readOutfield = (kitType) => {
    const offset = getHairSkinOffset(teamId, kitType);
    if (offset === null) return null;
    const bytes = rom.readBytes(offset, 12);
    const hair = [parseSnesColor(bytes[0], bytes[1])];
    const skin = [];
    for (let i = 0; i < 5; i++) skin.push(parseSnesColor(bytes[2 + i * 2], bytes[3 + i * 2]));
    return { hair, skin };
  };

  const readKeeper = () => {
    const offset = getHairSkinOffset(teamId, 'goalkeeper');
    if (offset === null) return null;
    const bytes = rom.readBytes(offset, 8);
    const hair = [parseSnesColor(bytes[0], bytes[1])];
    const skin = [];
    for (let i = 0; i < 3; i++) skin.push(parseSnesColor(bytes[2 + i * 2], bytes[3 + i * 2]));
    return { hair, skin };
  };

  return { first: readOutfield('first'), second: readOutfield('second'), goalkeeper: readKeeper() };
}

export function readFlagColors(rom, teamIndex) {
  const teamId = TEAMS[teamIndex].id;
  const offset = getFlagOffset(teamId);
  if (offset === null) return [];
  const bytes = rom.readBytes(offset, 8);
  const colors = [];
  for (let i = 0; i < 4; i++) colors.push(parseSnesColor(bytes[i * 2], bytes[i * 2 + 1]));
  return colors;
}

// --- Special Hair & Skin readers ---

function getSpecialOffset(baseOffset, step, teamIndex) {
  const ordinal = FLAG_DESIGN_ORDINALS[teamIndex];
  if (ordinal === undefined) return null;
  return baseOffset + ordinal * step;
}

export function readSpecialHair(rom, teamIndex) {
  const offset = getSpecialOffset(SPECIAL_HAIR.OFFSET, SPECIAL_HAIR.STEP, teamIndex);
  if (offset === null) return 0;
  const bytes = rom.readBytes(offset, 2);
  for (const type of SPECIAL_HAIR.TYPES) {
    if (type.bytes[0] === bytes[0] && type.bytes[1] === bytes[1]) {
      return type.id;
    }
  }
  return 0; // fallback to regular
}

export function readSpecialSkin(rom, teamIndex) {
  const offset = getSpecialOffset(SPECIAL_SKIN.OFFSET, SPECIAL_SKIN.STEP, teamIndex);
  if (offset === null) return 0;
  const bytes = rom.readBytes(offset, 2);
  for (const type of SPECIAL_SKIN.TYPES) {
    if (type.bytes[0] === bytes[0] && type.bytes[1] === bytes[1]) {
      return type.id;
    }
  }
  return 0; // fallback to regular
}
