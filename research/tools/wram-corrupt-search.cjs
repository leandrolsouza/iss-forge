/* global process, console, Buffer, __dirname, __filename */
/**
 * Binary search for the ROM data behind some WRAM bytes (research helper).
 *
 *   node research/tools/wram-corrupt-search.cjs <state> <wramStart> <wramEnd> <frames> <romStart> <romEnd> <slices>
 *
 * Starting from emu-out/<state>, runs <frames> frames with copies of the ROM where one slice is
 * XOR-ed, and prints how many bytes of WRAM [wramStart, wramEnd) (hex) differ from a clean run.
 * Useful when the data is unpacked into WRAM (e.g. the title-screen logo sprite list at $7E:5000):
 * take a state from before the screen is built, then halve the slice that changes it.
 * Avoid 0x7F00-0x7FFF (header): the core refuses the ROM. Needs koffi (see README.md).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CORE =
  process.env.ISS_CORE || 'E:/Games/Emuladores/RetroArch-Win64/cores/snes9x2010_libretro.dll';
const OUT = process.env.OUT || path.join(__dirname, 'emu-out');
const SRC = path.join(__dirname, '../../rom/original/International Superstar Soccer (Europe).sfc');
const [state, ws, we, frames, s, e, n] = process.argv.slice(2);
const W0 = parseInt(ws, 16);
const W1 = parseInt(we, 16);

if (process.env.WCS_CHILD) {
  // the core cannot be loaded twice in one process: one child per ROM
  const { createEmu } = require('./libretro-emu.cjs');
  const emu = createEmu(CORE, process.env.WCS_CHILD);
  emu.run(1);
  emu.loadState(fs.readFileSync(path.join(OUT, state)));
  emu.run(Number(frames));
  process.stdout.write(emu.wram().subarray(W0, W1).toString('hex'));
  process.exit(0);
}

const src = fs.readFileSync(SRC);
const run = (rom) => {
  const p = path.join(OUT, 'wcs_tmp.sfc');
  fs.writeFileSync(p, rom);
  try {
    return execFileSync('node', [__filename, ...process.argv.slice(2)], {
      env: { ...process.env, WCS_CHILD: p },
      timeout: 60000,
      maxBuffer: 1 << 24,
    }).toString();
  } catch {
    return null;
  }
};
const base = run(src);
const start = parseInt(s, 16);
const end = parseInt(e, 16);
const step = Math.ceil((end - start) / Number(n));
for (let a = start; a < end; a += step) {
  const b = Math.min(end, a + step);
  if (a <= 0x7fff && b >= 0x7f00) {
    console.log(`skip 0x${a.toString(16)}`);
    continue;
  }
  const rom = Buffer.from(src);
  for (let i = a; i < b; i++) rom[i] ^= 0x55;
  const out = run(rom);
  let d = -1;
  if (out) {
    d = 0;
    for (let i = 0; i < out.length; i += 2) if (out.substr(i, 2) !== base.substr(i, 2)) d++;
  }
  console.log(`0x${a.toString(16)}-0x${b.toString(16)}: ${d < 0 ? 'CRASH' : d}`);
}
