/**
 * Colour quantisation for SNES graphics (5-bit RGB): median cut, nearest
 * colour and "two palettes" (groups of pixels, each group uses the palette
 * that fits it best). Colours are [r, g, b] with 0-31 channels.
 */
export const rgb5 = (r, g, b) => [r >> 3, g >> 3, b >> 3];
export const toRaw = ([r, g, b]) => r | (g << 5) | (b << 10);
export const dist = (a, b) => {
  // weighted RGB distance (green counts more)
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
};

/** Median cut of 5-bit colours into at most `max` colours */
export function medianCut(colors, max = 15) {
  if (!colors.length) return [];
  let boxes = [colors];
  while (boxes.length < max) {
    // split the box with the widest channel range
    let best = -1;
    let bestRange = 0;
    let bestCh = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 31;
        let hi = 0;
        for (const c of box) {
          if (c[ch] < lo) lo = c[ch];
          if (c[ch] > hi) hi = c[ch];
        }
        if (hi - lo > bestRange) {
          bestRange = hi - lo;
          best = i;
          bestCh = ch;
        }
      }
    });
    if (best < 0) break;
    const box = [...boxes[best]].sort((a, b) => a[bestCh] - b[bestCh]);
    const mid = box.length >> 1;
    boxes.splice(best, 1, box.slice(0, mid), box.slice(mid));
  }
  const avg = (box) =>
    [0, 1, 2].map((ch) => Math.round(box.reduce((s, c) => s + c[ch], 0) / box.length));
  // unique colours, darkest first (stable output)
  const out = [];
  for (const c of boxes.filter((b) => b.length).map(avg)) {
    if (!out.some((o) => o[0] === c[0] && o[1] === c[1] && o[2] === c[2])) out.push(c);
  }
  return out.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
}

export const nearest = (pal, c) => {
  let best = 0;
  let bestD = Infinity;
  pal.forEach((p, i) => {
    const d = dist(p, c);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return { index: best, d: bestD };
};

export const blockError = (pal, pixels) =>
  pal.length ? pixels.reduce((s, c) => s + nearest(pal, c).d, 0) : Infinity;

/** Two palettes and a palette per block (2-means over blocks, median cut inside) */
export function twoPalettes(blocks, max = 15) {
  const mean = (px) => [0, 1, 2].map((ch) => px.reduce((s, c) => s + c[ch], 0) / px.length);
  const means = blocks.map((b) => mean(b.pixels));
  // seeds: the block farthest from the average, then the one farthest from it
  const all = mean(blocks.flatMap((b) => b.pixels));
  const far = (from) =>
    means.reduce((bi, m, i) => (dist(m, from) > dist(means[bi], from) ? i : bi), 0);
  const a = far(all);
  const b = far(means[a]);
  let assign = means.map((m) => (dist(m, means[a]) <= dist(m, means[b]) ? 0 : 1));
  let pals = [[], []];
  for (let iter = 0; iter < 4; iter++) {
    pals = [0, 1].map((p) =>
      medianCut(
        blocks.filter((_, i) => assign[i] === p).flatMap((x) => x.pixels),
        max,
      ),
    );
    if (!pals[1].length) pals[1] = pals[0];
    if (!pals[0].length) pals[0] = pals[1];
    assign = blocks.map((x) =>
      blockError(pals[0], x.pixels) <= blockError(pals[1], x.pixels) ? 0 : 1,
    );
  }
  return { pals, assign };
}
