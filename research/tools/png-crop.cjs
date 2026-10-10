/* global process */
/**
 * Crop and enlarge part of a PNG (nearest neighbour) — handy to inspect sprites.
 *   node research/tools/png-crop.cjs in.png x y width height scale out.png
 */
const fs = require('fs');
const { PNG } = require('pngjs');
const [file, x0, y0, w, h, scale, out] = process.argv.slice(2);
const src = PNG.sync.read(fs.readFileSync(file));
const S = Number(scale || 6);
const W = Number(w),
  H = Number(h),
  X = Number(x0),
  Y = Number(y0);
const dst = new PNG({ width: W * S, height: H * S });
for (let y = 0; y < H * S; y++)
  for (let x = 0; x < W * S; x++) {
    const sx = X + Math.floor(x / S),
      sy = Y + Math.floor(y / S);
    const si = (sy * src.width + sx) * 4,
      di = (y * W * S + x) * 4;
    for (let k = 0; k < 4; k++) dst.data[di + k] = src.data[si + k];
  }
fs.writeFileSync(out, PNG.sync.write(dst));
