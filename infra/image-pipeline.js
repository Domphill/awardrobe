/* aWardrobe infra: the parts of the image pipeline that need a canvas or the browser's decoders
   (architecture section 5). Runs in the image worker, and on the main thread where a browser
   cannot do it in a worker. Decoding a photo, encoding JPEGs, the save-time cut-out. */
import { fitSize, resize, resizeWithAlpha } from '../domain/image/raster.js';
import { finalCutout } from '../domain/image/edges.js';
import { encodeGrayPng } from '../domain/image/png.js';

export const WORK_SIDE = 1200;
export const ORIGINAL_SIDE = 2000;
export const THUMB_SIDE = 360;
export const JPEG_CUTOUT = 0.86;
export const JPEG_ORIGINAL = 0.82;
export const JPEG_THUMB = 0.8;
export const HEIC_HINT = 'That photo couldn’t be opened. If it is a HEIC photo, choose JPEG in the camera’s format settings (Formats, Most Compatible), or pick a different photo.';

export class ImageError extends Error {
  constructor(message) {
    super(message || HEIC_HINT);
    this.name = 'ImageError';
  }
}

export const canDecodeHere = () => typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function';

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
export function canvasToBlob(canvas, type, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageError('The picture could not be saved.'))), type, quality));
}
/* a JPEG of RGBA pixels; JPEG has no transparency, so every pixel is made opaque first */
export async function toJpeg(rgba, w, h, quality) {
  const data = new Uint8ClampedArray(rgba);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const c = makeCanvas(w, h);
  c.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0);
  return canvasToBlob(c, 'image/jpeg', quality);
}

/* A photo file to the reduced original (JPEG) and the working copy (pixels), the right way up. */
export async function decodeFile(file, opts) {
  opts = opts || {};
  const workSide = opts.workSide || WORK_SIDE;
  const originalSide = opts.originalSide || ORIGINAL_SIDE;
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    try {
      bmp = await createImageBitmap(file);
    } catch (e2) {
      throw new ImageError();
    }
  }
  let oc = null;
  let wc = null;
  try {
    const [ow, oh] = fitSize(bmp.width, bmp.height, originalSide);
    oc = makeCanvas(ow, oh);
    const octx = oc.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(bmp, 0, 0, ow, oh);
    if (bmp.close) bmp.close();
    bmp = null;
    const original = await canvasToBlob(oc, 'image/jpeg', JPEG_ORIGINAL);
    /* the working copy is scaled down from the reduced original, two gentle steps instead of
       one harsh one, so fine weaves do not alias */
    const [ww, wh] = fitSize(ow, oh, workSide);
    wc = makeCanvas(ww, wh);
    const wctx = wc.getContext('2d', { willReadFrequently: true });
    wctx.imageSmoothingQuality = 'high';
    wctx.drawImage(oc, 0, 0, ww, wh);
    const work = wctx.getImageData(0, 0, ww, wh);
    return { work, original, width: ww, height: wh, originalWidth: ow, originalHeight: oh };
  } finally {
    if (bmp && bmp.close) bmp.close();
    for (const c of [oc, wc]) if (c) {
      c.width = 0;
      c.height = 0;
    }
  }
}

/* The final cut-out as stored: a JPEG for the colour and a greyscale PNG for the alpha. */
export async function encodeCutout(final, quality) {
  const colour = await toJpeg(final.rgba, final.width, final.height, quality || JPEG_CUTOUT);
  const alpha = await encodeGrayPng(final.alpha, final.width, final.height);
  return { colour, alpha, width: final.width, height: final.height, bytes: colour.size + alpha.size };
}
/* the thumbnail's pixels before encoding */
export function thumbnailPixels(final, side) {
  const [tw, th] = fitSize(final.width, final.height, side || THUMB_SIDE);
  if (tw === final.width && th === final.height) return { rgba: final.rgba, alpha: final.alpha, width: tw, height: th };
  const { rgba, alpha } = resizeWithAlpha(final.rgba, final.alpha, final.width, final.height, tw, th);
  return { rgba, alpha, width: tw, height: th };
}
export async function makeThumbnail(final, side) {
  return encodeCutout(thumbnailPixels(final, side), JPEG_THUMB);
}
/* Everything that happens to the pixels at save: edges, trim, encode, thumbnail (FR-29, FR-30). */
export async function finalizeCutout(rgba, mask, w, h, opts) {
  const final = finalCutout(rgba, mask, w, h, opts);
  const cutout = await encodeCutout(final);
  const thumb = await makeThumbnail(final, THUMB_SIDE);
  return { cutout, thumb, box: final.box };
}
/* A whole photo kept as it is (FR-50): opaque colour, no alpha, plus a thumbnail. */
export async function finalizePhoto(rgba, w, h) {
  const colour = await toJpeg(rgba, w, h, JPEG_CUTOUT);
  const [tw, th] = fitSize(w, h, THUMB_SIDE);
  const tcolour = await toJpeg(resize(rgba, w, h, tw, th), tw, th, JPEG_THUMB);
  return { cutout: { colour, alpha: null, width: w, height: h, bytes: colour.size }, thumb: { colour: tcolour, alpha: null, width: tw, height: th, bytes: tcolour.size } };
}
