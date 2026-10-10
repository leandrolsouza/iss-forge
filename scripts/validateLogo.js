/**
 * ROM Logo Validator
 * Decompresses data at offset 0xB7E9C and renders as SNES 4bpp tiles
 * to validate if it's the ISS title screen logo.
 *
 * Usage: node scripts/validateLogo.js <path-to-rom.smc>
 * Output: scripts/logo-output.html (open in browser to see tiles)
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================
// Konami LZ Decompression (copied from src/rom/KonamiCodec.js)
// ============================================================

const WINDOW_SIZE = 0x400;
const DATA_SIZE = 0x10000;

function konamiDecompress(rom, offset, gameType = 1) {
  const outBuf = new Uint8Array(DATA_SIZE);
  const winBuf = new Uint8Array(WINDOW_SIZE);

  const m1 = rom[offset];
  const m2 = rom[offset + 1];
  const compSize = (m1 | (m2 << 8)) & 0x7fff;

  console.log(`Compressed size header: ${compSize} bytes (0x${compSize.toString(16)})`);
  console.log(
    `First 16 bytes at offset: ${Array.from(rom.slice(offset, offset + 16)).map((b) => b.toString(16).padStart(2, '0')).join(' ')}`,
  );

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

  console.log(`Decompressed size: ${outPos} bytes`);
  return outBuf.slice(0, outPos);
}

// ============================================================
// SNES 4bpp Tile Decoder
// ============================================================

function decodeSnes4bppToPixels(tileData, tilesPerRow = 16) {
  const TILE_SIZE = 32; // 32 bytes per 4bpp 8x8 tile
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
// HTML Generator
// ============================================================

function generateHtml(pixels, width, height, totalTiles, romOffset, compSize, decompSize) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>ISS Forge - ROM Tile Viewer</title>
  <style>
    body { background: #1e1e2e; color: #cdd6f4; font-family: monospace; padding: 20px; }
    h1 { color: #89b4fa; }
    .info { background: #313244; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    .info span { color: #a6e3a1; }
    canvas { border: 1px solid #585b70; image-rendering: pixelated; }
    .controls { margin: 12px 0; }
    .controls label { margin-right: 16px; }
    .controls select { background: #313244; color: #cdd6f4; border: 1px solid #585b70; padding: 4px 8px; }
  </style>
</head>
<body>
  <h1>ROM Tile Viewer - Offset 0x${romOffset.toString(16).toUpperCase()}</h1>
  <div class="info">
    <p>ROM Offset: <span>0x${romOffset.toString(16).toUpperCase()}</span></p>
    <p>Compressed Size: <span>${compSize} bytes</span></p>
    <p>Decompressed Size: <span>${decompSize} bytes</span></p>
    <p>Total Tiles: <span>${totalTiles} (8x8 each, 4bpp)</span></p>
    <p>Grid: <span>${width}x${height} pixels (${width / 8} x ${height / 8} tiles)</span></p>
  </div>

  <div class="controls">
    <label>Scale: <select id="scale" onchange="redraw()">
      <option value="2">2x</option>
      <option value="3" selected>3x</option>
      <option value="4">4x</option>
      <option value="6">6x</option>
    </select></label>
    <label>Palette: <select id="palette" onchange="redraw()">
      <option value="grayscale">Grayscale</option>
      <option value="inverted">Inverted</option>
      <option value="green">Green CRT</option>
      <option value="iss">ISS Logo Colors</option>
    </select></label>
  </div>

  <canvas id="canvas"></canvas>

  <script>
    const pixels = ${JSON.stringify(pixels)};
    const width = ${width};
    const height = ${height};

    const palettes = {
      grayscale: Array.from({length: 16}, (_, i) => {
        const v = Math.round((i / 15) * 255);
        return [v, v, v];
      }),
      inverted: Array.from({length: 16}, (_, i) => {
        const v = 255 - Math.round((i / 15) * 255);
        return [v, v, v];
      }),
      green: Array.from({length: 16}, (_, i) => {
        const v = Math.round((i / 15) * 255);
        return [0, v, Math.round(v * 0.3)];
      }),
      iss: [
        [0,0,0], [20,20,80], [40,40,120], [60,80,160],
        [80,120,200], [100,160,240], [200,200,60], [240,240,80],
        [255,255,120], [200,60,60], [240,80,40], [255,120,60],
        [255,180,100], [255,220,160], [200,200,200], [255,255,255]
      ]
    };

    function redraw() {
      const scale = parseInt(document.getElementById('scale').value);
      const palName = document.getElementById('palette').value;
      const pal = palettes[palName];
      const canvas = document.getElementById('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = pixels[y][x];
          const [r, g, b] = pal[idx];
          ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }

    redraw();
  </script>
</body>
</html>`;
}

// ============================================================
// Main
// ============================================================

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node scripts/validateLogo.js <path-to-rom.smc>');
  console.log('');
  console.log('Optional: node scripts/validateLogo.js <rom> <hex-offset>');
  console.log('  Default offset: 0xB7E9C (title screen logo)');
  process.exit(1);
}

const romPath = resolve(args[0]);
const targetOffset = args[1] ? parseInt(args[1], 16) : 0xb7e9c;

console.log(`Reading ROM: ${romPath}`);
const romData = new Uint8Array(readFileSync(romPath));
console.log(`ROM size: ${romData.length} bytes (0x${romData.length.toString(16)})`);

// Check if ROM has header (512 bytes)
const hasHeader = romData.length % 1024 === 512;
const headerOffset = hasHeader ? 512 : 0;
const offset = targetOffset + headerOffset;

console.log(`Has header: ${hasHeader} (header offset: ${headerOffset})`);
console.log(
  `Target offset: 0x${targetOffset.toString(16)} -> actual file offset: 0x${offset.toString(16)}`,
);
console.log('');

// Decompress
console.log('Decompressing...');
const decompressed = konamiDecompress(romData, offset, 1);

if (decompressed.length === 0) {
  console.error('ERROR: Decompression produced 0 bytes. Wrong offset or not Konami LZ data.');
  process.exit(1);
}

// Get compressed size for info
const compSize = (romData[offset] | (romData[offset + 1] << 8)) & 0x7fff;

// Decode as 4bpp tiles
console.log('Decoding 4bpp tiles...');
const { pixels, width, height, totalTiles } = decodeSnes4bppToPixels(decompressed, 16);

console.log(`Decoded ${totalTiles} tiles into ${width}x${height} pixel grid`);
console.log('');

// Generate HTML
const html = generateHtml(pixels, width, height, totalTiles, targetOffset, compSize, decompressed.length);
const outputPath = resolve('scripts/logo-output.html');
writeFileSync(outputPath, html);

console.log(`Output written to: ${outputPath}`);
console.log('Open in browser to see the tiles!');
