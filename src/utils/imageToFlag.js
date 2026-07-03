/**
 * Image-to-Flag conversion utility
 *
 * Loads an image file, resizes it to the flag grid dimensions (24x16),
 * and quantizes colors to match the 4-color flag palette.
 */

const GRID_WIDTH = 24;
const GRID_HEIGHT = 16;

/**
 * Load an image file and return an HTMLImageElement
 * @param {File} file - Image file (PNG, JPG, GIF, etc.)
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Resize an image to 24x16 using canvas and extract pixel data
 * @param {HTMLImageElement} img
 * @returns {ImageData} - Raw pixel data at 24x16
 */
export function resizeImageToGrid(img) {
  const canvas = document.createElement('canvas');
  canvas.width = GRID_WIDTH;
  canvas.height = GRID_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(img, 0, 0, GRID_WIDTH, GRID_HEIGHT);
  return ctx.getImageData(0, 0, GRID_WIDTH, GRID_HEIGHT);
}

/**
 * Calculate Euclidean distance between two RGB colors
 */
function colorDistance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

/**
 * Convert image to flag grid using existing palette colors (nearest color matching).
 * Each pixel is mapped to the closest of the 4 palette colors.
 *
 * @param {ImageData} imageData - 24x16 pixel data from resizeImageToGrid
 * @param {Array<{r:number, g:number, b:number}>} flagColors - The 4 palette colors
 * @returns {number[][]} - 2D grid [row][col] of palette indices (1-4)
 */
export function quantizeWithPalette(imageData, flagColors) {
  const { data } = imageData;
  const grid = [];

  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      const i = (y * GRID_WIDTH + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // If mostly transparent, use palette index 0 (transparent)
      if (a < 128) {
        row.push(0);
        continue;
      }

      // Find nearest palette color
      let bestIdx = 1;
      let bestDist = Infinity;
      for (let p = 0; p < flagColors.length; p++) {
        const fc = flagColors[p];
        if (!fc) continue;
        const dist = colorDistance(r, g, b, fc.r, fc.g, fc.b);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = p + 1; // palette indices are 1-based
        }
      }
      row.push(bestIdx);
    }
    grid.push(row);
  }

  return grid;
}

/**
 * Extract dominant colors from image using simple median cut algorithm.
 * Returns 4 representative colors extracted from the image.
 *
 * @param {ImageData} imageData - 24x16 pixel data
 * @returns {Array<{r:number, g:number, b:number}>} - 4 colors
 */
export function extractPalette(imageData) {
  const { data } = imageData;
  const pixels = [];

  // Collect all non-transparent pixels
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] >= 128) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
  }

  if (pixels.length === 0) {
    return [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 0, b: 255 },
    ];
  }

  // Simple median cut for 4 colors
  const palette = medianCut(pixels, 4);

  // Ensure we always return exactly 4 colors
  while (palette.length < 4) {
    palette.push(palette[palette.length - 1] || [128, 128, 128]);
  }

  return palette.slice(0, 4).map(([r, g, b]) => ({ r, g, b }));
}

/**
 * Median cut algorithm - splits pixel groups into N buckets by largest channel range
 * @param {number[][]} pixels - Array of [r, g, b]
 * @param {number} numColors - Target number of colors
 * @returns {number[][]} - Representative colors
 */
function medianCut(pixels, numColors) {
  if (pixels.length === 0) return [[0, 0, 0]];

  let buckets = [pixels];

  while (buckets.length < numColors) {
    // Find the bucket with the largest range in any channel
    let maxRange = -1;
    let maxBucketIdx = 0;
    let splitChannel = 0;

    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      if (bucket.length < 2) continue;

      for (let ch = 0; ch < 3; ch++) {
        const values = bucket.map((p) => p[ch]);
        const range = Math.max(...values) - Math.min(...values);
        if (range > maxRange) {
          maxRange = range;
          maxBucketIdx = i;
          splitChannel = ch;
        }
      }
    }

    if (maxRange <= 0) break;

    // Sort the bucket by the split channel and divide
    const bucket = buckets[maxBucketIdx];
    bucket.sort((a, b) => a[splitChannel] - b[splitChannel]);
    const mid = Math.floor(bucket.length / 2);
    buckets.splice(maxBucketIdx, 1, bucket.slice(0, mid), bucket.slice(mid));
  }

  // Average each bucket to get representative color
  return buckets.map((bucket) => {
    if (bucket.length === 0) return [128, 128, 128];
    const sum = bucket.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
    return [
      Math.round(sum[0] / bucket.length),
      Math.round(sum[1] / bucket.length),
      Math.round(sum[2] / bucket.length),
    ];
  });
}

/**
 * Full pipeline: load image, resize, and convert to flag grid.
 *
 * @param {File} file - Image file
 * @param {Array<{r:number, g:number, b:number}>} flagColors - Current palette (4 colors)
 * @param {object} options
 * @param {boolean} options.extractColors - If true, extract palette from image instead of using existing
 * @returns {Promise<{grid: number[][], palette?: Array<{r:number,g:number,b:number}>}>}
 */
export async function convertImageToFlag(file, flagColors, options = {}) {
  const img = await loadImageFile(file);
  const imageData = resizeImageToGrid(img);

  if (options.extractColors) {
    const palette = extractPalette(imageData);
    const grid = quantizeWithPalette(imageData, palette);
    return { grid, palette };
  }

  const grid = quantizeWithPalette(imageData, flagColors);
  return { grid };
}
