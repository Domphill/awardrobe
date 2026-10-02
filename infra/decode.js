/* aWardrobe infra: decoding a photo on the main thread, for browsers whose workers cannot. An
   <img> element is turned the right way up by every modern browser. */
import { fitSize } from '../domain/image/raster.js';
import { ImageError, WORK_SIDE, ORIGINAL_SIDE, JPEG_ORIGINAL } from './image-pipeline.js';

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const toBlob = (c, type, quality) => new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new ImageError('The picture could not be saved.'))), type, quality));

export async function decodeOnMain(file, opts) {
  opts = opts || {};
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new ImageError());
      im.src = url;
    });
    if (img.decode) await img.decode().catch(() => {});
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new ImageError();
    const [ow, oh] = fitSize(w, h, opts.originalSide || ORIGINAL_SIDE);
    const oc = canvas(ow, oh);
    oc.getContext('2d').drawImage(img, 0, 0, ow, oh);
    const original = await toBlob(oc, 'image/jpeg', JPEG_ORIGINAL);
    const [ww, wh] = fitSize(ow, oh, opts.workSide || WORK_SIDE);
    const wc = canvas(ww, wh);
    const wctx = wc.getContext('2d', { willReadFrequently: true });
    wctx.drawImage(img, 0, 0, ww, wh);
    const work = wctx.getImageData(0, 0, ww, wh);
    return { work, original, width: ww, height: wh, originalWidth: ow, originalHeight: oh, decodedIn: 'main thread' };
  } finally {
    URL.revokeObjectURL(url);
  }
}
