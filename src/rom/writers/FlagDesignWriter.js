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

export function writeFlagDesign(rom, teamIndex, grid) {
  try {
    const ordinal = FLAG_DESIGN_ORDINALS[teamIndex];
    const ptrOffset = FLAG_POINTER_OFFSET + ordinal * FLAG_POINTER_STEP;
    const topAddr = readFlagPointer(rom, ptrOffset);
    const bottomAddr = readFlagPointer(rom, ptrOffset + 2);
    const oldTopSize = readCompressedSize(rom, topAddr);
    const oldBottomSize = readCompressedSize(rom, bottomAddr);

    // Encode pixel grid to SNES 4bpp tiles
    const REVERSE_INDEX = [0, 12, 13, 14, 15];
    const topGrid = grid.slice(0, 8).map((row) => row.map((pixel) => REVERSE_INDEX[pixel] || 0));
    const bottomGrid = grid
      .slice(8, 16)
      .map((row) => row.map((pixel) => REVERSE_INDEX[pixel] || 0));

    const topTiles = encodeSnes4bppTiles(topGrid);
    const bottomTiles = encodeSnes4bppTiles(bottomGrid);

    // Compress with full LZ algorithm
    const topCompressed = konamiCompress(topTiles, 1);
    const bottomCompressed = konamiCompress(bottomTiles, 1);

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
