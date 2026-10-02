/* aWardrobe app: stored pictures (JPEG colour plus greyscale PNG alpha) turned into drawable
   images, with two small caches so cards and pages redraw without decoding again
   (architecture section 4). */

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

export function createPictures(records) {
  const caches = { thumb: lru(LIMITS.thumb, freeCanvas), full: lru(LIMITS.full, freeCanvas) };
  const pending = new Map();
  return {
    record: (id) => (id ? records.db.get('pictures', id) : Promise.resolve(null)),
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
}
