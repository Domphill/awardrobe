/* aWardrobe app: the editor drafts (FR-49), one per thing being edited: 'editor' for a new
   garment, 'editor:<id>' for a saved one, so an edit can never overwrite an add in progress.
   A draft is written at most once every two seconds while editing, when the screen is left,
   when the app goes to the background and when a save fails; it is offered when the same screen
   opens again and removed on save or discard. The photo goes in as JPEG and the mask as PNG. */
import { toJpeg } from '../infra/image-pipeline.js';
import { encodeGrayPng } from '../domain/image/png.js';

export const DRAFT_DELAY = 2000;
export const draftKey = (garmentId) => (garmentId ? 'editor:' + garmentId : 'editor');

export function createDrafts(records) {
  const pending = new Map();
  let writing = Promise.resolve();
  let failed = null;
  const api = {
    /* the screen sets this to tell the user when a draft could not be kept (NFR-28) */
    onError: null,
    get: async (key) => (await records.db.get('drafts', key || 'editor')) || null,
    /* `build()` runs when the write happens, so the latest state is what gets kept */
    schedule(build, key) {
      key = key || 'editor';
      const p = pending.get(key) || { timer: null, build: null };
      p.build = build;
      pending.set(key, p);
      if (p.timer) return;
      p.timer = setTimeout(() => {
        p.timer = null;
        api.flush(key).catch(() => {});
      }, DRAFT_DELAY);
    },
    /* writes what is pending now (one key, or all of them); resolves when it is on disk */
    flush(key) {
      const keys = key ? [key] : [...pending.keys()];
      for (const k of keys) {
        const p = pending.get(k);
        if (!p) continue;
        if (p.timer) {
          clearTimeout(p.timer);
          p.timer = null;
        }
        const build = p.build;
        p.build = null;
        pending.delete(k);
        if (!build) continue;
        writing = writing
          .then(async () => {
            const fields = await build();
            if (!fields) return;
            await records.db.put('drafts', Object.assign({ key: k, at: new Date().toISOString() }, fields));
          })
          .catch((e) => {
            failed = e;
            console.error('draft:', e);
            if (api.onError) api.onError(e);
          });
      }
      return writing.then(() => {
        if (failed) {
          const e = failed;
          failed = null;
          throw e;
        }
      });
    },
    async clear(key) {
      key = key || 'editor';
      const p = pending.get(key);
      if (p && p.timer) clearTimeout(p.timer);
      pending.delete(key);
      await writing;
      await records.db.delete('drafts', key);
    },
    encodePhoto: (work) => toJpeg(work.data, work.width, work.height, 0.86),
    encodeMask: (mask, w, h) => encodeGrayPng(mask, w, h)
  };
  return api;
}
