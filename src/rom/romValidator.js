/**
 * ROM Validator — SNES header, checksum, and size verification
 *
 * SNES ROM internal header is at offset 0x7FC0 (LoROM) or 0xFFC0 (HiROM).
 * ISS uses LoROM mapping. Header contains:
 *   0x7FC0-0x7FD4: Internal ROM name (21 bytes, ASCII padded with spaces)
 *   0x7FD5: Map mode
 *   0x7FD6: ROM type (chipset)
 *   0x7FD7: ROM size (log2 in KB)
 *   0x7FD8: SRAM size
 *   0x7FD9: Country code
 *   0x7FDA: Developer ID
 *   0x7FDB: ROM version
 *   0x7FDC-0x7FDD: Checksum complement (inverse of checksum)
 *   0x7FDE-0x7FDF: Checksum (16-bit sum of all bytes)
 */

// Expected sizes for SNES ROMs (in bytes)
const VALID_ROM_SIZES = [
  512 * 1024, // 512 KB (4 Mbit)
  1024 * 1024, // 1 MB (8 Mbit) — ISS is this size
  1536 * 1024, // 1.5 MB (12 Mbit)
  2048 * 1024, // 2 MB (16 Mbit)
  3072 * 1024, // 3 MB (24 Mbit)
  4096 * 1024, // 4 MB (32 Mbit)
];

// Known ISS game titles found in the SNES internal header (21 chars, space-padded)
const KNOWN_ISS_TITLES = [
  'INTERNATIONAL SS', // International Superstar Soccer (Europe)
  'JIKKYO WORLD SOCCER', // Jikkyou World Soccer 2 (Japan)
  'PERFECT ELEVEN', // Perfect Eleven (alternative title)
];

// SNES header offset for LoROM
const LOROM_HEADER_OFFSET = 0x7fc0;

/**
 * Detect if ROM has a 512-byte copier header
 * @param {Uint8Array} data
 * @returns {boolean}
 */
function detectCopierHeader(data) {
  return data.length % 1024 === 512;
}

/**
 * Read the 21-byte internal ROM title from the SNES header
 * @param {Uint8Array} data
 * @param {number} headerOffset - copier header size (0 or 512)
 * @returns {string}
 */
function readInternalTitle(data, headerOffset) {
  const start = headerOffset + LOROM_HEADER_OFFSET;
  if (start + 21 > data.length) return '';

  let title = '';
  for (let i = 0; i < 21; i++) {
    const byte = data[start + i];
    // Valid ASCII range for SNES titles
    if (byte >= 0x20 && byte <= 0x7e) {
      title += String.fromCharCode(byte);
    }
  }
  return title.trim();
}

/**
 * Read SNES map mode byte
 * @param {Uint8Array} data
 * @param {number} headerOffset
 * @returns {number}
 */
function readMapMode(data, headerOffset) {
  const addr = headerOffset + LOROM_HEADER_OFFSET + 0x15;
  return addr < data.length ? data[addr] : 0;
}

/**
 * Read internal ROM size indicator (log2 KB)
 * @param {Uint8Array} data
 * @param {number} headerOffset
 * @returns {number}
 */
function readRomSizeIndicator(data, headerOffset) {
  const addr = headerOffset + LOROM_HEADER_OFFSET + 0x17;
  return addr < data.length ? data[addr] : 0;
}

/**
 * Read the stored checksum and complement from the SNES header
 * @param {Uint8Array} data
 * @param {number} headerOffset
 * @returns {{ checksum: number, complement: number }}
 */
function readStoredChecksum(data, headerOffset) {
  const base = headerOffset + LOROM_HEADER_OFFSET;
  const complementAddr = base + 0x1c;
  const checksumAddr = base + 0x1e;

  if (checksumAddr + 1 >= data.length) {
    return { checksum: 0, complement: 0 };
  }

  const complement = data[complementAddr] | (data[complementAddr + 1] << 8);
  const checksum = data[checksumAddr] | (data[checksumAddr + 1] << 8);
  return { checksum, complement };
}

/**
 * Calculate the actual 16-bit checksum of the ROM data (excluding copier header)
 * @param {Uint8Array} data
 * @param {number} headerOffset - copier header size (0 or 512)
 * @returns {number}
 */
function calculateChecksum(data, headerOffset) {
  let sum = 0;
  for (let i = headerOffset; i < data.length; i++) {
    sum = (sum + data[i]) & 0xffff;
  }
  return sum;
}

/**
 * Check if the internal title matches a known ISS game
 * @param {string} title
 * @returns {boolean}
 */
function isKnownISSTitle(title) {
  const upper = title.toUpperCase();
  return KNOWN_ISS_TITLES.some(
    (known) => upper.includes(known) || known.includes(upper.substring(0, 10)),
  );
}

/**
 * Validate a ROM file comprehensively
 * @param {Uint8Array} data - Raw ROM file bytes
 * @returns {{ isValid: boolean, warnings: string[], errors: string[], info: object }}
 */
export function validateRomFile(data) {
  const result = {
    isValid: true,
    warnings: [],
    errors: [],
    info: {
      size: data.length,
      hasHeader: false,
      headerOffset: 0,
      internalTitle: '',
      mapMode: 0,
      romSizeIndicator: 0,
      storedChecksum: 0,
      calculatedChecksum: 0,
      checksumValid: false,
    },
  };

  // --- Size check ---
  if (data.length < 512 * 1024) {
    result.errors.push('tooSmall');
    result.isValid = false;
    return result;
  }

  // --- Copier header detection ---
  const hasHeader = detectCopierHeader(data);
  const headerOffset = hasHeader ? 512 : 0;
  result.info.hasHeader = hasHeader;
  result.info.headerOffset = headerOffset;

  // --- Verify ROM size is standard ---
  const romSize = data.length - headerOffset;
  const isStandardSize = VALID_ROM_SIZES.includes(romSize);
  if (!isStandardSize) {
    result.warnings.push('nonStandardSize');
  }

  // ISS should be 1MB (8 Mbit)
  if (romSize !== 1024 * 1024) {
    result.warnings.push('unexpectedSize');
  }

  // --- Internal header checks ---
  const title = readInternalTitle(data, headerOffset);
  result.info.internalTitle = title;

  if (!title || title.length < 3) {
    result.errors.push('noTitle');
    result.isValid = false;
    return result;
  }

  // --- ISS title check ---
  if (!isKnownISSTitle(title)) {
    result.warnings.push('unknownTitle');
  }

  // --- Map mode check (LoROM expected for ISS: 0x20 or 0x30) ---
  const mapMode = readMapMode(data, headerOffset);
  result.info.mapMode = mapMode;
  if ((mapMode & 0x0f) !== 0x00 && (mapMode & 0x2f) !== 0x20) {
    result.warnings.push('unexpectedMapMode');
  }

  // --- ROM size indicator ---
  const sizeIndicator = readRomSizeIndicator(data, headerOffset);
  result.info.romSizeIndicator = sizeIndicator;

  // --- Checksum verification ---
  const { checksum: storedChecksum, complement } = readStoredChecksum(data, headerOffset);
  result.info.storedChecksum = storedChecksum;

  // Checksum + complement should equal 0xFFFF
  const checksumComplementValid = ((storedChecksum + complement) & 0xffff) === 0xffff;

  // Calculate actual checksum
  const calculatedChecksum = calculateChecksum(data, headerOffset);
  result.info.calculatedChecksum = calculatedChecksum;
  result.info.checksumValid = calculatedChecksum === storedChecksum;

  if (!checksumComplementValid) {
    result.warnings.push('checksumComplementMismatch');
  }

  if (calculatedChecksum !== storedChecksum) {
    // Modified ROMs often have invalid checksums — warning, not error
    result.warnings.push('checksumMismatch');
  }

  return result;
}

/**
 * Quick validation for the RomParser — returns the same shape as the old validate()
 * but with enhanced checks
 * @param {Uint8Array} data - ROM data
 * @returns {{ isValid: boolean, size: number, hasHeader: boolean, headerOffset: number, message: string, warnings: string[], internalTitle: string, checksumValid: boolean }}
 */
export function quickValidate(data) {
  const validation = validateRomFile(data);
  const { info, errors, warnings, isValid } = validation;

  let message;
  if (!isValid) {
    const errorKey = errors[0] || 'unknown';
    message = `validation.${errorKey}`;
  } else if (warnings.length > 0) {
    message = `ROM OK (${(info.size / 1024).toFixed(0)} KB, ${info.hasHeader ? 'header' : 'no header'}) — ${warnings.length} warning(s)`;
  } else {
    message = `ROM OK (${(info.size / 1024).toFixed(0)} KB, ${info.hasHeader ? 'header' : 'no header'})`;
  }

  return {
    isValid,
    size: info.size,
    hasHeader: info.hasHeader,
    headerOffset: info.headerOffset,
    message,
    warnings,
    internalTitle: info.internalTitle,
    checksumValid: info.checksumValid,
  };
}
