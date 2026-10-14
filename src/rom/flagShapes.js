/**
 * Crests and flags described with simple shapes, drawn on the 24×16 flag grid.
 *
 * Language models are poor at painting a pixel grid cell by cell, but good at
 * describing a picture with shapes and coordinates. Each command is one string:
 *
 *   frame shield|circle|round|full   silhouette of the crest (outside = transparent)
 *   bg C                             fill the frame
 *   hstripes C1 C2 ...               equal horizontal bands over the frame
 *   vstripes C1 C2 ...               equal vertical bands over the frame
 *   rect X Y W H C                   rectangle (top-left X,Y, size W×H)
 *   circle CX CY R C                 filled circle
 *   ring CX CY R C [T]               circle outline, T pixels thick
 *   ellipse CX CY RX RY C
 *   tri X1 Y1 X2 Y2 X3 Y3 C
 *   poly X1,Y1 X2,Y2 X3,Y3 ... C     filled polygon
 *   star CX CY R C                   5-pointed star, point up
 *   line X1 Y1 X2 Y2 C [W]           line W pixels wide
 *   cross C [W]                      centred cross over the frame
 *   saltire C [W]                    diagonal cross over the frame
 *   text TEXT X Y C                  letters 3×5 (A-Z 0-9 . space), top-left X,Y
 *   ctext TEXT Y C                   same, centred in the frame
 *   border C                         1-pixel outline of the frame (drawn last)
 *
 * Coordinates are continuous: the grid is 24 wide (x 0-24) and 16 tall (y 0-16), so
 * its centre is 12,8; pixel x covers [x, x+1). C is a palette index 1-4.
 * Commands are drawn in order (later ones on top) and clipped to the frame.
 */

export const FLAG_W = 24;
export const FLAG_H = 16;
export const MAX_SHAPES = 24;

/** 3×5 letters ('#' = pixel) */
const FONT = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '###', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  '.': ['...', '...', '...', '...', '.#.'],
  ' ': ['..', '..', '..', '..', '..'],
};
export const TEXT_CHARS = Object.keys(FONT).join('');
export const TEXT_HEIGHT = 5;

/** Width in pixels of a text (letters 3 wide, 1 pixel apart) */
export function textWidth(text) {
  const chars = [...String(text)];
  return (
    chars.reduce((w, ch) => w + (FONT[ch] || FONT[' '])[0].length, 0) +
    Math.max(0, chars.length - 1)
  );
}

/** Inside test and bounding box of each frame */
const FRAMES = {
  full: { box: [0, 0, 24, 16], inside: () => true },
  round: {
    box: [0, 0, 24, 16],
    // rounded corners of radius 3
    inside: (x, y) => {
      const cx = Math.min(Math.max(x, 3), 21);
      const cy = Math.min(Math.max(y, 3), 13);
      return (x - cx) ** 2 + (y - cy) ** 2 <= 9;
    },
  },
  circle: { box: [4, 0, 16, 16], inside: (x, y) => (x - 12) ** 2 + (y - 8) ** 2 <= 64 },
  shield: {
    box: [4, 0, 16, 16],
    // flat top, straight sides down to y 8, then curving to a point at the bottom
    inside: (x, y) => {
      const half = y <= 8 ? 8 : 8 * Math.sqrt(Math.max(0, 1 - ((y - 8) / 8) ** 2));
      return Math.abs(x - 12) <= half;
    },
  },
};
export const FRAME_NAMES = Object.keys(FRAMES);

const COMMANDS = {
  frame: 'frame shield|circle|round|full',
  bg: 'bg COLOR',
  hstripes: 'hstripes COLOR COLOR ...',
  vstripes: 'vstripes COLOR COLOR ...',
  rect: 'rect X Y W H COLOR',
  circle: 'circle CX CY R COLOR',
  ring: 'ring CX CY R COLOR [THICKNESS]',
  ellipse: 'ellipse CX CY RX RY COLOR',
  tri: 'tri X1 Y1 X2 Y2 X3 Y3 COLOR',
  poly: 'poly X1,Y1 X2,Y2 X3,Y3 ... COLOR',
  star: 'star CX CY R COLOR',
  line: 'line X1 Y1 X2 Y2 COLOR [WIDTH]',
  cross: 'cross COLOR [WIDTH]',
  saltire: 'saltire COLOR [WIDTH]',
  text: 'text TEXT X Y COLOR',
  ctext: 'ctext TEXT Y COLOR',
  border: 'border COLOR',
};
export const SHAPE_COMMANDS = Object.values(COMMANDS);

function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function starPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? r * 0.42 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
  }
  return pts;
}

/** Pixel stars for small radii (a polygon that small is a blob) */
const SMALL_STARS = [
  { maxR: 2, rows: ['.#.', '###', '.#.'] },
  { maxR: 3.5, rows: ['..#..', '..#..', '#####', '.###.', '.#.#.'] },
];

const isNum = (s) => s !== undefined && /^-?\d+(\.\d+)?$/.test(s);

/**
 * Read one command. Returns { cmd, args, color, ... } or { error } (English, it goes
 * back to the model).
 */
function parseShape(line) {
  const parts = String(line || '')
    .trim()
    .split(/\s+/);
  const cmd = (parts[0] || '').toLowerCase();
  const usage = COMMANDS[cmd];
  if (!usage) {
    return {
      error: `unknown command "${parts[0] || ''}" (use: ${Object.keys(COMMANDS).join(', ')})`,
    };
  }
  const bad = (why) => ({ error: `${why}; the form is "${usage}"` });
  const args = parts.slice(1);
  const colorOf = (s) =>
    isNum(s) && Number.isInteger(Number(s)) && s >= 1 && s <= 4 ? Number(s) : null;
  const nums = (n) => {
    const v = args.slice(0, n);
    return v.length === n && v.every(isNum) ? v.map(Number) : null;
  };

  switch (cmd) {
    case 'frame':
      return FRAMES[args[0]]
        ? { cmd, frame: args[0] }
        : bad(`frame "${args[0] || ''}" does not exist`);
    case 'bg':
    case 'border': {
      const color = colorOf(args[0]);
      return color ? { cmd, color } : bad('needs a color 1-4');
    }
    case 'hstripes':
    case 'vstripes': {
      const colors = args.map(colorOf);
      return colors.length >= 2 && colors.every(Boolean)
        ? { cmd, colors }
        : bad('needs 2 or more colors 1-4');
    }
    case 'cross':
    case 'saltire': {
      const color = colorOf(args[0]);
      const width = args[1] === undefined ? 2 : isNum(args[1]) ? Number(args[1]) : null;
      return color && width
        ? { cmd, color, width }
        : bad('needs a color 1-4 and an optional width');
    }
    case 'text':
    case 'ctext': {
      const n = cmd === 'text' ? 3 : 2;
      // the text may have spaces: the last n arguments are the numbers
      const tail = args.slice(-n);
      const text = args.slice(0, -n).join(' ').toUpperCase();
      if (!text || tail.length < n || !tail.every(isNum)) return bad('wrong arguments');
      const color = colorOf(tail[n - 1]);
      if (!color) return bad('needs a color 1-4');
      const unknown = [...text].filter((ch) => !FONT[ch]);
      if (unknown.length)
        return bad(`letters ${[...new Set(unknown)].join('')} do not exist (A-Z 0-9 . space)`);
      const width = textWidth(text);
      if (width > FLAG_W)
        return bad(`"${text}" is ${width} pixels wide (max ${FLAG_W}, about 6 letters)`);
      return cmd === 'text'
        ? { cmd, text, x: Number(tail[0]), y: Number(tail[1]), color }
        : { cmd, text, y: Number(tail[0]), color };
    }
    case 'poly': {
      const color = colorOf(args[args.length - 1]);
      const pts = args.slice(0, -1).map((p) => p.split(','));
      if (!color) return bad('the last value must be a color 1-4');
      if (pts.length < 3 || pts.some((p) => p.length !== 2 || !p.every(isNum))) {
        return bad('needs 3 or more points written X,Y');
      }
      return { cmd, points: pts.map((p) => p.map(Number)), color };
    }
    default: {
      const counts = { rect: 4, circle: 3, ring: 3, ellipse: 4, tri: 6, star: 3, line: 4 };
      const n = counts[cmd];
      const v = nums(n);
      const color = colorOf(args[n]);
      if (!v || !color) return bad('wrong arguments');
      const extra = args[n + 1];
      if (extra !== undefined && !isNum(extra)) return bad('wrong last argument');
      return { cmd, v, color, extra: extra === undefined ? null : Number(extra) };
    }
  }
}

/** Pixel test of a drawing command at pixel centre (px, py), within the frame box */
function covers(shape, px, py, box) {
  const [bx, by, bw, bh] = box;
  switch (shape.cmd) {
    case 'bg':
      return true;
    case 'rect': {
      const [x, y, w, h] = shape.v;
      return px >= x && px < x + w && py >= y && py < y + h;
    }
    case 'circle': {
      const [cx, cy, r] = shape.v;
      return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
    }
    case 'ring': {
      const [cx, cy, r] = shape.v;
      const d = Math.hypot(px - cx, py - cy);
      return d <= r && d > r - (shape.extra || 1);
    }
    case 'ellipse': {
      const [cx, cy, rx, ry] = shape.v;
      return rx > 0 && ry > 0 && ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;
    }
    case 'tri': {
      const [x1, y1, x2, y2, x3, y3] = shape.v;
      return pointInPolygon(px, py, [
        [x1, y1],
        [x2, y2],
        [x3, y3],
      ]);
    }
    case 'poly':
      return pointInPolygon(px, py, shape.points);
    case 'star':
      return pointInPolygon(px, py, starPoints(...shape.v));
    case 'line': {
      const [x1, y1, x2, y2] = shape.v;
      return distToSegment(px, py, x1, y1, x2, y2) <= (shape.extra || 1) / 2 + 0.2;
    }
    case 'cross': {
      const half = shape.width / 2;
      return Math.abs(px - (bx + bw / 2)) <= half || Math.abs(py - (by + bh / 2)) <= half;
    }
    case 'saltire': {
      const w = shape.width / 2 + 0.2;
      return (
        distToSegment(px, py, bx, by, bx + bw, by + bh) <= w ||
        distToSegment(px, py, bx + bw, by, bx, by + bh) <= w
      );
    }
    default:
      return false;
  }
}

/** Pixels [x, y] of a text whose top-left is (x0, y0) */
function textPixels(text, x0, y0) {
  const out = [];
  let x = Math.round(x0);
  for (const ch of text) {
    const glyph = FONT[ch] || FONT[' '];
    glyph.forEach((row, dy) =>
      [...row].forEach((c, dx) => {
        if (c === '#') out.push([x + dx, Math.round(y0) + dy]);
      }),
    );
    x += glyph[0].length + 1;
  }
  return out;
}

/**
 * Draw the commands.
 * @param {string[]} shapes
 * @returns {{ grid: number[][], errors: string[], layers: object[] }} grid 16×24 of
 *   0-4 (0 = transparent); `errors` name the commands that could not be read (they are
 *   skipped); `layers` tell, for each drawn command, its colour, how many of its pixels
 *   stayed visible and what was under it (for legibility checks).
 */
export function renderShapes(shapes) {
  const errors = [];
  const list = (Array.isArray(shapes) ? shapes : []).slice(0, MAX_SHAPES);
  const parsed = list.map((line, i) => {
    const s = parseShape(line);
    if (s.error) errors.push(`shapes[${i}] "${line}": ${s.error}`);
    return { ...s, index: i, line };
  });
  if ((shapes?.length || 0) > MAX_SHAPES) errors.push(`too many shapes (max ${MAX_SHAPES})`);

  const frameCmd = parsed.find((s) => s.cmd === 'frame');
  const frame = FRAMES[frameCmd?.frame || 'full'];
  const [bx, by, bw, bh] = frame.box;
  const mask = Array.from({ length: FLAG_H }, (_, y) =>
    Array.from({ length: FLAG_W }, (_, x) => frame.inside(x + 0.5, y + 0.5)),
  );
  const grid = Array.from({ length: FLAG_H }, () => new Array(FLAG_W).fill(0));
  // which layer painted each pixel
  const owner = Array.from({ length: FLAG_H }, () => new Array(FLAG_W).fill(-1));
  const layers = [];

  const paint = (layer, x, y) => {
    if (x < 0 || y < 0 || x >= FLAG_W || y >= FLAG_H || !mask[y][x]) {
      layer.clipped++;
      return;
    }
    layer.under.push(grid[y][x]);
    grid[y][x] = layer.color;
    owner[y][x] = layer.id;
    layer.drawn++;
  };

  const drawing = parsed.filter((s) => !s.error && s.cmd !== 'frame' && s.cmd !== 'border');
  for (const s of drawing) {
    const layer = {
      id: layers.length,
      index: s.index,
      line: s.line,
      cmd: s.cmd,
      drawn: 0,
      clipped: 0,
      under: [],
    };
    layers.push(layer);
    if (s.cmd === 'hstripes' || s.cmd === 'vstripes') {
      // one layer per band would be noisy: the bands count as one
      layer.color = s.colors[0];
      const n = s.colors.length;
      for (let y = 0; y < FLAG_H; y++) {
        for (let x = 0; x < FLAG_W; x++) {
          const t = s.cmd === 'hstripes' ? (y + 0.5 - by) / bh : (x + 0.5 - bx) / bw;
          if (t < 0 || t >= 1) continue;
          layer.color = s.colors[Math.min(n - 1, Math.floor(t * n))];
          paint(layer, x, y);
        }
      }
      layer.color = s.colors[0];
      layer.colors = s.colors;
      continue;
    }
    layer.color = s.color;
    if (s.cmd === 'text' || s.cmd === 'ctext') {
      const x0 = s.cmd === 'ctext' ? bx + (bw - textWidth(s.text)) / 2 : s.x;
      layer.text = s.text;
      for (const [x, y] of textPixels(s.text, x0, s.y)) paint(layer, x, y);
      continue;
    }
    const small = s.cmd === 'star' && SMALL_STARS.find((st) => s.v[2] <= st.maxR);
    if (small) {
      const size = small.rows.length;
      const x0 = Math.round(s.v[0] - size / 2);
      const y0 = Math.round(s.v[1] - size / 2);
      small.rows.forEach((row, dy) =>
        [...row].forEach((ch, dx) => ch === '#' && paint(layer, x0 + dx, y0 + dy)),
      );
      continue;
    }
    for (let y = 0; y < FLAG_H; y++) {
      for (let x = 0; x < FLAG_W; x++) {
        if (covers(s, x + 0.5, y + 0.5, frame.box)) paint(layer, x, y);
      }
    }
  }

  // outline of the frame, on top of everything
  const border = parsed.find((s) => s.cmd === 'border');
  if (border) {
    const layer = {
      id: layers.length,
      index: border.index,
      line: border.line,
      cmd: 'border',
      color: border.color,
      drawn: 0,
      clipped: 0,
      under: [],
    };
    layers.push(layer);
    const outside = (x, y) => x < 0 || y < 0 || x >= FLAG_W || y >= FLAG_H || !mask[y][x];
    for (let y = 0; y < FLAG_H; y++) {
      for (let x = 0; x < FLAG_W; x++) {
        if (!mask[y][x]) continue;
        if (outside(x - 1, y) || outside(x + 1, y) || outside(x, y - 1) || outside(x, y + 1)) {
          paint(layer, x, y);
        }
      }
    }
  }

  // pixels still visible per layer (later layers may cover earlier ones)
  for (const layer of layers) layer.visible = 0;
  owner.flat().forEach((id) => {
    if (id >= 0) layers[id].visible++;
  });
  return { grid, errors, layers, frame: frameCmd?.frame || 'full' };
}
