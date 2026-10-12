/**
 * ISS Team Name Tile Font
 * Pixel art font extracted from ISS Studio (rodmguerra/issparser)
 * Each letter is an 8-row grid with variable width
 * Colors: 0=transparent(.), 1=fill(§), 2=shadow(~), 3=corner(space)
 */

// Font data: each char is [width, ...8 rows of pixel data]
// Encoded as strings: .=0, §=1, ~=2, space=3
function parseLetter(lines) {
  const rows = lines.map((line) =>
    Array.from(line).map((ch) => {
      if (ch === '.') return 0;
      if (ch === '§') return 1;
      if (ch === '~') return 2;
      if (ch === ' ') return 3;
      return 0;
    }),
  );
  return rows;
}

const FONT_RAW = {
  A: ['.   .', ' ~§~ ', ' § § ', ' § § ', ' §§§ ', ' § § ', ' § § ', '. . .'],
  B: ['.   .', ' §§~ ', ' § § ', ' §§ .', ' § § ', ' § § ', ' §§~ ', '.   .'],
  C: ['.   .', ' ~§~ ', ' § § ', ' §  .', ' §  .', ' § § ', ' ~§~ ', '.   .'],
  D: ['.   .', ' §§~ ', ' § § ', ' § § ', ' § § ', ' § § ', ' §§~ ', '.   .'],
  E: ['.   .', ' §§§ ', ' §  .', ' §§ .', ' § ..', ' §  .', ' §§§ ', '.   .'],
  F: ['.   .', ' §§§ ', ' §  .', ' §§ .', ' § ..', ' § ..', ' § ..', '. ...'],
  G: ['.   .', ' ~§~ ', ' § § ', ' §  .', ' §~§ ', ' § § ', ' ~§~ ', '.   .'],
  H: ['. . .', ' § § ', ' § § ', ' §§§ ', ' § § ', ' § § ', ' § § ', '. . .'],
  I: ['. .', ' § ', ' § ', ' § ', ' § ', ' § ', ' § ', '. .'],
  J: ['... .', '. . § ', '.. § ', '.. § ', '.  § ', ' § § ', ' ~§§ ', '.   .'],
  K: ['. . .', ' § § ', ' § § ', ' §§ .', ' § § ', ' § § ', ' § § ', '. . .'],
  L: ['. ...', ' § ..', ' § ..', ' § ..', ' § ..', ' §  .', ' §§§ ', '.   .'],
  M: ['. . .', ' § § ', ' §§§ ', ' §~§ ', ' § § ', ' § § ', ' § § ', '. . .'],
  N: ['. . .', ' § § ', ' §~§ ', ' §§§ ', ' §§§ ', ' §~§ ', ' § § ', '. . .'],
  O: ['.   .', ' ~§~ ', ' § § ', ' § § ', ' § § ', ' § § ', ' ~§~ ', '.   .'],
  P: ['.   .', ' §§~ ', ' § § ', ' § § ', ' §§~ ', ' §  .', ' § ..', '. ...'],
  Q: ['.   .', ' ~§~ ', ' § § ', ' § § ', ' § § ', ' ~§~ ', '. ~§ ', '..  .'],
  R: ['.   .', ' §§~ ', ' § § ', ' § § ', ' §§ .', ' § § ', ' § § ', '. . .'],
  S: ['.   .', ' ~§~ ', ' § § ', ' ~§ .', '. ~§ ', ' § § ', ' ~§~ ', '.   .'],
  T: ['.   .', ' §§§ ', '. § .', '. § .', '. § .', '. § .', '. § .', '.. ..'],
  U: ['. . .', ' § § ', ' § § ', ' § § ', ' § § ', ' § § ', ' ~§~ ', '.   .'],
  V: ['. . .', ' § § ', ' § § ', ' § § ', ' § § ', ' § § ', '. § .', '.. ..'],
  W: ['. ... .', ' §   § ', ' § § § ', ' § § § ', ' § § § ', ' ~§~§~ ', '. § § .', '.. . ..'],
  X: ['. . .', ' § § ', ' § § ', '. § .', '. § .', ' § § ', ' § § ', '. . .'],
  Y: ['. . .', ' § § ', ' § § ', ' § § ', '. § .', '. § .', '. § .', '.. ..'],
  Z: ['.   .', ' §§§ ', '.  § ', '. §~ ', ' ~§ .', ' §  .', ' §§§ ', '.   .'],
  0: ['.   .', ' ~§~ ', ' § § ', ' § § ', ' § § ', ' § § ', ' ~§~ ', '.   .'],
  1: ['.. .', '. § ', ' §§ ', '. § ', '. § ', '. § ', '. § ', '.. .'],
  2: ['.   .', ' §§~ ', '.  § ', ' ~§~ ', ' §  .', ' §  .', ' §§§ ', '.   .'],
  3: ['.   .', ' §§§ ', '.  § ', ' §§~ ', '.  § ', '.  § ', ' §§~ ', '.   .'],
  4: ['.   .', ' § § ', ' § § ', ' §§§ ', '.  § ', '.. § ', '.. § ', '... .'],
  5: ['.   .', ' §§§ ', ' §  .', ' §§~ ', '.  § ', ' § § ', ' ~§~ ', '.   .'],
  6: ['.   .', ' ~§§ ', ' §  .', ' §§~ ', ' § § ', ' § § ', ' ~§~ ', '.   .'],
  7: ['. . .', ' §§§ ', '   § ', '  ~§ ', '  §  ', '  §  ', '  §  ', '. . .'],
  8: ['.   .', ' ~§~ ', ' § § ', ' ~§~ ', ' § § ', ' § § ', ' ~§~ ', '.   .'],
  9: ['.   .', ' ~§~ ', ' § § ', ' ~§§ ', '.  § ', ' § § ', ' ~§~ ', '.   .'],
  '.': ['...', '...', '...', '...', '....', '. .', ' § ', '. .'],
  ' ': ['..', '..', '..', '..', '..', '..', '..', '..'],
};

// Parse all letters into pixel arrays
const FONT = {};
for (const [ch, lines] of Object.entries(FONT_RAW)) {
  FONT[ch] = parseLetter(lines);
}

const COLS = 32; // fixed output width (4 tiles)
const ROWS = 8;

/** Width in pixels of the in-game name graphic (4 tiles of 8x8) */
export const IN_GAME_NAME_WIDTH = COLS;

const cleanText = (text) =>
  String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9. ]/g, '');

/**
 * Width in pixels that `text` takes when rendered (letters overlap by 1 column).
 * Anything wider than IN_GAME_NAME_WIDTH is cut off.
 */
export function textPixelWidth(text) {
  const letters = cleanText(text)
    .split('')
    .map((ch) => FONT[ch] || FONT[' ']);
  return letters.reduce((w, letter, i) => w + letter[0].length - (i > 0 ? 1 : 0), 0);
}

/**
 * Render text to pixel grid using the ISS Studio font
 * Output: 8 rows × 32 cols, colors 0-3
 * @param {string} text
 * @param {number|null} [start] - first column (default: centered)
 * @returns {number[][]}
 */
export function renderTextToPixels(text, start = null) {
  const chars = text
    .toUpperCase()
    .replace(/[^A-Z0-9. ]/g, '')
    .split('');

  // Get all letter matrices
  const letters = chars.map((ch) => FONT[ch] || FONT[' ']);

  // Calculate total width with -1 overlap (kerning)
  let totalCols = 0;
  letters.forEach((letter, i) => {
    totalCols += letter[0].length;
    if (i > 0) totalCols -= 1; // kerning overlap
  });

  // Create output matrix (8×32, filled with transparent)
  const matrix = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));

  // Center horizontally
  let pos = start ?? (totalCols > COLS ? 0 : Math.floor((COLS - totalCols) / 2));

  // Place letters with overlap merging (max color wins)
  for (const letter of letters) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < letter[row].length; col++) {
        const x = pos + col;
        if (x >= 0 && x < COLS) {
          // Max color wins (same as ISS Studio)
          matrix[row][x] = Math.max(matrix[row][x], letter[row][col]);
        }
      }
    }
    pos += letter[0].length - 1; // advance with -1 kerning
  }

  return matrix;
}

/**
 * Encode pixel grid as 2bpp SNES tiles
 * 4 tiles × 16 bytes = 64 bytes
 * @param {number[][]} grid - 8 rows × 32 cols, values 0-3
 * @returns {Uint8Array}
 */
export function encode2bppTiles(grid) {
  const numTiles = COLS / 8; // always 4 tiles
  const output = new Uint8Array(numTiles * 16);

  for (let t = 0; t < numTiles; t++) {
    for (let row = 0; row < 8; row++) {
      let bp0 = 0,
        bp1 = 0;
      for (let col = 0; col < 8; col++) {
        const pixel = grid[row][t * 8 + col] & 0x03;
        const bit = 7 - col;
        bp0 |= ((pixel >> 0) & 1) << bit;
        bp1 |= ((pixel >> 1) & 1) << bit;
      }
      output[t * 16 + row * 2] = bp0;
      output[t * 16 + row * 2 + 1] = bp1;
    }
  }

  return output;
}

/**
 * Decode 4 SNES 2bpp tiles (64 bytes) into an 8 x 32 pixel grid (inverse of encode2bppTiles)
 * @param {ArrayLike<number>} bytes
 * @returns {number[][]}
 */
export function decode2bppTiles(bytes) {
  const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  for (let t = 0; t < COLS / 8; t++) {
    for (let row = 0; row < ROWS; row++) {
      const bp0 = bytes[t * 16 + row * 2] || 0;
      const bp1 = bytes[t * 16 + row * 2 + 1] || 0;
      for (let col = 0; col < 8; col++) {
        const bit = 7 - col;
        grid[row][t * 8 + col] = ((bp0 >> bit) & 1) | (((bp1 >> bit) & 1) << 1);
      }
    }
  }
  return grid;
}

// Recognition works on the fill pixels (colours 1 and 2): the outline (3) and the
// transparent pixels (0) of neighbouring letters overlap, the fill does not
const isFill = (p) => p === 1 || p === 2;

// Every glyph's fill, trimmed to the columns that have any. Widest first, so a
// letter is never read as a narrower one that fits inside it (L vs I); letters
// before digits (O and 0 are the same drawing)
const GLYPHS = Object.keys(FONT)
  .filter((ch) => ch !== ' ')
  .map((ch) => {
    const rows = FONT[ch];
    const width = Math.max(...rows.map((r) => r.length));
    const cols = [...Array(width).keys()].filter((x) => rows.some((r) => isFill(r[x])));
    const fill = rows.map((r) => cols.map((x) => (isFill(r[x]) ? r[x] : 0)));
    return { ch, lead: cols[0], width: cols.length, fill };
  })
  .filter((g) => g.width > 0)
  .sort((a, b) => b.width - a.width || Number(/\d/.test(a.ch)) - Number(/\d/.test(b.ch)));

function drawGlyphs(placed) {
  const out = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  for (const { ch, x } of placed) {
    FONT[ch].forEach((row, y) =>
      row.forEach((p, c) => {
        const col = x + c;
        if (col >= 0 && col < COLS) out[y][col] = Math.max(out[y][col], p);
      }),
    );
  }
  return out;
}

/**
 * Read back the text of an in-game name graphic drawn with this font, wherever the
 * letters sit (the original ROM centers some names differently and kerns some pairs
 * tighter, e.g. LY in ITALY). Returns null when the pixels are not exactly made of
 * the font's letters: custom drawings such as the original ARGENTINA, which squeezes
 * letters to fit.
 * @param {number[][]} grid - 8 x 32 pixels
 * @returns {string|null}
 */
export function recognizeTextPixels(grid) {
  if (!Array.isArray(grid) || grid.length !== ROWS) return null;
  const fillAt = (x) => grid.some((r) => isFill(r[x]));
  const fits = (g, x) =>
    x + g.width <= COLS &&
    g.fill.every((row, y) =>
      row.every((p, c) => (isFill(grid[y][x + c]) ? grid[y][x + c] : 0) === p),
    );

  // Depth-first: at each next fill column try every glyph that matches there
  const placed = [];
  const parse = (from) => {
    let x = from;
    while (x < COLS && !fillAt(x)) x++;
    if (x >= COLS) return placed.length > 0 && same(drawGlyphs(placed), grid);
    for (const g of GLYPHS) {
      if (!fits(g, x)) continue;
      placed.push({ ch: g.ch, x: x - g.lead, fillStart: x, fillEnd: x + g.width - 1 });
      if (parse(x + g.width)) return true;
      placed.pop();
    }
    return false;
  };
  if (!parse(0)) return null;

  // One empty column between letters is the normal spacing, each extra one a space
  let text = '';
  placed.forEach((p, i) => {
    if (i > 0) text += ' '.repeat(Math.max(0, p.fillStart - placed[i - 1].fillEnd - 2));
    text += p.ch;
  });
  // O and 0 are drawn the same: inside a number ("1900") it is a zero
  return text.replace(/[O0-9]+/g, (run) => (/[1-9]/.test(run) ? run.replace(/O/g, '0') : run));
}

const same = (a, b) => a.every((row, y) => row.every((p, x) => p === b[y][x]));
