/* aWardrobe app: the editor draft (FR-49). Written at most once every two seconds while editing
   and whenever the screen is left or the app goes to the background; offered when the add screen
   opens again; removed on save or discard. The photo goes in as JPEG and the mask as PNG, so a
   draft stays small. */
import { toJpeg } from '../infra/image-pipeline.js';
import { encodeGrayPng } from '../domain/image/png.js';

export const DRAFT_DELAY = 2000;

export function createDrafts(records) {
  let timer = null;
  let make = null;
  let writing = Promise.resolve();
  const api = {
    get: async () => (await records.db.get('drafts', 'editor')) || null,
    /* `build()` runs when the write happens, so the latest state is what gets kept */
    schedule(build) {
      make = build;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        api.flush().catch(() => {});
      }, DRAFT_DELAY);
    },
    /* writes what is pending now; resolves when the draft is on disk */
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const build = make;
      make = null;
      if (build) {
        writing = writing
          .then(async () => {
            const fields = await build();
            if (!fields) return;
            await records.db.put('drafts', Object.assign({ key: 'editor', at: new Date().toISOString() }, fields));
          })
          .catch(() => {
            /* a draft that cannot be written is not something the user can act on */
          });
      }
      return writing;
    },
    async clear() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      make = null;
      await writing;
      await records.db.delete('drafts', 'editor');
    },
    encodePhoto: (work) => toJpeg(work.data, work.width, work.height, 0.86),
    encodeMask: (mask, w, h) => encodeGrayPng(mask, w, h)
  };
  return api;
}
