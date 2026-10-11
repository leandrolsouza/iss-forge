/* global process, __dirname */
/**
 * Copy of the ROM with a byte range XOR-ed (find where some graphics / data come from).
 *   node research/tools/rom-corrupt.cjs <start hex> <end hex> <out.sfc> [rom]
 * Load a save state of the screen with ROM=<out.sfc> and see what breaks; halve the range
 * until only the data is left. Avoid 0x7F00-0x7FFF (header): the core refuses the ROM.
 */
const fs = require('fs');
const path = require('path');
const [s, e, out, src] = process.argv.slice(2);
const rom = fs.readFileSync(
  src || path.join(__dirname, '../../rom/original/International Superstar Soccer (Europe).sfc'),
);
for (let i = parseInt(s, 16); i < parseInt(e, 16); i++) rom[i] ^= 0x55;
fs.writeFileSync(out, rom);
