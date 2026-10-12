/**
 * Image -> title screen graphics: scale an image to the room of the logo or of
 * a background part and make the background colour transparent (see
 * src/rom/titleLogo.js and titleBackground.js for the conversion to tiles).
 */
import { TITLE_SCREEN } from '../rom/constants';

export { loadImageFile } from './imageToFlag';

const L = TITLE_SCREEN.LOGO;

/** Size of a `width` x `height` image fitted in maxW x maxH at `scale` (0-1] of the largest fit */
export function fitSize(width, height, maxW, maxH, scale = 1) {
  const fit = Math.min(maxW / width, maxH / height);
  const k = fit * Math.max(0.05, Math.min(1, scale));
  return {
    width: Math.max(1, Math.min(maxW, Math.round(width * k))),
    height: Math.max(1, Math.min(maxH, Math.round(height * k))),
  };
}

/** Size of the image fitted in the logo room */
export const fitLogoSize = (width, height, scale = 1) =>
  fitSize(width, height, L.MAX_WIDTH, L.MAX_HEIGHT, scale);

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
 * Scaled RGBA image.
 * @param {HTMLImageElement|HTMLCanvasElement} img
 * @param {{ width?: number, height?: number, maxWidth?: number, maxHeight?: number,
 *   scale?: number, cover?: boolean, removeBackground?: boolean, tolerance?: number }} [options] -
 *   width/height: exact size (with `cover`, the image fills it and the excess is cut);
 *   otherwise fitted in maxWidth x maxHeight at `scale`. removeBackground: the colour of the
 *   top-left pixel becomes transparent.
 * @returns {{ width: number, height: number, data: Uint8ClampedArray }}
 */
export function prepareImage(
  img,
  {
    width: exactW,
    height: exactH,
    maxWidth = L.MAX_WIDTH,
    maxHeight = L.MAX_HEIGHT,
    scale = 1,
    cover = false,
    removeBackground = false,
    tolerance = 24,
  } = {},
) {
  const { width, height } =
    exactW && exactH
      ? { width: exactW, height: exactH }
      : fitSize(img.width, img.height, maxWidth, maxHeight, scale);
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
  if (cover) {
    // fill the box keeping the aspect ratio, centred
    const k = Math.max(width / img.width, height / img.height);
    const sw = width / k;
    const sh = height / k;
    ctx.drawImage(source, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, width, height);
  } else {
    ctx.drawImage(source, 0, 0, width, height);
  }
  return { width, height, data: ctx.getImageData(0, 0, width, height).data };
}

/** Scaled RGBA image for buildLogo */
export const prepareLogoImage = (img, options = {}) => prepareImage(img, options);
