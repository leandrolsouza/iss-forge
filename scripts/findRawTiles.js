/**
 * Raw Tile Finder
 * Reads the ROM as raw 4bpp tiles (no decompression) at various offsets
 * and renders them. Since the title screen tiles might be uncompressed,
 * this scans the ROM directly.
 *
 * Usage: node scripts/findRawTiles.js <path-to-rom.smc> [startHex] [tileCount]
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================
// SNES 4bpp Tile Decoder (raw, no decompression)
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
// Main
// ============================================================

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node scripts/findRawTiles.js <path-to-rom.smc> [startHex] [tileCount]');
  console.log('');
  console.log('Reads raw 4bpp tiles directly from ROM (no decompression).');
  console.log('Renders multiple pages starting at different offsets for visual scanning.');
  console.log('');
  console.log('Default: renders tiles at several candidate offsets in the upper ROM half.');
  process.exit(1);
}

const romPath = resolve(args[0]);
const specificOffset = args[1] ? parseInt(args[1], 16) : null;
const tileCount = args[2] ? parseInt(args[2]) : 256;

console.log(`Reading ROM: ${romPath}`);
const romData = new Uint8Array(readFileSync(romPath));
console.log(`ROM size: ${romData.length} bytes`);

const hasHeader = romData.length % 1024 === 512;
const headerOffset = hasHeader ? 512 : 0;

// If specific offset given, just render that one
// Otherwise, scan through the ROM in pages
const offsets = specificOffset
  ? [specificOffset]
  : (() => {
      // Generate offsets every 0x2000 bytes through the ROM
      // Focus on areas likely to contain graphics (0x80000+)
      const list = [];
      for (let o = 0x80000; o < romData.length - headerOffset; o += 0x2000) {
        list.push(o);
      }
      return list;
    })();

console.log(`Rendering ${offsets.length} offset(s), ${tileCount} tiles each...`);

// Build HTML pages
let htmlBlocks = '';
for (const romOffset of offsets) {
  const fileOffset = romOffset + headerOffset;
  const bytesNeeded = tileCount * 32;

  if (fileOffset + bytesNeeded > romData.length) continue;

  const tileData = romData.slice(fileOffset, fileOffset + bytesNeeded);

  // Quick check: skip if all zeros
  let nonZero = 0;
  for (let i = 0; i < Math.min(tileData.length, 256); i++) {
    if (tileData[i] !== 0) nonZero++;
  }
  if (nonZero < 20) continue; // mostly empty, skip

  const { pixels, width, height } = decodeSnes4bppToPixels(tileData, 16);

  htmlBlocks += `
    <div class="block" id="block_${romOffset.toString(16)}">
      <h3>Offset 0x${romOffset.toString(16).toUpperCase()} (${tileCount} tiles, ${bytesNeeded} bytes raw)</h3>
      <canvas data-pixels='${JSON.stringify(pixels)}' data-w="${width}" data-h="${height}"></canvas>
    </div>`;
}

const html = `<!DOCTYPE html>
<html>
<head>
  <title>ISS Forge - Raw Tile Viewer</title>
  <style>
    body { background: #1e1e2e; color: #cdd6f4; font-family: monospace; padding: 20px; }
    h1 { color: #89b4fa; }
    h3 { color: #a6e3a1; margin-bottom: 4px; font-size: 12px; }
    .block { margin-bottom: 16px; border-bottom: 1px solid #45475a; padding-bottom: 8px; }
    canvas { border: 1px solid #585b70; image-rendering: pixelated; display: block; margin-top: 4px; }
    p { color: #bac2de; margin: 4px 0; }
  </style>
</head>
<body>
  <h1>Raw 4bpp Tile Viewer</h1>
  <p>ROM data as raw SNES 4bpp tiles (no decompression). Scroll to find recognizable graphics.</p>
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

const outputPath = resolve('scripts/raw-tiles.html');
writeFileSync(outputPath, html);
console.log(`Output: ${outputPath}`);
console.log('Open in browser and scroll through to find the logo tiles!');
