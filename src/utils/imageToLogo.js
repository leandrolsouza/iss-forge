/**
 * Image -> title screen logo: scale an image to the logo room and make the
 * background transparent (see src/rom/titleLogo.js for the conversion to
 * sprites, tiles and palettes).
 */
import { TITLE_SCREEN } from '../rom/constants';

export { loadImageFile } from './imageToFlag';

const L = TITLE_SCREEN.LOGO;

/** Size of the image fitted in the logo room at `scale` (0-1] of the largest fit */
export function fitLogoSize(width, height, scale = 1) {
  const fit = Math.min(L.MAX_WIDTH / width, L.MAX_HEIGHT / height);
  const k = fit * Math.max(0.05, Math.min(1, scale));
  return {
    width: Math.max(1, Math.min(L.MAX_WIDTH, Math.round(width * k))),
    height: Math.max(1, Math.min(L.MAX_HEIGHT, Math.round(height * k))),
  };
}

/**
 * Make pixels close to the given colour transparent (the whole image, not only
 * the connected area).
 * @param {Uint8ClampedArray} data - RGBA, changed in place
 */
export function keyOutColor(data, [r, g, b], tolerance = 24) {
  const t2 = tolerance * tolerance * 3;
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - r;
    const dg = data[i + 1] - g;
    const db = data[i + 2] - b;
    if (dr * dr + dg * dg + db * db <= t2) data[i + 3] = 0;
  }
  return data;
}

/**
 * Scaled RGBA image for buildLogo.
 * @param {HTMLImageElement|HTMLCanvasElement} img
 * @param {{ scale?: number, removeBackground?: boolean, tolerance?: number }} [options] -
 *   removeBackground: the colour of the top-left pixel becomes transparent
 * @returns {{ width: number, height: number, data: Uint8ClampedArray }}
 */
export function prepareLogoImage(
  img,
  { scale = 1, removeBackground = false, tolerance = 24 } = {},
) {
  const { width, height } = fitLogoSize(img.width, img.height, scale);
  let source = img;
  if (removeBackground) {
    // key out on the full-size image, so the scaled edges blend into transparency
    source = document.createElement('canvas');
    source.width = img.width;
    source.height = img.height;
    const sctx = source.getContext('2d');
    sctx.drawImage(img, 0, 0);
    const full = sctx.getImageData(0, 0, img.width, img.height);
    keyOutColor(full.data, [full.data[0], full.data[1], full.data[2]], tolerance);
    sctx.putImageData(full, 0, 0);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return { width, height, data: ctx.getImageData(0, 0, width, height).data };
}
