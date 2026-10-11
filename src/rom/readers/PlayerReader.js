/**
 * Player data reader — names, attributes, hair, color
 */
import {
  PLAYERS_PER_TEAM,
  PLAYER_NAMES,
  PLAYER_DATA,
  HAIR_STYLES,
  ISS_CHAR_TABLE,
  FLAG_DESIGN_ORDINALS,
} from '../constants';
import { withDerivedStats } from '../playerStats';

/**
 * File offset of a team's 15 attribute blocks.
 * Unlike the names (TEAMS order), the blocks follow the ROM ordinal order
 * (Scotland = 5): the game reads them via the word table $01:DED7 indexed by the
 * team id, pointing into bank $87. Confirmed in the emulator (Scotland and Wales).
 */
export function playerDataAddress(rom, teamIndex) {
  const ordinal = FLAG_DESIGN_ORDINALS[teamIndex] ?? teamIndex;
  const fallback = PLAYER_DATA.BASE_OFFSET + ordinal * PLAYER_DATA.TEAM_LENGTH;
  if (!rom?.readBytes) return fallback;
  const [lo, hi] = rom.readBytes(PLAYER_DATA.POINTERS + ordinal * 2, 2);
  const ptr = lo | (hi << 8);
  // Valid pointers stay inside the original block area of bank $87
  if (ptr < 0x8000) return fallback;
  const addr = 0x38000 + (ptr - 0x8000);
  return addr >= PLAYER_DATA.BASE_OFFSET &&
    addr + PLAYER_DATA.TEAM_LENGTH <= PLAYER_DATA.BASE_OFFSET + 27 * PLAYER_DATA.TEAM_LENGTH
    ? addr
    : fallback;
}

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
  const baseAddr = playerDataAddress(rom, teamIndex);
  const players = [];

  for (let i = 0; i < PLAYERS_PER_TEAM; i++) {
    const playerAddr = baseAddr + i * PLAYER_DATA.PLAYER_LENGTH;
    const bytes = rom.readBytes(playerAddr, PLAYER_DATA.PLAYER_LENGTH);

    const [byte0, byte1, byte2, byte3, byte4, byte5] = bytes;

    const shootingIndex = (byte1 >> 4) & 0x07;
    // b1.lo: goalkeeper kick power. The game caps the charge at 7 + 4, so 8-15 act as 7.
    const gkKickIndex = Math.min(7, byte1 & 0x0f);
    const stamina = ((byte2 >> 4) & 0x0f) + 1;
    const techniqueIndex = byte2 & 0x07;
    const number = (byte3 & 0x0f) + 1;
    const hairStyleId = byte5 & 0x0f;
    const hairStyle = hairStyleId < HAIR_STYLES.length ? hairStyleId : 0;
    const isSpecial = (byte5 & 0xc0) > 0;

    players.push(
      withDerivedStats({
        index: i,
        number,
        shootingIndex,
        stamina,
        techniqueIndex,
        gkKickIndex,
        acceleration: (byte0 & 0x0f) + 1,
        topSpeed: ((byte0 >> 4) & 0x0f) + 1,
        dribbleSpeed: ((byte3 >> 4) & 0x0f) + 1,
        defense: (byte4 & 0x0f) + 1,
        attack: ((byte4 >> 4) & 0x0f) + 1,
        hairStyle,
        isSpecial,
        rawBytes: Array.from(bytes),
      }),
    );
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
