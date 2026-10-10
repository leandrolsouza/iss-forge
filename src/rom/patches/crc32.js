/**
 * CRC-32 (IEEE 802.3, polynomial 0xEDB88320) — used by BPS patches and for
 * identifying ROM dumps (same value shown by No-Intro / ROMhacking.net).
 */

let TABLE = null;

function getTable() {
  if (TABLE) return TABLE;
  TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    TABLE[n] = c >>> 0;
  }
  return TABLE;
}

/**
 * @param {Uint8Array} data
 * @param {number} [start=0]
 * @param {number} [end=data.length]
 * @returns {number} unsigned 32-bit CRC
 */
export function crc32(data, start = 0, end = data.length) {
  const table = getTable();
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Format a CRC as 8 uppercase hex digits (e.g. "6CD568A9")
 * @param {number} value
 */
export function formatCrc32(value) {
  return (value >>> 0).toString(16).toUpperCase().padStart(8, '0');
}
