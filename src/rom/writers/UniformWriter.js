/**
 * Uniform, Hair/Skin, Flag color, and Special Hair/Skin writers
 */
import { TEAMS, SPECIAL_HAIR, SPECIAL_SKIN, FLAG_DESIGN_ORDINALS } from '../constants';
import { getKitOffset, getHairSkinOffset, getFlagOffset } from '../readers/UniformReader';

function rgbToSnesBytes(color) {
  const r5 = Math.round(color.r / 8) & 0x1f;
  const g5 = Math.round(color.g / 8) & 0x1f;
  const b5 = Math.round(color.b / 8) & 0x1f;
  const val = r5 | (g5 << 5) | (b5 << 10);
  return [val & 0xff, (val >> 8) & 0xff];
}

export function writeUniformColor(rom, teamIndex, kit, part, colorIndex, color) {
  const teamId = TEAMS[teamIndex].id;
  const offset = getKitOffset(teamId, kit);
  if (offset === null) return;

  let byteOffset;
  if (kit === 'goalkeeper') {
    if (part === 'shirtAndSocks') byteOffset = colorIndex * 2;
    else if (part === 'shorts') byteOffset = 10 + colorIndex * 2;
    else return;
  } else {
    if (part === 'shirt') byteOffset = colorIndex * 2;
    else if (part === 'shorts') byteOffset = 6 + colorIndex * 2;
    else if (part === 'socks') byteOffset = 12 + colorIndex * 2;
    else return;
  }

  const snesBytes = rgbToSnesBytes(color);
  rom.writeByte(offset + byteOffset, snesBytes[0]);
  rom.writeByte(offset + byteOffset + 1, snesBytes[1]);
}

export function writeHairSkinColor(rom, teamIndex, kit, part, colorIndex, color) {
  const teamId = TEAMS[teamIndex].id;
  const offset = getHairSkinOffset(teamId, kit);
  if (offset === null) return;

  const byteOffset = part === 'hair' ? colorIndex * 2 : 2 + colorIndex * 2;
  const snesBytes = rgbToSnesBytes(color);
  rom.writeByte(offset + byteOffset, snesBytes[0]);
  rom.writeByte(offset + byteOffset + 1, snesBytes[1]);
}

export function writeFlagColor(rom, teamIndex, colorIndex, color) {
  const teamId = TEAMS[teamIndex].id;
  const offset = getFlagOffset(teamId);
  if (offset === null) return;

  const snesBytes = rgbToSnesBytes(color);
  rom.writeByte(offset + colorIndex * 2, snesBytes[0]);
  rom.writeByte(offset + colorIndex * 2 + 1, snesBytes[1]);
}

export function writeSpecialHair(rom, teamIndex, typeId) {
  const ordinal = FLAG_DESIGN_ORDINALS[teamIndex];
  if (ordinal === undefined) return;
  const offset = SPECIAL_HAIR.OFFSET + ordinal * SPECIAL_HAIR.STEP;
  const type = SPECIAL_HAIR.TYPES.find((t) => t.id === typeId);
  if (!type) return;
  rom.writeByte(offset, type.bytes[0]);
  rom.writeByte(offset + 1, type.bytes[1]);
}

export function writeSpecialSkin(rom, teamIndex, typeId) {
  const ordinal = FLAG_DESIGN_ORDINALS[teamIndex];
  if (ordinal === undefined) return;
  const offset = SPECIAL_SKIN.OFFSET + ordinal * SPECIAL_SKIN.STEP;
  const type = SPECIAL_SKIN.TYPES.find((t) => t.id === typeId);
  if (!type) return;
  rom.writeByte(offset, type.bytes[0]);
  rom.writeByte(offset + 1, type.bytes[1]);
}
