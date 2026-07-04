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

export function writePlayerName(rom, teamIndex, playerIndex, name) {
  const baseAddr =
    PLAYER_NAMES.OFFSET +
    teamIndex * PLAYER_NAMES.TEAM_LENGTH +
    playerIndex * PLAYER_NAMES.NAME_LENGTH;
  const bytes = issTextToBytes(name, PLAYER_NAMES.NAME_LENGTH);
  rom.writeBytes(baseAddr, bytes);
}

export function writePlayerData(rom, teamIndex, playerIndex, playerData) {
  const baseAddr =
    PLAYER_DATA.BASE_OFFSET +
    teamIndex * PLAYER_DATA.TEAM_LENGTH +
    playerIndex * PLAYER_DATA.PLAYER_LENGTH;

  const bytes = new Uint8Array(playerData.rawBytes || rom.readBytes(baseAddr, 6));

  const shootingIdx =
    playerData.shootingIndex !== undefined
      ? playerData.shootingIndex
      : SHOOTING_VALUES.indexOf(playerData.shooting);
  const speedVal = Math.max(0, Math.min(15, (playerData.speed || 1) - 1));
  bytes[1] = ((shootingIdx & 0x07) << 4) | (speedVal & 0x0f);

  const staminaVal = Math.max(0, Math.min(15, (playerData.stamina || 1) - 1));
  const techniqueIdx =
    playerData.techniqueIndex !== undefined
      ? playerData.techniqueIndex
      : SHOOTING_VALUES.indexOf(playerData.technique);
  bytes[2] = ((staminaVal & 0x0f) << 4) | (techniqueIdx & 0x07);

  const numVal = Math.max(0, Math.min(15, (playerData.number || 1) - 1));
  bytes[3] = (bytes[3] & 0xf0) | (numVal & 0x0f);

  const hairVal = playerData.hairStyle & 0x0f;
  const colorBits = playerData.isSpecial ? 0x40 : 0x00;
  bytes[5] = colorBits | hairVal;

  rom.writeBytes(baseAddr, bytes);
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
