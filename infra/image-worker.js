/* aWardrobe infra: the image worker. Runs the pipeline off the main thread so the screen never
   freezes (NFR-7). Every request has an id; the reply carries the same id. */
import { decodeFile, finalizeCutout, finalizePhoto } from './image-pipeline.js';
import { autoCutout } from '../domain/image/segment.js';
import { extractColours } from '../domain/colour/palette.js';
import { shapeFeatures } from '../domain/image/shape.js';

const handlers = {
  ping: async () => ({ result: { ok: true } }),
  /* never answers: lets the client's time limit be tested */
  hang: () => new Promise(() => {}),
  open: async ({ file, workSide, originalSide }) => {
    const d = await decodeFile(file, { workSide, originalSide });
    return { result: { rgba: d.work.data, width: d.width, height: d.height, original: d.original, originalWidth: d.originalWidth, originalHeight: d.originalHeight, decodedIn: 'worker' }, transfer: [d.work.data.buffer] };
  },
  segment: async ({ rgba, width, height, strength }) => {
    const r = autoCutout(new ImageData(rgba, width, height), { strength });
    return { result: r, transfer: r.mask ? [r.mask.buffer] : [] };
  },
  finalize: async ({ rgba, mask, width, height, opts }) => ({ result: await finalizeCutout(rgba, mask, width, height, opts) }),
  finalizePhoto: async ({ rgba, width, height }) => ({ result: await finalizePhoto(rgba, width, height) }),
  colours: async ({ rgba, alpha, width, height, bg, count }) => ({ result: extractColours(rgba, alpha, width, height, { bg, count }) }),
  shape: async ({ mask, width, height }) => ({ result: shapeFeatures(mask, width, height) })
};

self.onmessage = async (e) => {
  const { id, type, payload } = e.data || {};
  try {
    const handler = handlers[type];
    if (!handler) throw new Error('unknown request ' + type);
    const { result, transfer } = await handler(payload || {});
    self.postMessage({ id, ok: true, result }, transfer || []);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err), kind: (err && err.name) || 'Error' });
  }
};
