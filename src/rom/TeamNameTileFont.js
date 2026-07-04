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

/**
 * Render text to pixel grid using the ISS Studio font
 * Output: 8 rows × 32 cols, colors 0-3
 * @param {string} text
 * @returns {number[][]}
 */
export function renderTextToPixels(text) {
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
  let pos = totalCols > COLS ? 0 : Math.floor((COLS - totalCols) / 2);

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
