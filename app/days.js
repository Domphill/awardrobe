/* aWardrobe app: days (FR-75, FR-80). Enough for this milestone: log an outfit or a garment as
   worn on a day, or planned when the day is still ahead; the calendar screen comes with M6. */
import { touch } from '../domain/model.js';

export function createDays(app) {
  const r = app.records;
  const blank = (key) => ({ id: key, v: 1, updated: new Date().toISOString(), outfits: [], garments: [], note: '', planned: false, planAsked: false });
  const api = {
    get: (key) => r.get('days', key) || null,
    /* adds an outfit (or a garment) to a day; a day ahead of today is a plan (FR-80) */
    async log({ outfitId, garmentId, day }) {
      const key = day || app.todayKey();
      const rec = Object.assign({}, api.get(key) || blank(key));
      rec.outfits = (rec.outfits || []).slice();
      rec.garments = (rec.garments || []).slice();
      if (outfitId && !rec.outfits.includes(outfitId)) rec.outfits.push(outfitId);
      if (garmentId && !rec.garments.includes(garmentId)) rec.garments.push(garmentId);
      rec.planned = key > app.todayKey();
      touch(rec);
      await r.tx(['days'], (ops) => ops.put('days', rec));
      return r.get('days', key);
    },
    /* how many days up to today have the outfit, and the latest of them (FR-76) */
    outfitWears(outfitId) {
      const today = app.todayKey();
      let wears = 0;
      let lastWorn = null;
      for (const d of r.list('days')) {
        if (d.id > today || !(d.outfits || []).includes(outfitId)) continue;
        wears++;
        if (!lastWorn || d.id > lastWorn) lastWorn = d.id;
      }
      return { wears, lastWorn };
    }
  };
  return api;
}
