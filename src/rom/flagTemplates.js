/**
 * Flag Templates - Pre-defined flag patterns for the Flag Design Editor
 *
 * Each template has:
 * - id: unique identifier
 * - nameKey: i18n key for display name
 * - generate(width, height): returns a 2D array [row][col] of palette indices (1-4)
 *
 * Grid is 24 wide x 16 tall. Palette indices: 0=transparent, 1-4=colors.
 */

const GRID_WIDTH = 24;
const GRID_HEIGHT = 16;

/**
 * Helper: creates an empty grid filled with a single color
 */
function createGrid(fillColor = 0) {
  return Array.from({ length: GRID_HEIGHT }, () => Array(GRID_WIDTH).fill(fillColor));
}

export const FLAG_TEMPLATES = [
  {
    id: 'horizontal-3',
    nameKey: 'flagTemplate.horizontal3',
    generate: () => {
      const grid = createGrid();
      const third = Math.round(GRID_HEIGHT / 3);
      for (let y = 0; y < GRID_HEIGHT; y++) {
        const color = y < third ? 1 : y < third * 2 ? 2 : 3;
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = color;
        }
      }
      return grid;
    },
  },
  {
    id: 'vertical-3',
    nameKey: 'flagTemplate.vertical3',
    generate: () => {
      const grid = createGrid();
      const third = Math.round(GRID_WIDTH / 3);
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = x < third ? 1 : x < third * 2 ? 2 : 3;
        }
      }
      return grid;
    },
  },
  {
    id: 'horizontal-2',
    nameKey: 'flagTemplate.horizontal2',
    generate: () => {
      const grid = createGrid();
      const half = Math.round(GRID_HEIGHT / 2);
      for (let y = 0; y < GRID_HEIGHT; y++) {
        const color = y < half ? 1 : 2;
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = color;
        }
      }
      return grid;
    },
  },
  {
    id: 'vertical-2',
    nameKey: 'flagTemplate.vertical2',
    generate: () => {
      const grid = createGrid();
      const half = Math.round(GRID_WIDTH / 2);
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = x < half ? 1 : 2;
        }
      }
      return grid;
    },
  },
  {
    id: 'nordic-cross',
    nameKey: 'flagTemplate.nordicCross',
    generate: () => {
      const grid = createGrid(1);
      // Vertical bar offset to the left (Nordic style)
      const crossX = Math.round(GRID_WIDTH / 3);
      const crossThickness = 2;
      const hCenterY = Math.floor(GRID_HEIGHT / 2);

      // Horizontal bar
      for (let y = hCenterY - 1; y <= hCenterY; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = 2;
        }
      }
      // Vertical bar
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let dx = 0; dx < crossThickness; dx++) {
          grid[y][crossX + dx] = 2;
        }
      }
      // Cross outline (color 3) - inner edges
      for (let x = 0; x < GRID_WIDTH; x++) {
        if (x < crossX || x >= crossX + crossThickness) {
          if (hCenterY - 2 >= 0) grid[hCenterY - 2][x] = 3;
          if (hCenterY + 1 < GRID_HEIGHT) grid[hCenterY + 1][x] = 3;
        }
      }
      for (let y = 0; y < GRID_HEIGHT; y++) {
        if (y < hCenterY - 1 || y > hCenterY) {
          if (crossX - 1 >= 0) grid[y][crossX - 1] = 3;
          if (crossX + crossThickness < GRID_WIDTH) grid[y][crossX + crossThickness] = 3;
        }
      }
      return grid;
    },
  },
  {
    id: 'center-cross',
    nameKey: 'flagTemplate.centerCross',
    generate: () => {
      const grid = createGrid(1);
      const centerX = Math.floor(GRID_WIDTH / 2);
      const centerY = Math.floor(GRID_HEIGHT / 2);
      const thickness = 4;
      const halfT = thickness / 2;

      // Horizontal bar
      for (let y = centerY - halfT; y < centerY + halfT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          if (y >= 0 && y < GRID_HEIGHT) grid[y][x] = 2;
        }
      }
      // Vertical bar
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = centerX - halfT; x < centerX + halfT; x++) {
          if (x >= 0 && x < GRID_WIDTH) grid[y][x] = 2;
        }
      }
      return grid;
    },
  },
  {
    id: 'diagonal-half',
    nameKey: 'flagTemplate.diagonal',
    generate: () => {
      const grid = createGrid();
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          // Diagonal from top-left to bottom-right
          const threshold = (x / GRID_WIDTH) * GRID_HEIGHT;
          grid[y][x] = y < threshold ? 1 : 2;
        }
      }
      return grid;
    },
  },
  {
    id: 'quadrants',
    nameKey: 'flagTemplate.quadrants',
    generate: () => {
      const grid = createGrid();
      const halfX = Math.round(GRID_WIDTH / 2);
      const halfY = Math.round(GRID_HEIGHT / 2);
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          if (y < halfY && x < halfX) grid[y][x] = 1;
          else if (y < halfY && x >= halfX) grid[y][x] = 2;
          else if (y >= halfY && x < halfX) grid[y][x] = 3;
          else grid[y][x] = 4;
        }
      }
      return grid;
    },
  },
  {
    id: 'horizontal-stripe',
    nameKey: 'flagTemplate.horizontalStripe',
    generate: () => {
      const grid = createGrid(1);
      // Center horizontal stripe
      const stripeHeight = 4;
      const startY = Math.floor((GRID_HEIGHT - stripeHeight) / 2);
      for (let y = startY; y < startY + stripeHeight; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = 2;
        }
      }
      return grid;
    },
  },
  {
    id: 'solid',
    nameKey: 'flagTemplate.solid',
    generate: () => {
      return createGrid(1);
    },
  },
  {
    id: 'border',
    nameKey: 'flagTemplate.border',
    generate: () => {
      const grid = createGrid(1);
      const borderSize = 2;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          if (
            y < borderSize ||
            y >= GRID_HEIGHT - borderSize ||
            x < borderSize ||
            x >= GRID_WIDTH - borderSize
          ) {
            grid[y][x] = 2;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'saltire',
    nameKey: 'flagTemplate.saltire',
    generate: () => {
      const grid = createGrid(1);
      // X-shaped cross (like Scotland/Jamaica)
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const normalX = x / (GRID_WIDTH - 1);
          const normalY = y / (GRID_HEIGHT - 1);
          const distDiag1 = Math.abs(normalY - normalX);
          const distDiag2 = Math.abs(normalY - (1 - normalX));
          if (distDiag1 < 0.12 || distDiag2 < 0.12) {
            grid[y][x] = 2;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'triangle-left',
    nameKey: 'flagTemplate.triangleLeft',
    generate: () => {
      const grid = createGrid(2);
      // Triangle on the left side (like Czech Republic, Philippines)
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const midY = GRID_HEIGHT / 2;
          const dist = Math.abs(y - midY);
          const triangleEdge = (GRID_WIDTH / 2) * (1 - dist / midY);
          if (x < triangleEdge) {
            grid[y][x] = 1;
          }
        }
      }
      // Top/bottom halves for the background
      const halfY = Math.floor(GRID_HEIGHT / 2);
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          if (grid[y][x] === 2) {
            grid[y][x] = y < halfY ? 2 : 3;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'horizontal-5',
    nameKey: 'flagTemplate.horizontal5',
    generate: () => {
      const grid = createGrid();
      // 5 horizontal stripes alternating (like USA-style, Greece-style)
      const stripeH = Math.round(GRID_HEIGHT / 5);
      for (let y = 0; y < GRID_HEIGHT; y++) {
        const stripe = Math.min(Math.floor(y / stripeH), 4);
        const color = stripe % 2 === 0 ? 1 : 2;
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = color;
        }
      }
      return grid;
    },
  },
  {
    id: 'canton',
    nameKey: 'flagTemplate.canton',
    generate: () => {
      const grid = createGrid();
      // Stripes with a canton (top-left block, like USA, Malaysia)
      const stripeH = Math.round(GRID_HEIGHT / 5);
      for (let y = 0; y < GRID_HEIGHT; y++) {
        const stripe = Math.min(Math.floor(y / stripeH), 4);
        const color = stripe % 2 === 0 ? 1 : 2;
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = color;
        }
      }
      // Canton (top-left rectangle)
      const cantonW = Math.round(GRID_WIDTH * 0.4);
      const cantonH = Math.round(GRID_HEIGHT * 0.6);
      for (let y = 0; y < cantonH; y++) {
        for (let x = 0; x < cantonW; x++) {
          grid[y][x] = 3;
        }
      }
      return grid;
    },
  },
  {
    id: 'diamond',
    nameKey: 'flagTemplate.diamond',
    generate: () => {
      const grid = createGrid(1);
      // Diamond shape in center (like Brazil)
      const centerX = GRID_WIDTH / 2;
      const centerY = GRID_HEIGHT / 2;
      const radiusX = GRID_WIDTH * 0.4;
      const radiusY = GRID_HEIGHT * 0.4;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const dx = Math.abs(x - centerX) / radiusX;
          const dy = Math.abs(y - centerY) / radiusY;
          if (dx + dy <= 1) {
            grid[y][x] = 2;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'circle-center',
    nameKey: 'flagTemplate.circleCenter',
    generate: () => {
      const grid = createGrid(1);
      // Circle in center (like Japan, Bangladesh)
      const centerX = GRID_WIDTH / 2;
      const centerY = GRID_HEIGHT / 2;
      const radius = GRID_HEIGHT * 0.35;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          if (dx * dx + dy * dy <= radius * radius) {
            grid[y][x] = 2;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'vertical-stripe',
    nameKey: 'flagTemplate.verticalStripe',
    generate: () => {
      const grid = createGrid(1);
      // Center vertical stripe
      const stripeWidth = 6;
      const startX = Math.floor((GRID_WIDTH - stripeWidth) / 2);
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = startX; x < startX + stripeWidth; x++) {
          grid[y][x] = 2;
        }
      }
      return grid;
    },
  },
  {
    id: 'horizontal-3-thick-center',
    nameKey: 'flagTemplate.horizontal3ThickCenter',
    generate: () => {
      const grid = createGrid();
      // 3 stripes with thicker center (like Spain, Cambodia)
      const thinH = 3;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        let color;
        if (y < thinH) color = 1;
        else if (y >= GRID_HEIGHT - thinH) color = 1;
        else color = 2;
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = color;
        }
      }
      return grid;
    },
  },
  {
    id: 'diagonal-stripe',
    nameKey: 'flagTemplate.diagonalStripe',
    generate: () => {
      const grid = createGrid(1);
      // Diagonal stripe from bottom-left to top-right (like DR Congo, Tanzania)
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const normalX = x / GRID_WIDTH;
          const normalY = y / GRID_HEIGHT;
          const pos = normalX + normalY;
          if (pos > 0.75 && pos < 1.25) {
            grid[y][x] = 2;
          } else if (pos >= 1.25) {
            grid[y][x] = 3;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'cross-with-border',
    nameKey: 'flagTemplate.crossWithBorder',
    generate: () => {
      const grid = createGrid(1);
      // Cross with outline (like England + border, Dominican Republic)
      const centerX = Math.floor(GRID_WIDTH / 2);
      const centerY = Math.floor(GRID_HEIGHT / 2);
      // Thick cross
      for (let y = centerY - 2; y <= centerY + 1; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          if (y >= 0 && y < GRID_HEIGHT) grid[y][x] = 2;
        }
      }
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = centerX - 2; x <= centerX + 1; x++) {
          if (x >= 0 && x < GRID_WIDTH) grid[y][x] = 2;
        }
      }
      // Inner thin cross
      for (let x = 0; x < GRID_WIDTH; x++) {
        grid[centerY - 1][x] = 3;
        grid[centerY][x] = 3;
      }
      for (let y = 0; y < GRID_HEIGHT; y++) {
        grid[y][centerX - 1] = 3;
        grid[y][centerX] = 3;
      }
      return grid;
    },
  },
  {
    id: 'check-pattern',
    nameKey: 'flagTemplate.checkPattern',
    generate: () => {
      const grid = createGrid();
      // Checkerboard pattern (like Croatia coat of arms)
      const cellSize = 4;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const cellX = Math.floor(x / cellSize);
          const cellY = Math.floor(y / cellSize);
          grid[y][x] = (cellX + cellY) % 2 === 0 ? 1 : 2;
        }
      }
      return grid;
    },
  },
  {
    id: 'vertical-3-thin-center',
    nameKey: 'flagTemplate.vertical3ThinCenter',
    generate: () => {
      const grid = createGrid(1);
      // 3 vertical with thin center stripe (like Canada style)
      const stripeW = 4;
      const startX = Math.floor((GRID_WIDTH - stripeW) / 2);
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = startX; x < startX + stripeW; x++) {
          grid[y][x] = 2;
        }
        for (let x = 0; x < 6; x++) {
          grid[y][x] = 3;
        }
        for (let x = GRID_WIDTH - 6; x < GRID_WIDTH; x++) {
          grid[y][x] = 3;
        }
      }
      return grid;
    },
  },
  {
    id: 'horizontal-gradient',
    nameKey: 'flagTemplate.horizontalGradient',
    generate: () => {
      const grid = createGrid();
      // 4 horizontal bands using all 4 colors
      const bandH = Math.round(GRID_HEIGHT / 4);
      for (let y = 0; y < GRID_HEIGHT; y++) {
        const band = Math.min(Math.floor(y / bandH), 3);
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = band + 1;
        }
      }
      return grid;
    },
  },
  {
    id: 'vertical-gradient',
    nameKey: 'flagTemplate.verticalGradient',
    generate: () => {
      const grid = createGrid();
      // 4 vertical bands using all 4 colors
      const bandW = Math.round(GRID_WIDTH / 4);
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const band = Math.min(Math.floor(x / bandW), 3);
          grid[y][x] = band + 1;
        }
      }
      return grid;
    },
  },
  {
    id: 'top-triangle',
    nameKey: 'flagTemplate.topTriangle',
    generate: () => {
      const grid = createGrid(2);
      // Triangle pointing down from top (like Bahamas-style)
      for (let y = 0; y < GRID_HEIGHT; y++) {
        const width = Math.round((y / GRID_HEIGHT) * (GRID_WIDTH / 2));
        for (let x = 0; x < width; x++) {
          grid[y][x] = 1;
        }
      }
      return grid;
    },
  },
  {
    id: 'arrow-left',
    nameKey: 'flagTemplate.arrowLeft',
    generate: () => {
      const grid = createGrid(1);
      // Arrow/chevron pointing right from left side
      const midY = GRID_HEIGHT / 2;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        const dist = Math.abs(y - midY);
        const arrowTip = Math.round((GRID_WIDTH * 0.5) * (1 - dist / midY));
        for (let x = 0; x < arrowTip; x++) {
          grid[y][x] = 2;
        }
      }
      return grid;
    },
  },
  {
    id: 'v-shape',
    nameKey: 'flagTemplate.vShape',
    generate: () => {
      const grid = createGrid(1);
      // V-shape / chevron (like South Africa-ish)
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const midY = GRID_HEIGHT / 2;
          const dist = Math.abs(y - midY);
          const vEdge = Math.round((GRID_WIDTH * 0.4) * (1 - dist / midY));
          if (x < vEdge) {
            grid[y][x] = 2;
          } else if (x < vEdge + 3) {
            grid[y][x] = 3;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'y-shape',
    nameKey: 'flagTemplate.yShape',
    generate: () => {
      const grid = createGrid();
      // Y-shape (like South Africa)
      const midY = GRID_HEIGHT / 2;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = y < midY ? 1 : 3;
        }
      }
      // Y band
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const dist = Math.abs(y - midY);
          const yEdge = Math.round((GRID_WIDTH * 0.35) * (1 - dist / midY));
          if (x < yEdge) {
            grid[y][x] = 2;
          }
          // Horizontal continuation from the Y point
          if (Math.abs(y - midY) < 2 && x >= yEdge) {
            grid[y][x] = 2;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'corner-triangle',
    nameKey: 'flagTemplate.cornerTriangle',
    generate: () => {
      const grid = createGrid(1);
      // Triangle in top-left corner
      for (let y = 0; y < GRID_HEIGHT; y++) {
        const maxX = Math.round(GRID_WIDTH * (1 - y / GRID_HEIGHT));
        for (let x = 0; x < maxX; x++) {
          grid[y][x] = 2;
        }
      }
      return grid;
    },
  },
  {
    id: 'horizontal-thin-stripes',
    nameKey: 'flagTemplate.horizontalThinStripes',
    generate: () => {
      const grid = createGrid();
      // Many thin horizontal stripes (like Uruguay, Greece)
      for (let y = 0; y < GRID_HEIGHT; y++) {
        const color = y % 4 < 2 ? 1 : 2;
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = color;
        }
      }
      return grid;
    },
  },
  {
    id: 'frame',
    nameKey: 'flagTemplate.frame',
    generate: () => {
      const grid = createGrid(1);
      // Thick frame with different inner color (like picture frame)
      const frameSize = 3;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          if (
            y < frameSize ||
            y >= GRID_HEIGHT - frameSize ||
            x < frameSize ||
            x >= GRID_WIDTH - frameSize
          ) {
            grid[y][x] = 2;
          }
          // Inner frame
          if (
            (y === frameSize || y === GRID_HEIGHT - frameSize - 1) &&
            x >= frameSize &&
            x < GRID_WIDTH - frameSize
          ) {
            grid[y][x] = 3;
          }
          if (
            (x === frameSize || x === GRID_WIDTH - frameSize - 1) &&
            y >= frameSize &&
            y < GRID_HEIGHT - frameSize
          ) {
            grid[y][x] = 3;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'cross-saltire',
    nameKey: 'flagTemplate.crossSaltire',
    generate: () => {
      const grid = createGrid(1);
      // Combined cross + saltire (like UK Union Jack)
      const centerX = Math.floor(GRID_WIDTH / 2);
      const centerY = Math.floor(GRID_HEIGHT / 2);
      // Saltire (X)
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const normalX = x / (GRID_WIDTH - 1);
          const normalY = y / (GRID_HEIGHT - 1);
          const distDiag1 = Math.abs(normalY - normalX);
          const distDiag2 = Math.abs(normalY - (1 - normalX));
          if (distDiag1 < 0.1 || distDiag2 < 0.1) {
            grid[y][x] = 3;
          }
        }
      }
      // Cross (+)
      for (let y = centerY - 1; y <= centerY; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = 2;
        }
      }
      for (let y = 0; y < GRID_HEIGHT; y++) {
        grid[y][centerX - 1] = 2;
        grid[y][centerX] = 2;
      }
      return grid;
    },
  },
  {
    id: 'sun-rays',
    nameKey: 'flagTemplate.sunRays',
    generate: () => {
      const grid = createGrid(1);
      // Rays emanating from center (like Macedonia, Japan Imperial)
      const centerX = GRID_WIDTH / 2;
      const centerY = GRID_HEIGHT / 2;
      const numRays = 8;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const angle = Math.atan2(y - centerY, x - centerX);
          const sector = ((angle + Math.PI) / (2 * Math.PI)) * numRays;
          if (Math.floor(sector) % 2 === 0) {
            grid[y][x] = 2;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'diagonal-quarters',
    nameKey: 'flagTemplate.diagonalQuarters',
    generate: () => {
      const grid = createGrid();
      // 4 triangles meeting at center (like split diagonally)
      const centerX = GRID_WIDTH / 2;
      const centerY = GRID_HEIGHT / 2;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const dx = x - centerX;
          const dy = (y - centerY) * (GRID_WIDTH / GRID_HEIGHT);
          if (dy < -Math.abs(dx)) grid[y][x] = 1; // top
          else if (dx > Math.abs(dy)) grid[y][x] = 2; // right
          else if (dy > Math.abs(dx)) grid[y][x] = 3; // bottom
          else grid[y][x] = 4; // left
        }
      }
      return grid;
    },
  },
  {
    id: 'horizontal-bicolor-stripe',
    nameKey: 'flagTemplate.horizontalBicolorStripe',
    generate: () => {
      const grid = createGrid();
      // Two halves with a contrasting stripe between them
      const halfY = Math.floor(GRID_HEIGHT / 2);
      const stripeH = 2;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          if (y < halfY - stripeH / 2) grid[y][x] = 1;
          else if (y >= halfY + stripeH / 2) grid[y][x] = 3;
          else grid[y][x] = 2;
        }
      }
      return grid;
    },
  },
  {
    id: 'bend',
    nameKey: 'flagTemplate.bend',
    generate: () => {
      const grid = createGrid(1);
      // Diagonal band from top-left to bottom-right (heraldic bend)
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const normalX = x / GRID_WIDTH;
          const normalY = y / GRID_HEIGHT;
          if (Math.abs(normalX - normalY) < 0.18) {
            grid[y][x] = 2;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'pall',
    nameKey: 'flagTemplate.pall',
    generate: () => {
      const grid = createGrid();
      // Y-shaped division (heraldic pall, like South Africa without chevron)
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const midY = GRID_HEIGHT / 2;
          const midX = GRID_WIDTH / 3;
          if (x < midX) {
            // Left: split top/bottom
            grid[y][x] = y < midY ? 1 : 3;
          } else {
            // Right: based on angle from the Y junction
            const dy = y - midY;
            const dx = x - midX;
            const slope = dy / (dx || 1);
            if (Math.abs(slope) < 0.6) {
              grid[y][x] = 2;
            } else {
              grid[y][x] = slope < 0 ? 1 : 3;
            }
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'top-bottom-border',
    nameKey: 'flagTemplate.topBottomBorder',
    generate: () => {
      const grid = createGrid(1);
      // Horizontal borders top and bottom (like Austria, Latvia)
      const borderH = 4;
      for (let y = 0; y < borderH; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = 2;
        }
      }
      for (let y = GRID_HEIGHT - borderH; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = 2;
        }
      }
      return grid;
    },
  },
  {
    id: 'left-right-border',
    nameKey: 'flagTemplate.leftRightBorder',
    generate: () => {
      const grid = createGrid(1);
      // Vertical borders left and right
      const borderW = 4;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < borderW; x++) {
          grid[y][x] = 2;
        }
        for (let x = GRID_WIDTH - borderW; x < GRID_WIDTH; x++) {
          grid[y][x] = 2;
        }
      }
      return grid;
    },
  },
  {
    id: 'horizontal-3-unequal',
    nameKey: 'flagTemplate.horizontal3Unequal',
    generate: () => {
      const grid = createGrid();
      // 3 horizontal stripes: thin-thick-thin (like Colombia)
      for (let y = 0; y < GRID_HEIGHT; y++) {
        let color;
        if (y < GRID_HEIGHT / 2) color = 1;
        else if (y < Math.round(GRID_HEIGHT * 0.75)) color = 2;
        else color = 3;
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = color;
        }
      }
      return grid;
    },
  },
  {
    id: 'serrated',
    nameKey: 'flagTemplate.serrated',
    generate: () => {
      const grid = createGrid(1);
      // Serrated/zigzag edge on the left (like Bahrain, Qatar)
      const teethWidth = 6;
      const toothHeight = 4;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        const tooth = y % toothHeight;
        const offset = tooth < toothHeight / 2
          ? Math.round((tooth / (toothHeight / 2)) * teethWidth)
          : Math.round(((toothHeight - tooth) / (toothHeight / 2)) * teethWidth);
        for (let x = 0; x < GRID_WIDTH; x++) {
          if (x >= offset) {
            grid[y][x] = 2;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'waves',
    nameKey: 'flagTemplate.waves',
    generate: () => {
      const grid = createGrid(1);
      // Wavy horizontal stripes
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const wave = Math.sin((x / GRID_WIDTH) * Math.PI * 3) * 2;
          const adjustedY = y - wave;
          if (adjustedY > GRID_HEIGHT * 0.6) grid[y][x] = 3;
          else if (adjustedY > GRID_HEIGHT * 0.35) grid[y][x] = 2;
        }
      }
      return grid;
    },
  },
  {
    id: 'half-sun',
    nameKey: 'flagTemplate.halfSun',
    generate: () => {
      const grid = createGrid(1);
      // Half circle at bottom (like rising sun)
      const centerX = GRID_WIDTH / 2;
      const centerY = GRID_HEIGHT;
      const radius = GRID_HEIGHT * 0.7;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          if (dx * dx + dy * dy <= radius * radius) {
            grid[y][x] = 2;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'crescent',
    nameKey: 'flagTemplate.crescent',
    generate: () => {
      const grid = createGrid(1);
      // Crescent moon shape (like Turkey, Pakistan)
      const centerX = GRID_WIDTH / 2 - 1;
      const centerY = GRID_HEIGHT / 2;
      const outerR = GRID_HEIGHT * 0.42;
      const innerR = GRID_HEIGHT * 0.33;
      const offsetX = 2;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          const dOuter = dx * dx + dy * dy;
          const dxInner = x - (centerX + offsetX);
          const dInner = dxInner * dxInner + dy * dy;
          if (dOuter <= outerR * outerR && dInner > innerR * innerR) {
            grid[y][x] = 2;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'star-center',
    nameKey: 'flagTemplate.starCenter',
    generate: () => {
      const grid = createGrid(1);
      // 5-pointed star in center (like Vietnam, Morocco)
      const centerX = GRID_WIDTH / 2;
      const centerY = GRID_HEIGHT / 2;
      const outerR = GRID_HEIGHT * 0.4;
      const innerR = outerR * 0.38;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          const angle = Math.atan2(dy, dx) + Math.PI / 2;
          const normAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          const sector = normAngle / (Math.PI * 2 / 5);
          const sectorAngle = (sector % 1) * (Math.PI * 2 / 5);
          const halfSector = Math.PI / 5;
          const ratio = sectorAngle < halfSector
            ? sectorAngle / halfSector
            : (2 * halfSector - sectorAngle) / halfSector;
          const edgeR = innerR + (outerR - innerR) * (1 - ratio);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= edgeR) {
            grid[y][x] = 2;
          }
        }
      }
      return grid;
    },
  },
  {
    id: 'horizontal-stripe-offset',
    nameKey: 'flagTemplate.horizontalStripeOffset',
    generate: () => {
      const grid = createGrid(1);
      // Horizontal stripe offset toward top (like Nauru)
      const stripeY = Math.floor(GRID_HEIGHT * 0.35);
      for (let x = 0; x < GRID_WIDTH; x++) {
        grid[stripeY][x] = 2;
        grid[stripeY + 1][x] = 2;
      }
      return grid;
    },
  },
  {
    id: 'cross-offset',
    nameKey: 'flagTemplate.crossOffset',
    generate: () => {
      const grid = createGrid(1);
      // Cross offset to the left (like Finland, without nordic outline)
      const crossX = Math.round(GRID_WIDTH / 3);
      const centerY = Math.floor(GRID_HEIGHT / 2);
      const thickness = 2;
      // Horizontal
      for (let y = centerY - 1; y <= centerY; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          grid[y][x] = 2;
        }
      }
      // Vertical
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let dx = 0; dx < thickness; dx++) {
          grid[y][crossX + dx] = 2;
        }
      }
      return grid;
    },
  },
];

export default FLAG_TEMPLATES;
