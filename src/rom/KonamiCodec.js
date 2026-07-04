/**
 * Konami SNES Compression/Decompression
 * Ported from ProtonNoir's C implementation (konami_d / konami_c)
 * Used by web-iss-studio (Esteban Fuentealba)
 */

const WINDOW_SIZE = 0x400;
const DATA_SIZE = 0x10000;
const MAX_RAW_SIZE = 31;
const MAX_LENGTH = 33;
const MAX_ZERO_LENGTH = 257;

/**
 * Decompress Konami-compressed data from a ROM buffer
 * @param {Uint8Array} rom - Full ROM data
 * @param {number} offset - Offset in ROM where compressed data starts
 * @param {number} gameType - 0 or 1 (ISS uses 1)
 * @returns {Uint8Array} Decompressed data
 */
export function konamiDecompress(rom, offset, gameType = 1) {
  const outBuf = new Uint8Array(DATA_SIZE);
  const winBuf = new Uint8Array(WINDOW_SIZE);

  // Read compressed size from first 2 bytes
  const m1 = rom[offset];
  const m2 = rom[offset + 1];
  const compSize = (m1 | (m2 << 8)) & 0x7fff;

  // Read compressed data
  const inBuf = rom.slice(offset + 2, offset + 2 + compSize - 2);

  let inPos = 0;
  let outPos = 0;
  let bufPos = 0;

  const checkPos = (pos) => {
    if (pos >= WINDOW_SIZE) pos -= WINDOW_SIZE;
    return pos;
  };

  while (inPos < compSize - 2 && outPos < DATA_SIZE) {
    const ctrl = (inBuf[inPos++] >> 5) & 0x07;

    switch (ctrl) {
      // RAW (0x80-0x9F)
      case 0x04: {
        const cnt = inBuf[inPos - 1] & 0x1f;
        for (let i = 0; i < cnt; i++) {
          outBuf[outPos++] = inBuf[inPos];
          winBuf[bufPos++] = inBuf[inPos];
          inPos++;
          bufPos = checkPos(bufPos);
        }
        break;
      }

      // RLE_A0 (0xA0-0xBF) - alternating zero + byte
      case 0x05: {
        const cnt = (inBuf[inPos - 1] & 0x1f) + 2;
        for (let i = 0; i < cnt; i++) {
          const chr = inBuf[inPos++];
          winBuf[bufPos++] = 0x00;
          bufPos = checkPos(bufPos);
          outBuf[outPos++] = 0x00;
          winBuf[bufPos++] = chr;
          bufPos = checkPos(bufPos);
          outBuf[outPos++] = chr;
        }
        break;
      }

      // RLE_C0 (0xC0-0xDF) - single byte repeated
      case 0x06: {
        const cnt = (inBuf[inPos - 1] & 0x1f) + 2;
        const chr = inBuf[inPos++];
        for (let i = 0; i < cnt; i++) {
          outBuf[outPos++] = chr;
          winBuf[bufPos++] = chr;
          if (bufPos > WINDOW_SIZE) bufPos -= WINDOW_SIZE;
        }
        break;
      }

      // RLE_E0 (0xE0-0xFF) - zero repeated
      case 0x07: {
        if (gameType === 0) {
          const cnt = (inBuf[inPos - 1] & 0x1f) + 2;
          for (let i = 0; i < cnt; i++) {
            winBuf[bufPos++] = 0x00;
            if (bufPos > WINDOW_SIZE) bufPos -= WINDOW_SIZE;
            outBuf[outPos++] = 0x00;
          }
        } else {
          if (inBuf[inPos - 1] !== 0xff) {
            const cnt = (inBuf[inPos - 1] & 0x1f) + 2;
            for (let i = 0; i < cnt; i++) {
              winBuf[bufPos++] = 0x00;
              if (bufPos > WINDOW_SIZE) bufPos -= WINDOW_SIZE;
              outBuf[outPos++] = 0x00;
            }
          } else {
            const chr = inBuf[inPos++];
            const cnt = (chr & 0xff) + 2;
            for (let i = 0; i < cnt; i++) {
              winBuf[bufPos++] = 0x00;
              if (bufPos > WINDOW_SIZE) bufPos -= WINDOW_SIZE;
              outBuf[outPos++] = 0x00;
            }
          }
        }
        break;
      }

      // LZ (0x00-0x7F) - window copy
      default: {
        const lz1 = inBuf[inPos - 1];
        const lz2 = inBuf[inPos++];
        const lzLen = (lz1 >> 2) + 2;
        let lzOff = ((lz1 << 8) | lz2) & 0x3ff;
        lzOff = (lzOff - 0x3df) & 0x3ff;

        for (let i = 0; i < lzLen; i++) {
          lzOff = checkPos(lzOff);
          winBuf[bufPos++] = winBuf[lzOff];
          bufPos = checkPos(bufPos);
          outBuf[outPos++] = winBuf[lzOff];
          lzOff++;
          lzOff = checkPos(lzOff);
        }
        break;
      }
    }
  }

  return outBuf.slice(0, outPos);
}

/**
 * Decode SNES 4bpp tile data into a pixel grid
 * Each tile is 8x8 pixels, 32 bytes per tile
 * For flags: 3 tiles wide per half (24px wide), 8px tall per half
 * @param {Uint8Array} tileData - Decompressed tile data (96 bytes = 3 tiles)
 * @returns {number[][]} 8×24 grid of palette indices (0-15)
 */
export function decodeSnes4bppTiles(tileData) {
  const TILE_SIZE = 32; // bytes per 4bpp 8x8 tile
  const tilesPerRow = 3;
  const grid = Array.from({ length: 8 }, () => new Array(tilesPerRow * 8).fill(0));

  for (let tileIdx = 0; tileIdx < tilesPerRow; tileIdx++) {
    const tileOffset = tileIdx * TILE_SIZE;

    for (let row = 0; row < 8; row++) {
      const byte1 = tileData[tileOffset + row * 2] || 0; // bitplane 0
      const byte2 = tileData[tileOffset + row * 2 + 1] || 0; // bitplane 1
      const byte3 = tileData[tileOffset + row * 2 + 16] || 0; // bitplane 2
      const byte4 = tileData[tileOffset + row * 2 + 17] || 0; // bitplane 3

      for (let col = 0; col < 8; col++) {
        const bit = 7 - col; // MSB first
        const b0 = (byte1 >> bit) & 1;
        const b1 = (byte2 >> bit) & 1;
        const b2 = (byte3 >> bit) & 1;
        const b3 = (byte4 >> bit) & 1;
        const colorIdx = b0 | (b1 << 1) | (b2 << 2) | (b3 << 3);

        grid[row][tileIdx * 8 + col] = colorIdx;
      }
    }
  }

  return grid;
}

/**
 * Encode a pixel grid back into SNES 4bpp tile data
 * @param {number[][]} grid - 8×24 grid of palette indices
 * @returns {Uint8Array} 96 bytes (3 tiles × 32 bytes)
 */
export function encodeSnes4bppTiles(grid) {
  const TILE_SIZE = 32;
  const tilesPerRow = 3;
  const output = new Uint8Array(tilesPerRow * TILE_SIZE);

  for (let tileIdx = 0; tileIdx < tilesPerRow; tileIdx++) {
    const tileOffset = tileIdx * TILE_SIZE;

    for (let row = 0; row < 8; row++) {
      let byte1 = 0,
        byte2 = 0,
        byte3 = 0,
        byte4 = 0;

      for (let col = 0; col < 8; col++) {
        const bit = 7 - col;
        const colorIdx = grid[row][tileIdx * 8 + col] & 0x0f;
        byte1 |= ((colorIdx >> 0) & 1) << bit;
        byte2 |= ((colorIdx >> 1) & 1) << bit;
        byte3 |= ((colorIdx >> 2) & 1) << bit;
        byte4 |= ((colorIdx >> 3) & 1) << bit;
      }

      output[tileOffset + row * 2] = byte1;
      output[tileOffset + row * 2 + 1] = byte2;
      output[tileOffset + row * 2 + 16] = byte3;
      output[tileOffset + row * 2 + 17] = byte4;
    }
  }

  return output;
}

/**
 * Search for LZ (sliding window) match at current position
 * Ported from ProtonNoir's konami_c.cpp search_lz()
 * @param {Uint8Array} data - Input data
 * @param {number} pos - Current position
 * @param {number} inputSize - Total input size
 * @returns {{length: number, offset: number}} Best LZ match
 */
function searchLz(data, pos, inputSize) {
  let bestLen = 0;
  let bestOff = 0;

  // Window start: up to 0x3DF bytes back from current position
  let winStart = pos - 0x3df;
  if (winStart < 0) winStart = 0;

  for (let i = winStart; i < pos && i + MAX_LENGTH < inputSize; i++) {
    if (data[i] === data[pos]) {
      let match = 1;
      while (match < MAX_LENGTH && pos + match < inputSize && data[i + match] === data[pos + match])
        match++;

      if (match > bestLen) {
        bestLen = match;
        bestOff = i;
      }
      if (bestLen >= MAX_LENGTH) break;
    }
  }

  if (bestLen >= 2 && pos + bestLen <= inputSize) {
    return { length: bestLen, offset: bestOff };
  }
  return { length: 0, offset: 0 };
}

/**
 * Search for RLE pattern at current position
 * Ported from ProtonNoir's konami_c.cpp search_rle()
 * @param {Uint8Array} data - Input data
 * @param {number} pos - Current position
 * @param {number} inputSize - Total input size
 * @param {number} gameType - 0 or 1
 * @returns {{size: number, type: number, data: number, ar: Uint8Array|null}}
 */
function searchRle(data, pos, inputSize, gameType) {
  let candidate = { size: 0, type: 0, data: 0, ar: null };

  // RLE_A0 (0xA0-0xBF) - alternating zero + byte
  if (
    pos + 3 < inputSize &&
    data[pos] === 0x00 &&
    data[pos + 1] !== 0x00 &&
    data[pos + 2] === 0x00 &&
    data[pos + 3] !== 0x00
  ) {
    let size = 0;
    while (size <= MAX_LENGTH * 2 && pos + size < inputSize - 1) {
      if (data[pos + size] !== 0x00) break;
      size += 2;
    }
    const ar = new Uint8Array(MAX_LENGTH);
    let s = 0;
    let rep = 1;
    while (rep <= size && pos + rep < inputSize - 1) {
      if (data[pos + rep] === 0x00) break;
      ar[s++] = data[pos + rep];
      rep += 2;
    }
    rep = rep - 1;
    if (rep > MAX_LENGTH * 2) rep = MAX_LENGTH * 2;
    if (rep >= 4 && rep > candidate.size) {
      candidate = { size: rep, type: 0xa0, data: 0, ar: ar.slice(0, rep / 2) };
    }
  }

  // RLE_C0 (0xC0-0xDF) - single byte repeated (non-zero)
  if (data[pos] !== 0x00) {
    let size = 0;
    while (size <= MAX_LENGTH && pos + size < inputSize && data[pos + size] === data[pos]) size++;
    if (size > MAX_LENGTH) size = MAX_LENGTH;
    if (size >= 2 && size > candidate.size) {
      candidate = { size, type: 0xc0, data: data[pos], ar: null };
    }
  }

  // RLE_E0 (0xE0-0xFF) - zero repeated
  if (data[pos] === 0x00) {
    const maxLen = gameType === 1 ? MAX_ZERO_LENGTH : MAX_LENGTH;
    let size = 0;
    while (size <= maxLen && pos + size < inputSize && data[pos + size] === 0x00) size++;
    if (size > maxLen) size = maxLen;
    if (size >= 2 && size > candidate.size) {
      candidate = { size, type: 0xe0, data: 0, ar: null };
    }
  }

  return candidate;
}

/**
 * Write LZ token to output buffer
 * @returns {number} Bytes written
 */
function writeLz(outBuf, outPos, lz) {
  const size = lz.length - 2;
  const lzOffset = (lz.offset + 0x3df) & 0x3ff;
  const lzPointer = lzOffset + ((((size << 2) & 0xfc) << 8) | 0);
  outBuf[outPos] = (lzPointer >> 8) & 0xff;
  outBuf[outPos + 1] = lzPointer & 0xff;
  return 2;
}

/**
 * Write RLE token to output buffer
 * @returns {number} Bytes written
 */
function writeRle(outBuf, outPos, rle) {
  if (rle.type === 0xe0) {
    if (rle.size <= MAX_LENGTH) {
      outBuf[outPos] = 0xe0 | ((rle.size - 2) & 0x1f);
      return 1;
    } else {
      outBuf[outPos] = 0xff;
      outBuf[outPos + 1] = (rle.size - 2) & 0xff;
      return 2;
    }
  } else if (rle.type === 0xa0) {
    const size = Math.floor(rle.size / 2) - 2;
    outBuf[outPos] = 0xa0 | (size & 0x1f);
    for (let i = 0; i < Math.floor(rle.size / 2); i++) {
      outBuf[outPos + 1 + i] = rle.ar[i];
    }
    return 1 + Math.floor(rle.size / 2);
  } else {
    // RLE_C0
    outBuf[outPos] = 0xc0 | ((rle.size - 2) & 0x1f);
    outBuf[outPos + 1] = rle.data;
    return 2;
  }
}

/**
 * Write RAW bytes to output buffer
 * @returns {number} Bytes written
 */
function writeRaw(outBuf, outPos, raw, rawSize) {
  if (!rawSize) return 0;
  outBuf[outPos] = 0x80 | (rawSize & 0x1f);
  for (let i = 0; i < rawSize; i++) {
    outBuf[outPos + 1 + i] = raw[i];
  }
  return rawSize + 1;
}

/**
 * Compress data using Konami's algorithm
 * Full implementation with LZ search, matching ProtonNoir's konami_c.cpp
 * @param {Uint8Array} data - Data to compress
 * @param {number} gameType - 0 or 1
 * @returns {Uint8Array} Compressed data (includes 2-byte size header)
 */
export function konamiCompress(data, gameType = 1) {
  const outBuf = new Uint8Array(DATA_SIZE);
  let outPos = 2; // Reserve 2 bytes for size header
  let inPos = 0;
  const inSize = data.length;

  const raw = new Uint8Array(MAX_RAW_SIZE);
  let rawSize = 0;

  while (inPos < inSize) {
    let lz = { length: 0, offset: 0 };
    const rle = searchRle(data, inPos, inSize, gameType);

    if (rle.size <= MAX_LENGTH && inPos < inSize - 1) {
      lz = searchLz(data, inPos, inSize);
    }

    if (lz.length >= 2 && lz.length > rle.size) {
      // LZ match is best
      if (lz.length === 2 && rawSize > 0) {
        // Short LZ match — absorb into RAW buffer instead
        raw[rawSize++] = data[inPos++];
        if (rawSize === MAX_RAW_SIZE) {
          outPos += writeRaw(outBuf, outPos, raw, rawSize);
          rawSize = 0;
        }
      } else {
        outPos += writeRaw(outBuf, outPos, raw, rawSize);
        rawSize = 0;
        outPos += writeLz(outBuf, outPos, lz);
        inPos += lz.length;
      }
    } else if (rle.size >= 2 && rle.size >= lz.length) {
      // RLE match is best
      if (rle.type === 0xe0) {
        // Zero RLE always flushes raw first
        outPos += writeRaw(outBuf, outPos, raw, rawSize);
        rawSize = 0;
        outPos += writeRle(outBuf, outPos, rle);
        inPos += rle.size;
      } else if (rle.size === 2 && rawSize !== 0) {
        // Short RLE with pending raw — absorb
        raw[rawSize++] = data[inPos++];
        if (rawSize === MAX_RAW_SIZE) {
          outPos += writeRaw(outBuf, outPos, raw, rawSize);
          rawSize = 0;
        }
      } else {
        outPos += writeRaw(outBuf, outPos, raw, rawSize);
        rawSize = 0;
        outPos += writeRle(outBuf, outPos, rle);
        inPos += rle.size;
      }
    } else {
      // No good match — accumulate raw
      raw[rawSize++] = data[inPos++];
      if (rawSize === MAX_RAW_SIZE) {
        outPos += writeRaw(outBuf, outPos, raw, rawSize);
        rawSize = 0;
      }
    }
  }

  // Flush remaining raw bytes
  outPos += writeRaw(outBuf, outPos, raw, rawSize);

  // Write size header (total compressed size including header)
  outBuf[0] = outPos & 0xff;
  outBuf[1] = (outPos >> 8) & 0xff;

  return outBuf.slice(0, outPos);
}
