/**
 * Team name writer
 * Writes BOTH:
 * 1. Positional tile text (selection menu)
 * 2. Compressed tile graphics (in-game HUD) — with displacement to P17000 region
 */
import { TEAMS, FLAG_DESIGN_ORDINALS } from '../constants';
import { generateTeamNameData, MAX_TEAM_NAME_SIZE } from '../TeamNameGenerator';
import { renderTextToPixels, encode2bppTiles } from '../TeamNameTileFont';
import { konamiCompress } from '../KonamiCodec';

const TEAM_NAME_POINTER_OFFSET = 0x39dae;
const TEAM_NAME_POINTER_STEP = 2;
const TILE_NAME_POINTER_OFFSET = 0x93cd;
const TILE_NAME_POINTER_STEP = 2;
const TILE_FORMAT_FLAG_OFFSET = 0x93c6;
const P17000_FLAG = 0x82;
const TEAM_COUNT = 27;
const MAXIMUM_ADDRESS = 0x44486; // Upper limit for positional text region (same as ISS Studio)
const TILE_FORMAT_OFFSETS = [
  0x93c6, 0x93cb, 0x3a7eb, 0x3a7f0, 0x3a7f5, 0x3a7fa, 0x3a7ff, 0x3a804, 0x3a809, 0x3a80e,
];

export function writeTeamNameText(rom, teamIndex, text) {
  try {
    // Fix shared pointers if needed (same as ISS Studio)
    fixSharedPointersIfNecessary(rom);

    // 1. Write positional text (selection menu)
    const success = writePositionalText(rom, teamIndex, text);

    // 2. Write in-game tile graphics (HUD during match)
    displaceTeamNameTilesIfNecessary(rom);
    writeTileGraphicsP17(rom, teamIndex, text);

    return success;
  } catch (e) {
    console.error('Failed to write team name:', e);
    return false;
  }
}

/**
 * Write ONLY the positional text (selection menu name).
 * Does NOT touch the in-game tile graphics.
 */
export function writeTeamNameMenu(rom, teamIndex, text) {
  try {
    fixSharedPointersIfNecessary(rom);
    return writePositionalText(rom, teamIndex, text);
  } catch (e) {
    console.error('Failed to write menu name:', e);
    return false;
  }
}

/**
 * Write ONLY the in-game tile graphics (scoreboard/HUD).
 * Does NOT touch the positional text (selection menu).
 */
export function writeTeamNameInGame(rom, teamIndex, text) {
  try {
    displaceTeamNameTilesIfNecessary(rom);
    writeTileGraphicsP17(rom, teamIndex, text);
    return true;
  } catch (e) {
    console.error('Failed to write in-game name:', e);
    return false;
  }
}

/**
 * Calculate the maximum number of characters that can fit in a team's slot.
 * Shows what fits in the CURRENT slot size (guaranteed safe without expansion).
 * @param {object} rom - ROM data
 * @param {number} teamIndex - Team index (0-26)
 * @returns {number} Maximum characters that fit in current slot
 */
export function getSlotMaxChars(rom, teamIndex) {
  const ord = TEAM_NAME_ORDINALS[teamIndex];
  const ptrOffset = TEAM_NAME_POINTER_OFFSET + ord * TEAM_NAME_POINTER_STEP;
  const addr = readPointerP40000(rom, ptrOffset);
  const count = rom.readByte(addr);
  const currentSize = count * 4 + 1;

  // Find max chars that fit in the current slot size
  for (let chars = 10; chars >= 1; chars--) {
    const testName = 'A'.repeat(chars);
    const testData = generateTeamNameData(testName);
    if (testData.length <= currentSize) {
      return chars;
    }
  }
  return 3;
}

// === Fix shared pointers (same as ISS Studio's fixSharedPointersIfNecessary) ===
// These patches ensure each team has independent pointers and the data after
// the name region is valid after shifts.

const SHARED_PTR_PATCH_39D78 = new Uint8Array([
  0x00, 0x10, 0x30, 0x10, 0x60, 0x10, 0x90, 0x10, 0xc0, 0x10, 0x00, 0x12, 0x30, 0x12, 0x60, 0x12,
  0x90, 0x12, 0xc0, 0x12, 0x00, 0x14, 0x30, 0x14, 0x60, 0x14, 0x90, 0x14, 0xc0, 0x14, 0x00, 0x16,
  0x30, 0x16, 0x60, 0x16, 0x90, 0x16, 0xc0, 0x16, 0x00, 0x18, 0x30, 0x18, 0x60, 0x18, 0x90, 0x18,
  0xc0, 0x18, 0x00, 0x1a, 0x30, 0x1a,
]);

const SHARED_PTR_PATCH_444EB = new Uint8Array([
  0x02, 0x00, 0x08, 0x87, 0x13, 0x00, 0x00, 0x86, 0x13, 0x02, 0x00, 0x08, 0x6a, 0x13, 0x00, 0x00,
  0x69, 0x13, 0x02, 0x00, 0x08, 0x47, 0x13, 0x00, 0x00, 0x46, 0x13, 0x02, 0x00, 0x08, 0x6d, 0x13,
  0x00, 0x00, 0x6c, 0x13, 0x02, 0x00, 0x08, 0x8d, 0x13, 0x00, 0x00, 0x8c, 0x13, 0x02, 0x00, 0x08,
  0x81, 0x13, 0x00, 0x00, 0x80, 0x13, 0x02, 0x00, 0x08, 0x0d, 0x13, 0x00, 0x00, 0x0c, 0x13, 0x02,
  0x00, 0x08, 0x27, 0x13, 0x00, 0x00, 0x26, 0x13, 0x02, 0x00, 0x08, 0x01, 0x13, 0x00, 0x00, 0x00,
  0x13, 0x02, 0x00, 0x08, 0x07, 0x13, 0x00, 0x00, 0x06, 0x13, 0x02, 0x00, 0x08, 0x67, 0x13, 0x00,
  0x00, 0x66, 0x13, 0x02, 0x00, 0x08, 0x24, 0x13, 0x00, 0x00, 0x23, 0x13, 0x02, 0x00, 0x08, 0x44,
  0x13, 0x00, 0x00, 0x43, 0x13, 0x02, 0x00, 0x08, 0x04, 0x13, 0x00, 0x00, 0x03, 0x13, 0x02, 0x00,
  0x08, 0x2a, 0x13, 0x00, 0x00, 0x29, 0x13, 0x02, 0x00, 0x08, 0x84, 0x13, 0x00, 0x00, 0x83, 0x13,
  0x02, 0x00, 0x08, 0x8a, 0x13, 0x00, 0x00, 0x89, 0x13, 0x02, 0x00, 0x08, 0x4a, 0x13, 0x00, 0x00,
  0x49, 0x13, 0x02, 0x00, 0x08, 0x21, 0x13, 0x00, 0x00, 0x20, 0x13, 0x02, 0x00, 0x08, 0xa1, 0x13,
  0x00, 0x00, 0xa0, 0x13, 0x02, 0x00, 0x08, 0x0a, 0x13, 0x00, 0x00, 0x09, 0x13, 0x02, 0x00, 0x08,
  0x2d, 0x13, 0x00, 0x00, 0x2c, 0x13, 0x02, 0x00, 0x08, 0x64, 0x13, 0x00, 0x00, 0x63, 0x13, 0x02,
  0x00, 0x08, 0xa4, 0x13, 0x00, 0x00, 0xa3, 0x13, 0x02, 0x00, 0x08, 0x61, 0x13, 0x00, 0x00, 0x60,
  0x13, 0x02, 0x00, 0x08, 0x4d, 0x13, 0x00, 0x00, 0x4c, 0x13, 0x02, 0x00, 0x08, 0x41, 0x13, 0x00,
  0x00, 0x40, 0x13,
]);

function fixSharedPointersIfNecessary(rom) {
  // Check if already patched (0x39D78)
  const current39D78 = rom.readBytes(0x39d78, SHARED_PTR_PATCH_39D78.length);
  let needsPatch1 = false;
  for (let i = 0; i < SHARED_PTR_PATCH_39D78.length; i++) {
    if (current39D78[i] !== SHARED_PTR_PATCH_39D78[i]) {
      needsPatch1 = true;
      break;
    }
  }

  if (needsPatch1) {
    console.log('[TeamName] PATCH: Writing shared pointer fix at 0x39D78 (54 bytes)');
    rom.writeBytes(0x39d78, SHARED_PTR_PATCH_39D78);
  }

  // Check if already patched (0x444EB)
  const current444EB = rom.readBytes(0x444eb, SHARED_PTR_PATCH_444EB.length);
  let needsPatch2 = false;
  for (let i = 0; i < SHARED_PTR_PATCH_444EB.length; i++) {
    if (current444EB[i] !== SHARED_PTR_PATCH_444EB[i]) {
      needsPatch2 = true;
      break;
    }
  }

  if (needsPatch2) {
    console.log('[TeamName] PATCH: Writing shared pointer fix at 0x444EB (243 bytes)');
    rom.writeBytes(0x444eb, SHARED_PTR_PATCH_444EB);
  }

  if (!needsPatch1 && !needsPatch2) {
    console.log('[TeamName] Patches already applied');
  }
}

// === Positional Text (selection menu) ===

// Team name text ordinals: maps our TEAMS array index to the ISS Studio enum ordinal
// (which is the pointer position in the 0x39DAE table)
// ISS Studio enum: GERMANY=0, ITALY=1, HOLLAND=2, SPAIN=3, ENGLAND=4, SCOTLAND=5,
// WALES=6, FRANCE=7, DENMARK=8, SWEDEN=9, NORWAY=10, IRELAND=11, BELGIUM=12,
// AUSTRIA=13, SWITZ=14, ROMANIA=15, BULGARIA=16, RUSSIA=17, ARGENTINA=18,
// BRAZIL=19, COLOMBIA=20, MEXICO=21, USA=22, NIGERIA=23, CAMEROON=24, SKOREA=25, SUPERSTAR=26
const TEAM_NAME_ORDINALS = [
  0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 5, 25, 26,
];

function writePositionalText(rom, teamIndex, text) {
  const ordinal = TEAM_NAME_ORDINALS[teamIndex];
  const addressMap = buildAddressMap(rom);
  const current = addressMap.find((e) => e.teamIndex === teamIndex);

  // Try the full name first, then progressively shorter until it fits
  let nameToWrite = text;
  let newData = generateTeamNameData(nameToWrite);
  let newSize = newData.length;
  let delta = newSize - current.size;

  // Check if shift would exceed the limit
  if (delta > 0) {
    const toMove = addressMap.filter((e) => e.address > current.address);
    if (toMove.length > 0) {
      const lastEntry = toMove.sort((a, b) => a.address - b.address)[toMove.length - 1];
      const wouldExceed = lastEntry.address + lastEntry.size + delta > MAXIMUM_ADDRESS;

      if (wouldExceed) {
        // Truncate name progressively until it fits
        while (nameToWrite.length > 1 && delta > 0) {
          nameToWrite = nameToWrite.substring(0, nameToWrite.length - 1);
          newData = generateTeamNameData(nameToWrite);
          newSize = newData.length;
          delta = newSize - current.size;
        }

        // If still too big even at 1 char, try to fit without expansion (delta <= 0)
        if (delta > 0) {
          console.warn(`[TeamName] Cannot fit any text in slot for team ${teamIndex}`);
          return false;
        }
        console.log(`[TeamName] Truncated "${text}" to "${nameToWrite}" to fit ROM space`);
      }
    }
  }

  if (delta !== 0) {
    const toMove = addressMap
      .filter((e) => e.address > current.address)
      .sort((a, b) => a.address - b.address);

    if (toMove.length > 0) {
      // Move data: iterate from last to first when shifting forward
      if (delta > 0) {
        for (let i = toMove.length - 1; i >= 0; i--) {
          const entry = toMove[i];
          const data = rom.readBytes(entry.address, entry.size);
          rom.writeBytes(entry.address + delta, data);
        }
      } else {
        for (let i = 0; i < toMove.length; i++) {
          const entry = toMove[i];
          const data = rom.readBytes(entry.address, entry.size);
          rom.writeBytes(entry.address + delta, data);
        }
      }

      // Update pointers for moved teams
      for (const entry of toMove) {
        const ptrOffset = TEAM_NAME_POINTER_OFFSET + entry.ordinal * TEAM_NAME_POINTER_STEP;
        writePointerP40000(rom, ptrOffset, entry.address + delta);
      }
    }
  }

  // Write new data at the original address
  rom.writeBytes(current.address, newData);

  // Only zero-pad freed space if NO teams were shifted (i.e., this is the last team in ROM)
  // When teams are shifted backward, they occupy the "freed" space - don't overwrite them!
  if (newSize < current.size) {
    const toMoveCheck = addressMap.filter((e) => e.address > current.address);
    if (toMoveCheck.length === 0) {
      // Safe to zero-pad: no team data after this one
      rom.writeBytes(current.address + newSize, new Uint8Array(current.size - newSize));
    }
  }

  console.log(
    `[TeamName] Positional text "${nameToWrite}" at 0x${current.address.toString(16)} (${newSize}B, was ${current.size}B, delta ${delta})`,
  );
  return true;
}

function writePointerP40000(rom, pointerOffset, address) {
  const relative = address - 0x40000;
  const b1 = relative & 0xff;
  const b2 = ((relative >> 8) & 0xff) + 0x80;
  rom.writeByte(pointerOffset, b1);
  rom.writeByte(pointerOffset + 1, b2);
}

function buildAddressMap(rom) {
  const addressMap = [];
  for (let i = 0; i < TEAM_COUNT; i++) {
    const ord = TEAM_NAME_ORDINALS[i];
    const ptrOffset = TEAM_NAME_POINTER_OFFSET + ord * TEAM_NAME_POINTER_STEP;
    const addr = readPointerP40000(rom, ptrOffset);
    const count = rom.readByte(addr);
    const size = count * 4 + 1;
    addressMap.push({ teamIndex: i, ordinal: ord, address: addr, size });
  }
  return addressMap;
}

// === Displacement: move all tile graphics from P48000 to P17000 (same as ISS Studio) ===

function displaceTeamNameTilesIfNecessary(rom) {
  // Check if already displaced
  const formatByte = rom.readByte(TILE_FORMAT_FLAG_OFFSET);
  if (formatByte === P17000_FLAG) {
    console.log('[TileName] Already displaced to P17000');
    return;
  }

  console.log('[TileName] === DISPLACING TILES P48000 → P17000 ===');
  let newAddress = 0x17680;
  let pointerOffset = TILE_NAME_POINTER_OFFSET;

  for (let i = 0; i < TEAM_COUNT; i++) {
    // Read P48000 pointer (sequential order, same as ISS Studio)
    const b1 = rom.readByte(pointerOffset);
    const b2 = rom.readByte(pointerOffset + 1);
    const originalAddress = 0x40000 + ((b2 & 0xff) << 8) + (b1 & 0xff);

    // Read block size (first byte of compressed data)
    const size = rom.readByte(originalAddress);
    if (size === 0 || size > 200) {
      console.warn(
        `[TileName] Team ${i}: SKIP invalid size ${size} at 0x${originalAddress.toString(16)}`,
      );
      pointerOffset += TILE_NAME_POINTER_STEP;
      continue;
    }

    // Copy data to P17000 region (do NOT zero original - flag data may share P48000 region)
    const data = rom.readBytes(originalAddress, size);
    rom.writeBytes(newAddress, data);

    // Update pointer to P17000 format
    const snesAddr = newAddress - 0x8000;
    const newB1 = snesAddr & 0xff;
    const newB2 = (snesAddr >> 8) & 0xff;
    rom.writeByte(pointerOffset, newB1);
    rom.writeByte(pointerOffset + 1, newB2);

    console.log(
      `[TileName] Team ${i}: 0x${originalAddress.toString(16)} (${size}B) → 0x${newAddress.toString(16)} ptr=[${newB1.toString(16)},${newB2.toString(16)}]`,
    );

    pointerOffset += TILE_NAME_POINTER_STEP;
    newAddress += size;
  }

  // Set format flags at all required offsets (all 10 - needed for game to read from P17000)
  for (const offset of TILE_FORMAT_OFFSETS) {
    rom.writeByte(offset, P17000_FLAG);
  }

  console.log(`[TileName] === DISPLACEMENT DONE. End: 0x${newAddress.toString(16)} ===`);
}

// === Write tile graphics to P17000 region (after displacement) ===

const TILE_MAXIMUM_ADDRESS_P17 = 0x17fff; // Upper limit for P17000 tile region

/**
 * Build address map for all tile graphics in P17000 region
 * Each entry: { teamIndex, ordinal, address, size }
 */
function buildTileAddressMap(rom) {
  const map = [];
  for (let i = 0; i < TEAM_COUNT; i++) {
    const ord = TEAM_NAME_ORDINALS[i];
    const ptrOffset = TILE_NAME_POINTER_OFFSET + ord * TILE_NAME_POINTER_STEP;
    const addr = readTilePointerP17(rom, ptrOffset);
    if (addr < 0x17000 || addr > 0x1ffff) continue;
    const size = rom.readByte(addr); // first byte = compressed block size
    if (size === 0 || size > 200) continue;
    map.push({ teamIndex: i, ordinal: ord, address: addr, size });
  }
  return map;
}

/**
 * Read a P17000-format pointer
 */
function readTilePointerP17(rom, pointerOffset) {
  const b1 = rom.readByte(pointerOffset);
  const b2 = rom.readByte(pointerOffset + 1);
  return 0x10000 + (((b2 & 0xff) - 0x80) << 8) + (b1 & 0xff);
}

/**
 * Write a P17000-format pointer (address → SNES pointer bytes)
 */
function writeTilePointerP17(rom, pointerOffset, address) {
  const snesAddr = address - 0x8000;
  rom.writeByte(pointerOffset, snesAddr & 0xff);
  rom.writeByte(pointerOffset + 1, (snesAddr >> 8) & 0xff);
}

function writeTileGraphicsP17(rom, teamIndex, text) {
  const ordinal = TEAM_NAME_ORDINALS[teamIndex];
  const ptrOffset = TILE_NAME_POINTER_OFFSET + ordinal * TILE_NAME_POINTER_STEP;
  const dataAddr = readTilePointerP17(rom, ptrOffset);

  if (dataAddr < 0x17000 || dataAddr > 0x1ffff) {
    console.warn(
      `[TileName] WRITE FAIL: Invalid P17000 address 0x${dataAddr.toString(16)} for team ${teamIndex} (ord=${ordinal})`,
    );
    return;
  }

  // Read current block size (first byte of compressed data = total compressed length)
  const currentBlockSize = rom.readByte(dataAddr);

  // Render text to 2bpp tiles and compress
  const pixels = renderTextToPixels(text);
  const tileData = encode2bppTiles(pixels);
  const compressed = konamiCompress(tileData, 1);
  const newSize = compressed.length;

  console.log(
    `[TileName] WRITE team ${teamIndex} "${text}": addr=0x${dataAddr.toString(16)} slot=${currentBlockSize}B compressed=${newSize}B`,
  );

  const delta = newSize - currentBlockSize;

  if (delta > 0) {
    // New data is larger: need to shift subsequent blocks forward
    const tileMap = buildTileAddressMap(rom);
    const toMove = tileMap
      .filter((e) => e.address > dataAddr)
      .sort((a, b) => a.address - b.address);

    // Check if shifting would exceed the maximum address
    if (toMove.length > 0) {
      const lastEntry = toMove[toMove.length - 1];
      if (lastEntry.address + lastEntry.size + delta > TILE_MAXIMUM_ADDRESS_P17) {
        console.warn(
          `[TileName] WRITE FAIL: shifting would exceed P17 limit (last=0x${(lastEntry.address + lastEntry.size + delta).toString(16)} > 0x${TILE_MAXIMUM_ADDRESS_P17.toString(16)})`,
        );
        return;
      }
    }

    // Move data from last to first (to avoid overwriting)
    for (let i = toMove.length - 1; i >= 0; i--) {
      const entry = toMove[i];
      const blockData = rom.readBytes(entry.address, entry.size);
      rom.writeBytes(entry.address + delta, blockData);
    }

    // Update pointers for moved teams
    for (const entry of toMove) {
      const entryPtrOffset = TILE_NAME_POINTER_OFFSET + entry.ordinal * TILE_NAME_POINTER_STEP;
      writeTilePointerP17(rom, entryPtrOffset, entry.address + delta);
    }

    console.log(`[TileName] Shifted ${toMove.length} subsequent tile blocks by +${delta} bytes`);
  } else if (delta < 0) {
    // New data is smaller: shift subsequent blocks backward to reclaim space
    const tileMap = buildTileAddressMap(rom);
    const toMove = tileMap
      .filter((e) => e.address > dataAddr)
      .sort((a, b) => a.address - b.address);

    // Move data from first to last (shifting backward is safe in this order)
    for (let i = 0; i < toMove.length; i++) {
      const entry = toMove[i];
      const blockData = rom.readBytes(entry.address, entry.size);
      rom.writeBytes(entry.address + delta, blockData);
    }

    // Update pointers for moved teams
    for (const entry of toMove) {
      const entryPtrOffset = TILE_NAME_POINTER_OFFSET + entry.ordinal * TILE_NAME_POINTER_STEP;
      writeTilePointerP17(rom, entryPtrOffset, entry.address + delta);
    }

    console.log(`[TileName] Shifted ${toMove.length} subsequent tile blocks by ${delta} bytes`);
  }

  // Write new compressed data at the original address
  rom.writeBytes(dataAddr, compressed);
  console.log(`[TileName] WRITE OK: "${text}" at 0x${dataAddr.toString(16)} (${newSize}B)`);
}

// === Pointer utilities ===

function readPointerP40000(rom, pointerOffset) {
  const b1 = rom.readByte(pointerOffset);
  const b2 = rom.readByte(pointerOffset + 1);
  return 0x40000 + (((b2 & 0xff) - 0x80) << 8) + (b1 & 0xff);
}
