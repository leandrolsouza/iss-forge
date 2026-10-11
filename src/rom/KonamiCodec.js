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
          if (bufPos >= WINDOW_SIZE) bufPos -= WINDOW_SIZE;
        }
        break;
      }

      // RLE_E0 (0xE0-0xFF) - zero repeated
      case 0x07: {
        if (gameType === 0) {
          const cnt = (inBuf[inPos - 1] & 0x1f) + 2;
          for (let i = 0; i < cnt; i++) {
            winBuf[bufPos++] = 0x00;
            if (bufPos >= WINDOW_SIZE) bufPos -= WINDOW_SIZE;
            outBuf[outPos++] = 0x00;
          }
        } else {
          if (inBuf[inPos - 1] !== 0xff) {
            const cnt = (inBuf[inPos - 1] & 0x1f) + 2;
            for (let i = 0; i < cnt; i++) {
              winBuf[bufPos++] = 0x00;
              if (bufPos >= WINDOW_SIZE) bufPos -= WINDOW_SIZE;
              outBuf[outPos++] = 0x00;
            }
          } else {
            const chr = inBuf[inPos++];
            const cnt = (chr & 0xff) + 2;
            for (let i = 0; i < cnt; i++) {
              winBuf[bufPos++] = 0x00;
              if (bufPos >= WINDOW_SIZE) bufPos -= WINDOW_SIZE;
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
 * Compress data using Konami's algorithm (format of ProtonNoir's konami_c).
 *
 * Optimal parse: dynamic programming over every token the decoder accepts
 * (RAW chunks, LZ copies incl. overlapping ones, RLE_A0/C0/E0), so the output
 * is never larger than a greedy encoder. On the original menu tilemaps it
 * matches (or beats) the size of Konami's own data, which matters because
 * edited blocks must fit back into their original slot.
 * @param {Uint8Array} data - Data to compress
 * @param {number} gameType - 0 or 1 (ISS uses 1)
 * @returns {Uint8Array} Compressed data (includes 2-byte size header)
 */
export function konamiCompress(data, gameType = 1) {
  const n = data.length;
  const INF = 1e9;
  const cost = new Float64Array(n + 1).fill(INF);
  const choice = new Array(n + 1);
  cost[n] = 0;

  // Longest LZ match at each position (window as in the original encoder)
  const lzLen = new Uint8Array(n);
  const lzOff = new Uint32Array(n);
  for (let pos = 1; pos < n; pos++) {
    const winStart = Math.max(0, pos - 0x3df);
    let best = 0;
    let bestOff = 0;
    for (let i = pos - 1; i >= winStart; i--) {
      if (data[i] !== data[pos]) continue;
      let m = 1;
      while (m < MAX_LENGTH && pos + m < n && data[i + m] === data[pos + m]) m++;
      if (m > best) {
        best = m;
        bestOff = i;
        if (best >= MAX_LENGTH) break;
      }
    }
    if (best >= 2) {
      lzLen[pos] = best;
      lzOff[pos] = bestOff;
    }
  }

  const zeroMax = gameType === 1 ? MAX_ZERO_LENGTH : MAX_LENGTH;
  for (let i = n - 1; i >= 0; i--) {
    const take = (len, c, token) => {
      const total = c + cost[i + len];
      if (total < cost[i]) {
        cost[i] = total;
        choice[i] = token;
      }
    };
    // RAW chunk of 1..31 bytes
    for (let k = 1; k <= MAX_RAW_SIZE && i + k <= n; k++) take(k, k + 1, { t: 'raw', len: k });
    // LZ copy
    for (let len = 2; len <= lzLen[i]; len++) take(len, 2, { t: 'lz', len, off: lzOff[i] });
    if (data[i] !== 0) {
      // RLE_C0: same non-zero byte
      let run = 1;
      while (run < MAX_LENGTH && i + run < n && data[i + run] === data[i]) run++;
      for (let len = 2; len <= run; len++) take(len, 2, { t: 'c0', len });
    } else {
      // RLE_E0: zeros (short form up to 32: 0xFF is the extended marker in type 1)
      let run = 1;
      while (run < zeroMax && i + run < n && data[i + run] === 0) run++;
      const shortMax = gameType === 1 ? MAX_LENGTH - 1 : MAX_LENGTH;
      for (let len = 2; len <= run; len++) take(len, len <= shortMax ? 1 : 2, { t: 'e0', len });
      // RLE_A0: (00 xx) pairs
      let pairs = 0;
      while (pairs < MAX_LENGTH && i + pairs * 2 + 1 < n && data[i + pairs * 2] === 0) pairs++;
      for (let p = 2; p <= pairs; p++) take(p * 2, 1 + p, { t: 'a0', len: p * 2 });
    }
  }

  const outBuf = new Uint8Array(Math.max(16, cost[0] + 4));
  let outPos = 2;
  for (let i = 0; i < n;) {
    const c = choice[i];
    if (c.t === 'raw') {
      outPos += writeRaw(outBuf, outPos, data.subarray(i, i + c.len), c.len);
    } else if (c.t === 'lz') {
      outPos += writeLz(outBuf, outPos, { length: c.len, offset: c.off });
    } else if (c.t === 'c0') {
      outBuf[outPos++] = 0xc0 | ((c.len - 2) & 0x1f);
      outBuf[outPos++] = data[i];
    } else if (c.t === 'e0') {
      const shortMax = gameType === 1 ? MAX_LENGTH - 1 : MAX_LENGTH;
      if (c.len <= shortMax) outBuf[outPos++] = 0xe0 | ((c.len - 2) & 0x1f);
      else {
        outBuf[outPos++] = 0xff;
        outBuf[outPos++] = (c.len - 2) & 0xff;
      }
    } else {
      const p = c.len / 2;
      outBuf[outPos++] = 0xa0 | ((p - 2) & 0x1f);
      for (let k = 0; k < p; k++) outBuf[outPos++] = data[i + k * 2 + 1];
    }
    i += c.len;
  }

  // Size header (total compressed size including header)
  outBuf[0] = outPos & 0xff;
  outBuf[1] = (outPos >> 8) & 0xff;
  return outBuf.slice(0, outPos);
}
