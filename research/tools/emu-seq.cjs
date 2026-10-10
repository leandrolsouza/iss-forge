/* global process, console, __dirname */
/**
 * Scripted emulator run (research helper).
 *
 *   node research/tools/emu-seq.cjs "<actions>" [saveStateName]
 *
 * actions (space separated):
 *   START A B X Y L R UP DOWN LEFT RIGHT SELECT  tap a button
 *   wait:N        run N frames
 *   hold:BTN:N    hold a button for N frames
 *   shot:name     save emu-out/name.png
 *   dump:name     save emu-out/name.wram (128 KB WRAM; CGRAM mirror at 0x3200)
 *
 * env:
 *   ISS_CORE  libretro core (default: snes9x2010 from RetroArch)
 *   ROM       ROM to run (default: rom/original/... Europe)
 *   FROM      start from emu-out/<FROM> save state instead of power-on
 *   OUT       output folder (default: research/tools/emu-out)
 *
 * Menu path used in the research (Europe ROM): wait:600 START wait:400 A
 * (Open Game) DOWN DOWN A (CPU vs CPU) A A (teams) → pre-match menu
 * (Game Start / Stadium / ...).
 */
const { createEmu } = require('./libretro-emu.cjs');
const fs = require('fs');
const path = require('path');

const CORE =
  process.env.ISS_CORE || 'E:/Games/Emuladores/RetroArch-Win64/cores/snes9x2010_libretro.dll';
const ROM =
  process.env.ROM ||
  path.join(__dirname, '../../rom/original/International Superstar Soccer (Europe).sfc');
const OUT = process.env.OUT || path.join(__dirname, 'emu-out');
fs.mkdirSync(OUT, { recursive: true });

const emu = createEmu(CORE, ROM);
emu.run(1);
if (process.env.FROM) emu.loadState(fs.readFileSync(path.join(OUT, process.env.FROM)));

const actions = (process.argv[2] || '').split(/\s+/).filter(Boolean);
for (const a of actions) {
  if (a.startsWith('wait:')) emu.run(Number(a.slice(5)));
  else if (a.startsWith('shot:')) emu.screenshot(path.join(OUT, a.slice(5) + '.png'));
  else if (a.startsWith('hold:')) {
    const [, b, n] = a.split(':');
    emu.run(Number(n), [b]);
  } else if (a.startsWith('dump:'))
    fs.writeFileSync(path.join(OUT, a.slice(5) + '.wram'), emu.wram());
  else emu.press(a, 4, 30);
}
if (process.argv[3]) fs.writeFileSync(path.join(OUT, process.argv[3]), emu.saveState());
console.log('done');
