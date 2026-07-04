/**
 * Player data reader — names, attributes, hair, color
 */
import {
  PLAYERS_PER_TEAM,
  PLAYER_NAMES,
  PLAYER_DATA,
  HAIR_STYLES,
  SHOOTING_VALUES,
  ISS_CHAR_TABLE,
} from '../constants';

export function readPlayerNames(rom, teamIndex) {
  const baseAddr = PLAYER_NAMES.OFFSET + teamIndex * PLAYER_NAMES.TEAM_LENGTH;
  const names = [];
  for (let i = 0; i < PLAYERS_PER_TEAM; i++) {
    const nameAddr = baseAddr + i * PLAYER_NAMES.NAME_LENGTH;
    const bytes = rom.readBytes(nameAddr, PLAYER_NAMES.NAME_LENGTH);
    names.push(bytesToIssText(bytes).trim());
  }
  return names;
}

export function readPlayerData(rom, teamIndex) {
  const baseAddr = PLAYER_DATA.BASE_OFFSET + teamIndex * PLAYER_DATA.TEAM_LENGTH;
  const players = [];

  for (let i = 0; i < PLAYERS_PER_TEAM; i++) {
    const playerAddr = baseAddr + i * PLAYER_DATA.PLAYER_LENGTH;
    const bytes = rom.readBytes(playerAddr, PLAYER_DATA.PLAYER_LENGTH);

    const byte1 = bytes[1],
      byte2 = bytes[2],
      byte3 = bytes[3],
      byte5 = bytes[5];

    const shootingIndex = (byte1 >> 4) & 0x07;
    const shooting = SHOOTING_VALUES[shootingIndex];
    const speed = (byte1 & 0x0f) + 1;
    const stamina = ((byte2 >> 4) & 0x0f) + 1;
    const techniqueIndex = byte2 & 0x07;
    const technique = SHOOTING_VALUES[techniqueIndex];
    const number = (byte3 & 0x0f) + 1;
    const hairStyleId = byte5 & 0x0f;
    const hairStyle = hairStyleId < HAIR_STYLES.length ? hairStyleId : 0;
    const isSpecial = (byte5 & 0xc0) > 0;

    players.push({
      index: i,
      number,
      shooting,
      shootingIndex,
      speed,
      stamina,
      technique,
      techniqueIndex,
      hairStyle,
      isSpecial,
      rawBytes: Array.from(bytes),
    });
  }
  return players;
}

// --- Text encoding ---

export function bytesToIssText(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i++) {
    const char = ISS_CHAR_TABLE[bytes[i] & 0xff];
    text += char !== undefined ? char : '';
  }
  return text;
}
