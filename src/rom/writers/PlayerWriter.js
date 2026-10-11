/**
 * Player data writer — names, attributes, hair, color
 */
import {
  PLAYER_NAMES,
  PLAYER_DATA,
  PLAYERS_PER_TEAM,
  SHOOTING_VALUES,
  ISS_CHAR_REVERSE,
} from '../constants';
import { clampStat, clampIndex } from '../playerStats';
import { playerDataAddress } from '../readers/PlayerReader';

export function writePlayerName(rom, teamIndex, playerIndex, name) {
  const baseAddr =
    PLAYER_NAMES.OFFSET +
    teamIndex * PLAYER_NAMES.TEAM_LENGTH +
    playerIndex * PLAYER_NAMES.NAME_LENGTH;
  const bytes = issTextToBytes(name, PLAYER_NAMES.NAME_LENGTH);
  rom.writeBytes(baseAddr, bytes);
}

export function writePlayerData(rom, teamIndex, playerIndex, playerData) {
  const baseAddr = playerDataAddress(rom, teamIndex) + playerIndex * PLAYER_DATA.PLAYER_LENGTH;

  // Start from the given block (or the slot's current bytes) so that fields not
  // present in playerData keep their value.
  const bytes = new Uint8Array(playerData.rawBytes || rom.readBytes(baseAddr, 6));
  const has = (k) => playerData[k] !== undefined && playerData[k] !== null;
  const nib = (k, current) => (has(k) ? clampStat(playerData[k]) - 1 : current);

  // Byte 0: top speed (hi) / start speed (lo)
  bytes[0] = (nib('topSpeed', bytes[0] >> 4) << 4) | nib('acceleration', bytes[0] & 0x0f);

  // Byte 1: shooting index (bits 6-4) / goalkeeper kick (lo, 0-7)
  const shootingIdx = has('shootingIndex')
    ? clampIndex(playerData.shootingIndex)
    : has('shooting')
      ? clampIndex(SHOOTING_VALUES.indexOf(playerData.shooting))
      : (bytes[1] >> 4) & 0x07;
  const gkKick = has('gkKickIndex') ? clampIndex(playerData.gkKickIndex) : bytes[1] & 0x0f;
  bytes[1] = (shootingIdx << 4) | gkKick;

  // Byte 2: stamina (hi) / technique index (bits 2-0)
  const staminaVal = has('stamina') ? clampStat(playerData.stamina) - 1 : bytes[2] >> 4;
  const techniqueIdx = has('techniqueIndex')
    ? clampIndex(playerData.techniqueIndex)
    : has('technique')
      ? clampIndex(SHOOTING_VALUES.indexOf(playerData.technique))
      : bytes[2] & 0x07;
  bytes[2] = (staminaVal << 4) | techniqueIdx;

  // Byte 3: dribble speed (hi) / shirt number - 1 (lo)
  const numVal = has('number') ? clampStat(playerData.number) - 1 : bytes[3] & 0x0f;
  bytes[3] = (nib('dribbleSpeed', bytes[3] >> 4) << 4) | numVal;

  // Byte 4: attack duel (hi) / defence duel (lo)
  bytes[4] = (nib('attack', bytes[4] >> 4) << 4) | nib('defense', bytes[4] & 0x0f);

  // Byte 5: color type (bit 6) / hair style (lo)
  if (has('hairStyle') || has('isSpecial')) {
    const hairVal = has('hairStyle') ? playerData.hairStyle & 0x0f : bytes[5] & 0x0f;
    const colorBits = has('isSpecial') ? (playerData.isSpecial ? 0x40 : 0x00) : bytes[5] & 0xc0;
    bytes[5] = colorBits | hairVal;
  }

  rom.writeBytes(baseAddr, bytes);
}

/**
 * Swap two players of the same team (name + full 6-byte data block).
 * Squad order defines the lineup: slots 1-11 start, and slot N plays the
 * position described by formation slot N.
 */
export function swapPlayers(rom, teamIndex, a, b) {
  if (a === b) return;
  if (a < 0 || b < 0 || a >= PLAYERS_PER_TEAM || b >= PLAYERS_PER_TEAM) {
    throw new Error('Player index out of range');
  }
  const nameAddr = (i) =>
    PLAYER_NAMES.OFFSET + teamIndex * PLAYER_NAMES.TEAM_LENGTH + i * PLAYER_NAMES.NAME_LENGTH;
  const dataAddr = (i) => playerDataAddress(rom, teamIndex) + i * PLAYER_DATA.PLAYER_LENGTH;

  const nameA = rom.readBytes(nameAddr(a), PLAYER_NAMES.NAME_LENGTH);
  const nameB = rom.readBytes(nameAddr(b), PLAYER_NAMES.NAME_LENGTH);
  rom.writeBytes(nameAddr(a), nameB);
  rom.writeBytes(nameAddr(b), nameA);

  const dataA = rom.readBytes(dataAddr(a), PLAYER_DATA.PLAYER_LENGTH);
  const dataB = rom.readBytes(dataAddr(b), PLAYER_DATA.PLAYER_LENGTH);
  rom.writeBytes(dataAddr(a), dataB);
  rom.writeBytes(dataAddr(b), dataA);
}

// --- Text encoding ---

function issTextToBytes(text, maxLength) {
  const bytes = new Uint8Array(maxLength);
  bytes.fill(0x00);
  for (let i = 0; i < Math.min(text.length, maxLength); i++) {
    const byteVal = ISS_CHAR_REVERSE[text[i]];
    bytes[i] = byteVal !== undefined ? byteVal : 0x00;
  }
  return bytes;
}
