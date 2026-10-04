/* aWardrobe app: stored pictures (JPEG colour plus greyscale PNG alpha) turned into drawable
   images, with two small caches so cards and pages redraw without decoding again
   (architecture section 4). */
import { CANVAS_H } from '../domain/layout.js';
import { pieceBox } from '../domain/image/geometry.js';
import { toJpeg } from '../infra/image-pipeline.js';
import { encodeGrayPng } from '../domain/image/png.js';

const LIMITS = { thumb: 80, full: 4 };

function lru(limit, free) {
  const map = new Map();
  return {
    get(k) {
      if (!map.has(k)) return null;
      const v = map.get(k);
      map.delete(k);
      map.set(k, v);
      return v;
    },
    set(k, v) {
      if (map.has(k)) map.delete(k);
      map.set(k, v);
      while (map.size > limit) {
        const [oldKey, oldValue] = map.entries().next().value;
        map.delete(oldKey);
        free(oldValue);
      }
    },
    delete(k) {
      if (!map.has(k)) return;
      const v = map.get(k);
      map.delete(k);
      free(v);
    },
    clear() {
      for (const v of map.values()) free(v);
      map.clear();
    }
  };
}
const freeCanvas = (c) => {
  if (c && c.width) {
    c.width = 0;
    c.height = 0;
  }
};
const close = (img) => {
  if (img && typeof img.close === 'function') img.close();
};

/* a blob to something drawImage accepts; an img element where createImageBitmap is missing */
export async function decodeBlob(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch (e) {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
const sizeOf = (img) => [img.width || img.naturalWidth, img.height || img.naturalHeight];

/* colour and alpha to one canvas with real transparency */
export async function compositePicture(rec) {
  const colour = await decodeBlob(rec.colour);
  const [w, h] = sizeOf(colour);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: !!rec.alpha });
  ctx.drawImage(colour, 0, 0, w, h);
  close(colour);
  if (rec.alpha) {
    const a = await decodeBlob(rec.alpha);
    const ac = document.createElement('canvas');
    ac.width = w;
    ac.height = h;
    const actx = ac.getContext('2d', { willReadFrequently: true });
    actx.drawImage(a, 0, 0, w, h);
    close(a);
    const img = ctx.getImageData(0, 0, w, h);
    const ad = actx.getImageData(0, 0, w, h).data;
    const d = img.data;
    for (let i = 3, j = 0; i < d.length; i += 4, j += 4) d[i] = ad[j];
    ctx.putImageData(img, 0, 0);
    freeCanvas(ac);
  }
  return c;
}

/* the canvas as a picture (FR-74): every piece drawn with the same numbers the stage uses, on a
   transparent 900 by 1200 canvas, then colour as JPEG and alpha as PNG like a cut-out */
export const OUTFIT_W = 900;
export async function renderOutfitCanvas(pieces, imageOf, garmentOf) {
  const W = OUTFIT_W;
  const H = Math.round(W * CANVAS_H);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const skipped = [];
  const sorted = pieces.slice().sort((a, b) => (a.z || 0) - (b.z || 0));
  for (const p of sorted) {
    const g = garmentOf(p.garmentId);
    let img = null;
    try {
      img = g && g.pictures ? await imageOf(g.pictures.cutout, 'full') : null;
    } catch (e) {
      img = null;
    }
    if (!img) {
      skipped.push(g ? g.name || g.type || p.garmentId : p.garmentId);
      continue;
    }
    const aspect = img.height / img.width;
    const box = pieceBox(p, W, aspect);
    ctx.save();
    ctx.translate(box.cx, box.cy);
    ctx.rotate(((p.rot || 0) * Math.PI) / 180);
    ctx.scale(p.flip ? -1 : 1, 1);
    ctx.drawImage(img, -box.width / 2, -box.height / 2, box.width, box.height);
    ctx.restore();
  }
  return { canvas: c, skipped };
}

export const OUTFIT_THUMB_W = 300;
/* the box round the opaque pixels with a margin, as a new canvas; the whole canvas when empty */
export function trimCanvas(canvas, marginFrac) {
  const W = canvas.width;
  const H = canvas.height;
  const d = canvas.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] < 8) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) {
    x0 = 0;
    y0 = 0;
    x1 = W - 1;
    y1 = H - 1;
  }
  const mx = Math.round((x1 - x0 + 1) * (marginFrac || 0));
  const my = Math.round((y1 - y0 + 1) * (marginFrac || 0));
  x0 = Math.max(0, x0 - mx);
  y0 = Math.max(0, y0 - my);
  x1 = Math.min(W - 1, x1 + mx);
  y1 = Math.min(H - 1, y1 + my);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d', { willReadFrequently: true }).drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
/* a canvas with transparency as colour JPEG plus alpha PNG */
async function encodeLayers(canvas) {
  const W = canvas.width;
  const H = canvas.height;
  const d = canvas.getContext('2d').getImageData(0, 0, W, H).data;
  const alpha = new Uint8Array(W * H);
  const rgba = new Uint8ClampedArray(d.length);
  for (let p = 0, i = 0; p < alpha.length; p++, i += 4) {
    alpha[p] = d[i + 3];
    rgba[i] = d[i];
    rgba[i + 1] = d[i + 1];
    rgba[i + 2] = d[i + 2];
    rgba[i + 3] = 255;
  }
  const colour = await toJpeg(rgba, W, H, 0.86);
  const alphaBlob = await encodeGrayPng(alpha, W, H);
  return { colour, alpha: alphaBlob, width: W, height: H };
}

export function createPictures(records) {
  const caches = { thumb: lru(LIMITS.thumb, freeCanvas), full: lru(LIMITS.full, freeCanvas) };
  const pending = new Map();
  const api = {
    record: (id) => (id ? records.db.get('pictures', id) : Promise.resolve(null)),
    /* the outfit canvas as colour JPEG plus alpha PNG (FR-74); garments whose picture cannot be
       read are left out and named */
    async renderOutfit(pieces) {
      const { canvas, skipped } = await renderOutfitCanvas(pieces, api.image, (id) => records.get('garments', id));
      /* trimmed to the pieces with a 3% margin (architecture 7), then a small thumb for lists */
      const full = trimCanvas(canvas, 0.03);
      freeCanvas(canvas);
      const big = await encodeLayers(full);
      const tw = Math.min(OUTFIT_THUMB_W, full.width);
      const small = document.createElement('canvas');
      small.width = tw;
      small.height = Math.max(1, Math.round((full.height * tw) / full.width));
      const sctx = small.getContext('2d', { willReadFrequently: true });
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(full, 0, 0, small.width, small.height);
      const thumb = await encodeLayers(small);
      freeCanvas(full);
      freeCanvas(small);
      return Object.assign({}, big, { thumb, skipped });
    },
    /* a drawable canvas of a stored picture; `which` is 'thumb' for cards or 'full' for pages */
    image(id, which) {
      which = which === 'full' ? 'full' : 'thumb';
      if (!id) return Promise.resolve(null);
      const hit = caches[which].get(id);
      if (hit) return Promise.resolve(hit);
      const key = which + ':' + id;
      if (pending.has(key)) return pending.get(key);
      const p = (async () => {
        const rec = await records.db.get('pictures', id);
        if (!rec || !rec.colour) return null;
        const c = await compositePicture(rec);
        caches[which].set(id, c);
        return c;
      })();
      pending.set(key, p);
      p.catch(() => {}).then(() => pending.delete(key));
      return p;
    },
    forget(id) {
      caches.thumb.delete(id);
      caches.full.delete(id);
    },
    clear() {
      caches.thumb.clear();
      caches.full.clear();
    }
  };
  return api;
}
