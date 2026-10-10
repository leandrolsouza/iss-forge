/* global process, console, Buffer, __dirname */
/**
 * Print the CGRAM mirror ($7E:3200, 256 colours) of a WRAM dump and locate
 * each palette row in the ROM (research helper).
 *
 *   node research/tools/cgram-match.cjs research/tools/emu-out/match.wram [rom]
 *
 * Colour 0 of each row is transparent and is not stored by the game's loader,
 * so the search uses colours 1-15.
 */
const fs = require('fs');
const path = require('path');

const wram = fs.readFileSync(process.argv[2]);
const rom = fs.readFileSync(
  process.argv[3] ||
    path.join(__dirname, '../../rom/original/International Superstar Soccer (Europe).sfc'),
);
const w = (b, a) => b[a] | (b[a + 1] << 8);
const rgb = (v) => `${v & 31},${(v >> 5) & 31},${(v >> 10) & 31}`;

const cg = [];
for (let i = 0; i < 256; i++) cg.push(w(wram, 0x3200 + i * 2));
for (let row = 0; row < 16; row++) {
  const colours = cg
    .slice(row * 16, row * 16 + 16)
    .map(rgb)
    .join(' ');
  console.log(`${row < 8 ? 'BG ' : 'OBJ'} row ${String(row).padStart(2)}: ${colours}`);
}

console.log('\nROM offsets of colours 1-15 of each row:');
for (let row = 0; row < 16; row++) {
  const needle = Buffer.alloc(30);
  for (let i = 1; i < 16; i++) needle.writeUInt16LE(cg[row * 16 + i], (i - 1) * 2);
  const hits = [];
  let idx = rom.indexOf(needle);
  while (idx >= 0 && hits.length < 6) {
    hits.push('0x' + idx.toString(16));
    idx = rom.indexOf(needle, idx + 1);
  }
  const partial = rom.indexOf(needle.subarray(0, 12));
  console.log(
    `row ${String(row).padStart(2)}: full ${hits.join(' ') || '-'} | first 6 ${partial >= 0 ? '0x' + partial.toString(16) : '-'}`,
  );
}
