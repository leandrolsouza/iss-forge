/**
 * SNES internal checksum — calculation and repair
 *
 * The SNES internal header stores two 16-bit little-endian values:
 *   header + 0x1C: checksum complement (checksum ^ 0xFFFF)
 *   header + 0x1E: checksum (16-bit sum of every ROM byte)
 *
 * Conventions used by real hardware/emulators/tools (snes9x, bsnes, ucon64):
 *   - The 512-byte copier header (if present) is NOT part of the sum.
 *   - The checksum fields themselves are summed as if they contained
 *     complement=0xFFFF / checksum=0x0000. Any valid pair always adds up to
 *     0x1FE (0xFF + 0xFF), so the result is stable regardless of the
 *     values currently stored.
 *   - ROMs whose size is not a power of two are mirrored up to the next
 *     power of two before summing (e.g. 12 Mbit = 8 Mbit + 4 Mbit mirrored twice).
 *
 * ISS is an 8 Mbit LoROM (FastROM, map mode 0x30) so the header lives at 0x7FC0
 * and the size is already a power of two, but the generic path is kept so the
 * module also works for expanded ROMs.
 */

export const LOROM_HEADER_ADDR = 0x7fc0;
export const HIROM_HEADER_ADDR = 0xffc0;

const COMPLEMENT_OFFSET = 0x1c;
const CHECKSUM_OFFSET = 0x1e;

/** Sum of the 4 checksum bytes when they hold any valid checksum/complement pair */
const VALID_PAIR_BYTE_SUM = 0x1fe;

function isPowerOfTwo(n) {
  return n > 0 && (n & (n - 1)) === 0;
}

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Map an address in the (power-of-two) virtual space onto the physical ROM,
 * replicating the mirroring performed by SNES cartridges (bsnes algorithm).
 */
function mirrorAddress(addr, size) {
  let base = 0;
  let mask = 1 << 30;
  while (addr >= size) {
    while (!(addr & mask)) mask >>>= 1;
    addr -= mask;
    if (size > mask) {
      size -= mask;
      base += mask;
    }
    mask >>>= 1;
  }
  return base + addr;
}

/**
 * Calculate the SNES checksum for headerless ROM bytes.
 * @param {Uint8Array} rom - ROM data WITHOUT copier header
 * @param {number} [headerAddr=LOROM_HEADER_ADDR] - internal header address
 * @returns {number} 16-bit checksum
 */
export function calculateSnesChecksum(rom, headerAddr = LOROM_HEADER_ADDR) {
  const size = rom.length;
  if (size === 0) return 0;

  let sum = 0;
  if (isPowerOfTwo(size)) {
    for (let i = 0; i < size; i++) sum += rom[i];
  } else {
    const virtualSize = nextPowerOfTwo(size);
    for (let addr = 0; addr < virtualSize; addr++) {
      sum += rom[mirrorAddress(addr, size)];
    }
  }

  // Replace whatever is stored in the checksum fields by a canonical valid pair.
  // The header lives in the first (never mirrored) power-of-two block, so it is
  // counted exactly once.
  const fieldsStart = headerAddr + COMPLEMENT_OFFSET;
  if (fieldsStart + 4 <= size) {
    let stored = 0;
    for (let i = 0; i < 4; i++) stored += rom[fieldsStart + i];
    sum = sum - stored + VALID_PAIR_BYTE_SUM;
  }

  return sum & 0xffff;
}

/**
 * Read the checksum/complement currently stored in the internal header.
 * @param {Uint8Array} data - full ROM file (may include copier header)
 * @param {number} [copierHeaderSize=0]
 * @param {number} [headerAddr=LOROM_HEADER_ADDR]
 */
export function readStoredChecksum(data, copierHeaderSize = 0, headerAddr = LOROM_HEADER_ADDR) {
  const base = copierHeaderSize + headerAddr;
  const complement = data[base + COMPLEMENT_OFFSET] | (data[base + COMPLEMENT_OFFSET + 1] << 8);
  const checksum = data[base + CHECKSUM_OFFSET] | (data[base + CHECKSUM_OFFSET + 1] << 8);
  return { checksum, complement };
}

/**
 * Inspect the checksum state of a ROM without modifying it.
 * @param {Uint8Array} data - full ROM file (may include copier header)
 * @param {number} [copierHeaderSize=0]
 * @param {number} [headerAddr=LOROM_HEADER_ADDR]
 * @returns {{ stored: number, storedComplement: number, calculated: number, valid: boolean }}
 */
export function inspectChecksum(data, copierHeaderSize = 0, headerAddr = LOROM_HEADER_ADDR) {
  const rom = data.subarray(copierHeaderSize);
  const calculated = calculateSnesChecksum(rom, headerAddr);
  const { checksum, complement } = readStoredChecksum(data, copierHeaderSize, headerAddr);
  return {
    stored: checksum,
    storedComplement: complement,
    calculated,
    valid: checksum === calculated && ((checksum ^ 0xffff) & 0xffff) === complement,
  };
}

/**
 * Recalculate and write the internal checksum + complement in place.
 * @param {Uint8Array} data - full ROM file (may include copier header) — mutated
 * @param {number} [copierHeaderSize=0]
 * @param {number} [headerAddr=LOROM_HEADER_ADDR]
 * @returns {{ checksum: number, complement: number, changed: boolean, previous: number }}
 */
export function fixChecksum(data, copierHeaderSize = 0, headerAddr = LOROM_HEADER_ADDR) {
  const base = copierHeaderSize + headerAddr;
  if (base + CHECKSUM_OFFSET + 2 > data.length) {
    throw new Error('ROM too small to contain an internal header');
  }

  const before = inspectChecksum(data, copierHeaderSize, headerAddr);
  const checksum = before.calculated;
  const complement = checksum ^ 0xffff;

  data[base + COMPLEMENT_OFFSET] = complement & 0xff;
  data[base + COMPLEMENT_OFFSET + 1] = (complement >> 8) & 0xff;
  data[base + CHECKSUM_OFFSET] = checksum & 0xff;
  data[base + CHECKSUM_OFFSET + 1] = (checksum >> 8) & 0xff;

  return { checksum, complement, changed: !before.valid, previous: before.stored };
}
