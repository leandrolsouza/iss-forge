/**
 * Flag design writer — encode, compress, and relocate data in ROM
 *
 * Matches the reference Java editor (FlagDesignRomHandler) behavior:
 * - Reads all flag pointer addresses and their compressed sizes
 * - When new compressed data is larger, shifts subsequent blocks forward
 * - Updates all affected pointers in the pointer table
 * - Enforces maximum address boundary (0x48A7F)
 */
import { FLAG_DESIGN_ORDINALS, TEAM_COUNT } from '../constants';
import { konamiCompress, encodeSnes4bppTiles } from '../KonamiCodec';
import { readFlagPointer } from '../readers/FlagDesignReader';

const FLAG_POINTER_OFFSET = 0x941a;
const FLAG_POINTER_STEP = 4;
const MAXIMUM_ADDRESS = 0x48a7f;

/**
 * ROM ranges a flag-design write can touch (pointer table + compressed data,
 * blocks shift). Snapshotted for exact undo: recompression is not byte-identical.
 */
export const FLAG_DESIGN_REGIONS = [
  [FLAG_POINTER_OFFSET, TEAM_COUNT * FLAG_POINTER_STEP],
  [0x48000, MAXIMUM_ADDRESS - 0x48000 + 1],
];

export function readFlagDesignBytes(rom) {
  return FLAG_DESIGN_REGIONS.map(([start, len]) => Array.from(rom.readBytes(start, len)));
}

export function writeFlagDesignBytes(rom, snapshot) {
  if (!Array.isArray(snapshot) || snapshot.length !== FLAG_DESIGN_REGIONS.length) return;
  FLAG_DESIGN_REGIONS.forEach(([start], i) => rom.writeBytes(start, snapshot[i]));
}

/**
 * Read the compressed size stored in the first 2 bytes at a given ROM address
 * (Konami format: first 2 bytes = total compressed size including header)
 */
function readCompressedSize(rom, addr) {
  const b1 = rom.readByte(addr);
  const b2 = rom.readByte(addr + 1);
  return (b2 << 8) | b1;
}

/**
 * Write a flag pointer (2 bytes, little-endian, relative to 0x40000)
 */
function writeFlagPointer(rom, pointerOffset, address) {
  const relative = address - 0x40000;
  rom.writeByte(pointerOffset, relative & 0xff);
  rom.writeByte(pointerOffset + 1, (relative >> 8) & 0xff);
}

/**
 * Build a map of all flag addresses with their sizes for all teams.
 * Returns an array of { ordinal, topAddr, topSize, bottomAddr, bottomSize }
 */
function readAllFlagAddresses(rom) {
  const entries = [];
  for (let i = 0; i < TEAM_COUNT; i++) {
    const ordinal = FLAG_DESIGN_ORDINALS[i];
    const ptrOffset = FLAG_POINTER_OFFSET + ordinal * FLAG_POINTER_STEP;
    const topAddr = readFlagPointer(rom, ptrOffset);
    const bottomAddr = readFlagPointer(rom, ptrOffset + 2);
    const topSize = readCompressedSize(rom, topAddr);
    const bottomSize = readCompressedSize(rom, bottomAddr);
    entries.push({ teamIndex: i, ordinal, topAddr, topSize, bottomAddr, bottomSize });
  }
  return entries;
}

/**
 * Collect all unique address blocks (deduped, since teams can share flags)
 * Returns sorted array of { address, size }
 */
function getUniqueBlocks(entries) {
  const blockMap = new Map();
  for (const entry of entries) {
    if (!blockMap.has(entry.topAddr)) {
      blockMap.set(entry.topAddr, entry.topSize);
    }
    if (!blockMap.has(entry.bottomAddr)) {
      blockMap.set(entry.bottomAddr, entry.bottomSize);
    }
  }
  const blocks = [];
  for (const [address, size] of blockMap) {
    blocks.push({ address, size });
  }
  blocks.sort((a, b) => a.address - b.address);
  return blocks;
}

/**
 * Teams that draw their flag from the same compressed blocks as `teamIndex` (the
 * original ROM shares 4 groups: ITA+BEL, GER+HOL+AUT+RUS, FRA+IRL, ENG+DEN+SWE+NOR).
 * @returns {number[]} the other teams (TEAMS indexes)
 */
export function flagSharedWith(rom, teamIndex) {
  const entries = readAllFlagAddresses(rom);
  const me = entries[teamIndex];
  if (!me) return [];
  const mine = new Set([me.topAddr, me.bottomAddr]);
  return entries
    .filter((e) => e.teamIndex !== teamIndex && (mine.has(e.topAddr) || mine.has(e.bottomAddr)))
    .map((e) => e.teamIndex);
}

const REVERSE_INDEX = [0, 12, 13, 14, 15];

/** Compressed top and bottom halves of a 24×16 design (palette indexes 0-4) */
function compressFlagDesign(grid) {
  const half = (rows) =>
    konamiCompress(
      encodeSnes4bppTiles(rows.map((row) => row.map((pixel) => REVERSE_INDEX[pixel] || 0))),
      1,
    );
  return [half(grid.slice(0, 8)), half(grid.slice(8, 16))];
}

/** Bytes a design takes in the flag area (both compressed halves) */
export function flagDesignSize(grid) {
  return compressFlagDesign(grid).reduce((n, block) => n + block.length, 0);
}

/**
 * Room in the flag area: `free` bytes after the last block, and the bytes of each
 * team's own blocks (0 for blocks shared with other teams, which an edit leaves
 * where they are). A team can be rewritten with `ownSize + its part of free`.
 */
export function flagAreaUsage(rom) {
  const entries = readAllFlagAddresses(rom);
  const blocks = getUniqueBlocks(entries);
  const end = Math.max(...blocks.map((b) => b.address + b.size));
  const users = new Map();
  for (const e of entries) {
    for (const addr of [e.topAddr, e.bottomAddr]) users.set(addr, (users.get(addr) || 0) + 1);
  }
  const ownSize = entries.map((e) =>
    users.get(e.topAddr) === 1 && users.get(e.bottomAddr) === 1 ? e.topSize + e.bottomSize : 0,
  );
  return { free: Math.max(0, MAXIMUM_ADDRESS - end), ownSize };
}

export function writeFlagDesign(rom, teamIndex, grid) {
  try {
    const ordinal = FLAG_DESIGN_ORDINALS[teamIndex];
    const ptrOffset = FLAG_POINTER_OFFSET + ordinal * FLAG_POINTER_STEP;
    const topAddr = readFlagPointer(rom, ptrOffset);
    const bottomAddr = readFlagPointer(rom, ptrOffset + 2);
    const oldTopSize = readCompressedSize(rom, topAddr);
    const oldBottomSize = readCompressedSize(rom, bottomAddr);

    // Encode to SNES 4bpp tiles and compress with full LZ algorithm
    const [topCompressed, bottomCompressed] = compressFlagDesign(grid);

    // Blocks shared with other teams: give this team its own copy at the end of the
    // used area instead of changing the other flags too
    if (flagSharedWith(rom, teamIndex).length) {
      const blocks = getUniqueBlocks(readAllFlagAddresses(rom));
      const end = Math.max(...blocks.map((b) => b.address + b.size));
      if (end + topCompressed.length + bottomCompressed.length - 1 > MAXIMUM_ADDRESS) return false;
      rom.writeBytes(end, topCompressed);
      rom.writeBytes(end + topCompressed.length, bottomCompressed);
      writeFlagPointer(rom, ptrOffset, end);
      writeFlagPointer(rom, ptrOffset + 2, end + topCompressed.length);
      return true;
    }

    const newTopSize = topCompressed.length;
    const newBottomSize = bottomCompressed.length;

    const topDelta = newTopSize - oldTopSize;
    const bottomDelta = newBottomSize - oldBottomSize;

    // If sizes didn't change (or got smaller), write in-place — simple case
    if (topDelta <= 0 && bottomDelta <= 0) {
      rom.writeBytes(topAddr, topCompressed);
      rom.writeBytes(bottomAddr, bottomCompressed);
      // Zero-fill leftover bytes to avoid stale data
      if (topDelta < 0) {
        const zeroFill = new Uint8Array(-topDelta);
        rom.writeBytes(topAddr + newTopSize, zeroFill);
      }
      if (bottomDelta < 0) {
        const zeroFill = new Uint8Array(-bottomDelta);
        rom.writeBytes(bottomAddr + newBottomSize, zeroFill);
      }
      return true;
    }

    // Need relocation — read all flag addresses and shift data forward
    const entries = readAllFlagAddresses(rom);
    const uniqueBlocks = getUniqueBlocks(entries);

    // Determine which block addresses are "after" our target blocks and need shifting
    const targetAddrs = new Set([topAddr, bottomAddr]);

    // Calculate displacement for each block that sits after any of our target blocks
    const displacements = new Map();
    for (const block of uniqueBlocks) {
      if (targetAddrs.has(block.address)) continue;
      let displacement = 0;
      if (block.address > topAddr) displacement += topDelta;
      if (block.address > bottomAddr) displacement += bottomDelta;
      if (displacement > 0) {
        displacements.set(block.address, displacement);
      }
    }

    // Also calculate new position for whichever of top/bottom comes second
    let newTopAddr = topAddr;
    let newBottomAddr = bottomAddr;
    if (topAddr > bottomAddr) {
      // top is after bottom, it needs to shift by bottomDelta
      newTopAddr = topAddr + bottomDelta;
      displacements.set(topAddr, bottomDelta);
    } else if (bottomAddr > topAddr) {
      // bottom is after top, it needs to shift by topDelta
      newBottomAddr = bottomAddr + topDelta;
      displacements.set(bottomAddr, topDelta);
    }

    // Check maximum address boundary
    const lastBlock = uniqueBlocks[uniqueBlocks.length - 1];
    const lastDisp = displacements.get(lastBlock.address) || 0;
    const finalEnd = lastBlock.address + lastBlock.size + lastDisp;
    if (finalEnd > MAXIMUM_ADDRESS) {
      console.error(
        `Flag design write would exceed ROM space. ` +
          `End: 0x${finalEnd.toString(16)}, Max: 0x${MAXIMUM_ADDRESS.toString(16)}`,
      );
      return false;
    }

    // Move blocks from back to front (to avoid overwriting data we still need)
    // Process blocks in reverse order of address, skip the target blocks
    // (we'll write them fresh with compressed data)
    const blocksToMove = [...displacements.entries()]
      .filter(([addr]) => addr !== topAddr && addr !== bottomAddr)
      .sort((a, b) => b[0] - a[0]);

    for (const [blockAddr, displacement] of blocksToMove) {
      const block = uniqueBlocks.find((b) => b.address === blockAddr);
      const blockData = rom.readBytes(blockAddr, block.size);
      rom.writeBytes(blockAddr + displacement, blockData);
    }

    // Write new compressed data at the correct positions
    // Write the later block first (back to front) to prevent overlap issues
    if (newTopAddr >= newBottomAddr) {
      rom.writeBytes(newTopAddr, topCompressed);
      rom.writeBytes(newBottomAddr, bottomCompressed);
    } else {
      rom.writeBytes(newBottomAddr, bottomCompressed);
      rom.writeBytes(newTopAddr, topCompressed);
    }

    // Update pointers for all teams whose blocks were displaced
    for (let i = 0; i < TEAM_COUNT; i++) {
      const entry = entries[i];
      const entryPtrOffset = FLAG_POINTER_OFFSET + entry.ordinal * FLAG_POINTER_STEP;

      let updatedTop = entry.topAddr;
      let updatedBottom = entry.bottomAddr;

      // Check if this team's top pointer needs updating
      if (entry.topAddr === topAddr) {
        updatedTop = newTopAddr;
      } else if (displacements.has(entry.topAddr)) {
        updatedTop = entry.topAddr + displacements.get(entry.topAddr);
      }

      // Check if this team's bottom pointer needs updating
      if (entry.bottomAddr === bottomAddr) {
        updatedBottom = newBottomAddr;
      } else if (displacements.has(entry.bottomAddr)) {
        updatedBottom = entry.bottomAddr + displacements.get(entry.bottomAddr);
      }

      // Write updated pointers if they changed
      if (updatedTop !== entry.topAddr) {
        writeFlagPointer(rom, entryPtrOffset, updatedTop);
      }
      if (updatedBottom !== entry.bottomAddr) {
        writeFlagPointer(rom, entryPtrOffset + 2, updatedBottom);
      }
    }

    return true;
  } catch (e) {
    console.error('Failed to write flag design:', e);
    return false;
  }
}
