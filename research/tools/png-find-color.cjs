/* global process, console */
/**
 * Count pixels of exact colours in PNGs and list the best matches - handy to find
 * the frames where a test colour painted into the ROM shows up.
 *   node research/tools/png-find-color.cjs "248,0,248;0,248,0" frames/*.png
 */
const fs = require('fs');
const { PNG } = require('pngjs');
const [spec, ...files] = process.argv.slice(2);
const cols = spec.split(';').map((s) => s.split(',').map(Number));
const res = [];
for (const f of files) {
  const img = PNG.sync.read(fs.readFileSync(f));
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    for (const [r, g, b] of cols)
      if (img.data[i] === r && img.data[i + 1] === g && img.data[i + 2] === b) {
        n++;
        break;
      }
  }
  res.push([f, n]);
}
res.sort((a, b) => b[1] - a[1]);
for (const [f, n] of res.slice(0, 8)) console.log(n, f);
