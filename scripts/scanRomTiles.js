/**
 * ROM Tile Scanner
 * Scans the ROM looking for Konami LZ compressed blocks that decompress
 * into valid 4bpp tile data. Shows results sorted by decompressed size.
 *
 * Usage: node scripts/scanRomTiles.js <path-to-rom.smc> [startOffset] [endOffset]
 * Output: scripts/scan-results.html
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================
// Konami LZ Decompression
// ============================================================

const WINDOW_SIZE = 0x400;
const DATA_SIZE = 0x10000;

function konamiDecompress(rom, offset, gameType = 1) {
  const outBuf = new Uint8Array(DATA_SIZE);
  const winBuf = new Uint8Array(WINDOW_SIZE);

  if (offset + 2 >= rom.length) return null;

  const m1 = rom[offset];
  const m2 = rom[offset + 1];
  const compSize = (m1 | (m2 << 8)) & 0x7fff;

  // Sanity checks
  if (compSize < 4 || compSize > 0x6000) return null;
  if (offset + compSize > rom.length) return null;

  const inBuf = rom.slice(offset + 2, offset + 2 + compSize - 2);

  let inPos = 0;
  let outPos = 0;
  let bufPos = 0;

  const checkPos = (pos) => {
    if (pos >= WINDOW_SIZE) pos -= WINDOW_SIZE;
    return pos;
  };

  try {
    while (inPos < compSize - 2 && outPos < DATA_SIZE) {
      const ctrl = (inBuf[inPos++] >> 5) & 0x07;

      switch (ctrl) {
        case 0x04: {
          const cnt = inBuf[inPos - 1] & 0x1f;
          for (let i = 0; i < cnt; i++) {
            if (inPos >= inBuf.length) return null;
            outBuf[outPos++] = inBuf[inPos];
            winBuf[bufPos++] = inBuf[inPos];
            inPos++;
            bufPos = checkPos(bufPos);
          }
          break;
        }
        case 0x05: {
          const cnt = (inBuf[inPos - 1] & 0x1f) + 2;
          for (let i = 0; i < cnt; i++) {
            if (inPos >= inBuf.length) return null;
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
        case 0x06: {
          const cnt = (inBuf[inPos - 1] & 0x1f) + 2;
          if (inPos >= inBuf.length) return null;
          const chr = inBuf[inPos++];
          for (let i = 0; i < cnt; i++) {
            outBuf[outPos++] = chr;
            winBuf[bufPos++] = chr;
            if (bufPos > WINDOW_SIZE) bufPos -= WINDOW_SIZE;
          }
          break;
        }
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
              if (inPos >= inBuf.length) return null;
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
        default: {
          const lz1 = inBuf[inPos - 1];
          if (inPos >= inBuf.length) return null;
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
  } catch {
    return null;
  }

  if (outPos < 32) return null;
  return { data: outBuf.slice(0, outPos), compSize };
}

// ============================================================
// Tile Quality Heuristic
// ============================================================

function scoreTileData(data) {
  const totalTiles = Math.floor(data.length / 32);
  if (totalTiles < 4) return 0;

  let nonZeroTiles = 0;
  let totalVariation = 0;

  for (let t = 0; t < Math.min(totalTiles, 50); t++) {
    const tileOffset = t * 32;
    let hasContent = false;
    const byteSet = new Set();

    for (let i = 0; i < 32; i++) {
      const b = data[tileOffset + i];
      if (b !== 0) hasContent = true;
      byteSet.add(b);
    }

    if (hasContent) {
      nonZeroTiles++;
      totalVariation += byteSet.size;
    }
  }

  const tilesChecked = Math.min(totalTiles, 50);
  const contentRatio = nonZeroTiles / tilesChecked;
  const avgVariation = totalVariation / tilesChecked;

  return contentRatio * avgVariation * totalTiles;
}

// ============================================================
// SNES 4bpp Tile Decoder
// ============================================================

function decodeSnes4bppToPixels(tileData, tilesPerRow = 16) {
  const TILE_SIZE = 32;
  const totalTiles = Math.floor(tileData.length / TILE_SIZE);
  const rows = Math.ceil(totalTiles / tilesPerRow);

  const width = tilesPerRow * 8;
  const height = rows * 8;
  const pixels = new Array(height).fill(null).map(() => new Array(width).fill(0));

  for (let tileIdx = 0; tileIdx < totalTiles; tileIdx++) {
    const tileX = (tileIdx % tilesPerRow) * 8;
    const tileY = Math.floor(tileIdx / tilesPerRow) * 8;
    const tileOffset = tileIdx * TILE_SIZE;

    for (let row = 0; row < 8; row++) {
      const byte1 = tileData[tileOffset + row * 2] || 0;
      const byte2 = tileData[tileOffset + row * 2 + 1] || 0;
      const byte3 = tileData[tileOffset + row * 2 + 16] || 0;
      const byte4 = tileData[tileOffset + row * 2 + 17] || 0;

      for (let col = 0; col < 8; col++) {
        const bit = 7 - col;
        const b0 = (byte1 >> bit) & 1;
        const b1 = (byte2 >> bit) & 1;
        const b2 = (byte3 >> bit) & 1;
        const b3 = (byte4 >> bit) & 1;
        const colorIdx = b0 | (b1 << 1) | (b2 << 2) | (b3 << 3);

        if (tileY + row < height && tileX + col < width) {
          pixels[tileY + row][tileX + col] = colorIdx;
        }
      }
    }
  }

  return { pixels, width, height, totalTiles };
}

// ============================================================
// Main Scanner
// ============================================================

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node scripts/scanRomTiles.js <path-to-rom.smc> [startHex] [endHex]');
  console.log('');
  console.log('Scans ROM for Konami LZ compressed tile blocks.');
  console.log('Default: scans 0x80000 to 0xFFFFF (upper half, where graphics typically are)');
  process.exit(1);
}

const romPath = resolve(args[0]);
const startOffset = args[1] ? parseInt(args[1], 16) : 0x80000;
const endOffset = args[2] ? parseInt(args[2], 16) : 0xfffff;

console.log(`Reading ROM: ${romPath}`);
const romData = new Uint8Array(readFileSync(romPath));
console.log(`ROM size: ${romData.length} bytes`);

const hasHeader = romData.length % 1024 === 512;
const headerOffset = hasHeader ? 512 : 0;

console.log(`Scanning from 0x${startOffset.toString(16)} to 0x${endOffset.toString(16)}...`);
console.log('');

const results = [];
let pos = startOffset + headerOffset;
const end = Math.min(endOffset + headerOffset, romData.length - 4);

while (pos < end) {
  const result = konamiDecompress(romData, pos, 1);

  if (result && result.data.length >= 256) {
    const score = scoreTileData(result.data);
    const totalTiles = Math.floor(result.data.length / 32);

    if (score > 50 && totalTiles >= 8) {
      const romOffset = pos - headerOffset;
      results.push({
        offset: romOffset,
        compSize: result.compSize,
        decompSize: result.data.length,
        tiles: totalTiles,
        score,
        data: result.data,
      });
      console.log(
        `  Found: 0x${romOffset.toString(16).toUpperCase()} ` +
          `comp=${result.compSize} decomp=${result.data.length} ` +
          `tiles=${totalTiles} score=${score.toFixed(0)}`,
      );
      // Skip past this block
      pos += result.compSize + 2;
      continue;
    }
  }

  pos += 2;
}

console.log(`\nFound ${results.length} candidate blocks.`);

// Sort by score descending
results.sort((a, b) => b.score - a.score);

// Generate HTML with top results
const top = results.slice(0, 20);
console.log('\nTop 20 by score:');
top.forEach((r, i) => {
  console.log(
    `  ${i + 1}. 0x${r.offset.toString(16).toUpperCase()} - ${r.tiles} tiles, ` +
      `${r.compSize}/${r.decompSize} bytes, score=${r.score.toFixed(0)}`,
  );
});

// Build HTML with thumbnails of each block
let htmlBlocks = '';
for (const r of top) {
  const { pixels, width, height } = decodeSnes4bppToPixels(r.data, 16);
  htmlBlocks += `
    <div class="block">
      <h3>Offset 0x${r.offset.toString(16).toUpperCase()} - ${r.tiles} tiles (score: ${r.score.toFixed(0)})</h3>
      <p>Compressed: ${r.compSize} bytes | Decompressed: ${r.decompSize} bytes</p>
      <canvas id="c_${r.offset}" data-pixels='${JSON.stringify(pixels)}' data-w="${width}" data-h="${height}"></canvas>
    </div>`;
}

const html = `<!DOCTYPE html>
<html>
<head>
  <title>ISS Forge - ROM Tile Scanner</title>
  <style>
    body { background: #1e1e2e; color: #cdd6f4; font-family: monospace; padding: 20px; }
    h1 { color: #89b4fa; }
    h3 { color: #a6e3a1; margin-bottom: 4px; }
    .block { margin-bottom: 24px; border-bottom: 1px solid #45475a; padding-bottom: 16px; }
    canvas { border: 1px solid #585b70; image-rendering: pixelated; display: block; margin-top: 8px; }
    p { color: #bac2de; margin: 4px 0; }
  </style>
</head>
<body>
  <h1>ROM Tile Scanner - Top ${top.length} Results</h1>
  <p>Scanned 0x${startOffset.toString(16).toUpperCase()} - 0x${endOffset.toString(16).toUpperCase()} | Found ${results.length} total blocks</p>
  ${htmlBlocks}
  <script>
    document.querySelectorAll('canvas').forEach(canvas => {
      const pixels = JSON.parse(canvas.dataset.pixels);
      const w = parseInt(canvas.dataset.w);
      const h = parseInt(canvas.dataset.h);
      const scale = 2;
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = pixels[y][x];
          const v = 255 - Math.round((idx / 15) * 255);
          ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    });
  </script>
</body>
</html>`;

const outputPath = resolve('scripts/scan-results.html');
writeFileSync(outputPath, html);
console.log(`\nResults written to: ${outputPath}`);
