/* global process */
/**
 * Combine PNGs into a grid (contact sheet).
 *   node research/tools/png-montage.cjs out.png columns in1.png in2.png ...
 */
const fs = require('fs');
const { PNG } = require('pngjs');
const [out, colsArg, ...files] = process.argv.slice(2);
const cols = Number(colsArg);
const imgs = files.map((f) => PNG.sync.read(fs.readFileSync(f)));
const W = imgs[0].width,
  H = imgs[0].height;
const rows = Math.ceil(imgs.length / cols);
const dst = new PNG({ width: W * cols + (cols - 1) * 2, height: H * rows + (rows - 1) * 2 });
dst.data.fill(40);
imgs.forEach((img, k) => {
  const ox = (k % cols) * (W + 2),
    oy = Math.floor(k / cols) * (H + 2);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const si = (y * img.width + x) * 4,
        di = ((oy + y) * dst.width + ox + x) * 4;
      for (let c = 0; c < 4; c++) dst.data[di + c] = img.data[si + c];
    }
});
fs.writeFileSync(out, PNG.sync.write(dst));
