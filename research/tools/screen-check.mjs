/* global process, console */
/**
 * Compare the screen viewer (src/rom/screenView.js) with emulator screenshots.
 *
 *   NODE_PATH=<dir with pngjs> node --import ./research/tools/ext-loader.mjs \
 *     research/tools/screen-check.mjs <shots dir> [view id...]
 *
 * For each SCREEN_VIEWS recipe with a `state`, draws the screen (with the BG2 scroll of the
 * state) and compares it with <shots dir>/<state name>.png (take them with
 * `FROM=x.st OUT=<dir> node research/tools/emu-seq.cjs "wait:1 shot:x"`). Writes
 * <shots dir>/check_<id>.png = viewer | emulator | differences (red).
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { SCREEN_VIEWS, renderScreenView } from '../../src/rom/screenView.js';
import { readState } from './screen-recipe.mjs';
import RomParser from '../../src/rom/RomParser.js';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const here = path.dirname(fileURLToPath(import.meta.url));
const [dir, ...only] = process.argv.slice(2);
const data = new Uint8Array(
  fs.readFileSync(
    process.env.ROM ||
      path.join(here, '../../rom/original/International Superstar Soccer (Europe).sfc'),
  ),
);
const rom = new RomParser(data);

for (const view of SCREEN_VIEWS) {
  if (view.kind || (only.length && !only.includes(view.id))) continue;
  const name = view.state.replace(/\.st$/, '');
  const shotFile = path.join(dir, `${name}.png`);
  if (!fs.existsSync(shotFile)) {
    console.log(`${view.id}: no ${shotFile}`);
    continue;
  }
  const st = readState(path.join(here, 'emu-out', view.state));
  const shot = PNG.sync.read(fs.readFileSync(shotFile));
  // the screenshot is one frame after the state and BG2 scrolls: keep the best of 0-2 lines
  const close = (img, x, y) => {
    const i = (y * 256 + x) * 4;
    const j = (y * shot.width + x) * 4;
    return [0, 1, 2].every((k) => Math.abs((img.data[i + k] >> 3) - (shot.data[j + k] >> 3)) <= 1);
  };
  let img = null;
  let best = -1;
  for (const shift of [0, 1, 2]) {
    const trial = renderScreenView(rom, view, {
      scroll: { bg2: [st.bg[1].hofs, st.bg[1].vofs + shift] },
    });
    let n = 0;
    for (let y = 0; y < 224; y += 2) for (let x = 0; x < 256; x += 2) if (close(trial, x, y)) n++;
    if (n > best) [best, img] = [n, trial];
  }
  const out = new PNG({ width: 256 * 3, height: 224 });
  let same = 0;
  for (let y = 0; y < 224; y++)
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      const j = (y * shot.width + x) * 4;
      const a = [img.data[i], img.data[i + 1], img.data[i + 2]];
      const b = [shot.data[j], shot.data[j + 1], shot.data[j + 2]];
      // the core outputs 5-bit channels expanded (c << 3 | c >> 2): compare the top 5 bits,
      // within 1 level (snes9x drops the low bit of the sub screen in subtract-half)
      const eq = a.every((v, k) => Math.abs((v >> 3) - (b[k] >> 3)) <= 1);
      if (eq) same++;
      const put = (ox, c) => {
        const k = (y * 768 + ox + x) * 4;
        out.data[k] = c[0];
        out.data[k + 1] = c[1];
        out.data[k + 2] = c[2];
        out.data[k + 3] = 255;
      };
      put(0, a);
      put(256, b);
      put(512, eq ? b.map((v) => v >> 2) : [255, 0, 0]);
    }
  fs.writeFileSync(path.join(dir, `check_${view.id}.png`), PNG.sync.write(out));
  console.log(`${view.id.padEnd(14)} ${((same / (256 * 224)) * 100).toFixed(1)}% equal`);
}
