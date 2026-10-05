/* aWardrobe app: days (FR-75, FR-78 to FR-83). Log an outfit or a garment as worn on a day, or
   planned when the day is still ahead; remove a mistake; a note; the wear count of an outfit; and
   the passed-plan question: planned days that have gone by are asked about once (FR-81). */
import { touch, isPlanned, passedPlans } from '../domain/model.js';

export function createDays(app) {
  const r = app.records;
  const blank = (key) => ({ id: key, v: 1, updated: new Date().toISOString(), outfits: [], garments: [], note: '', planned: false, planAsked: false });
  const copy = (key) => {
    const rec = Object.assign({}, api.get(key) || blank(key));
    rec.outfits = (rec.outfits || []).slice();
    rec.garments = (rec.garments || []).slice();
    return rec;
  };
  const write = async (rec) => {
    touch(rec);
    await r.tx(['days'], (ops) => ops.put('days', rec));
    return r.get('days', rec.id);
  };
  const api = {
    get: (key) => r.get('days', key) || null,
    /* adds an outfit (or a garment) to a day; a day ahead of today is a plan (FR-80) */
    async log({ outfitId, garmentId, day }) {
      const key = day || app.todayKey();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || isNaN(new Date(key + 'T12:00:00').getTime())) throw new Error('Choose a date first.');
      const rec = copy(key);
      if (outfitId && !rec.outfits.includes(outfitId)) rec.outfits.push(outfitId);
      if (garmentId && !rec.garments.includes(garmentId)) rec.garments.push(garmentId);
      rec.planned = isPlanned(key, app.todayKey());
      return write(rec);
    },
    /* several at once, one write, so a failure saves none of them (NFR-28) */
    async logMany({ outfitIds, garmentIds, day }) {
      const key = day || app.todayKey();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || isNaN(new Date(key + 'T12:00:00').getTime())) throw new Error('Choose a date first.');
      const rec = copy(key);
      for (const id of outfitIds || []) if (!rec.outfits.includes(id)) rec.outfits.push(id);
      for (const id of garmentIds || []) if (!rec.garments.includes(id)) rec.garments.push(id);
      rec.planned = isPlanned(key, app.todayKey());
      return write(rec);
    },
    /* takes an outfit or a garment off a day (FR-79) */
    async remove({ outfitId, garmentId, day }) {
      const rec = copy(day);
      if (outfitId) rec.outfits = rec.outfits.filter((x) => x !== outfitId);
      if (garmentId) rec.garments = rec.garments.filter((x) => x !== garmentId);
      return write(rec);
    },
    async setNote(day, note) {
      const rec = copy(day);
      rec.note = String(note || '').slice(0, 200);
      return write(rec);
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
    },
    /* the days of a month, keyed, for the grid */
    inMonth(yearMonth) {
      return r.list('days').filter((d) => d.id.slice(0, 7) === yearMonth);
    },
    /* ---------- the passed-plan question (FR-81) ---------- */
    passedPlans: () => passedPlans(r.list('days'), app.todayKey()),
    /* shown once: whatever the answer, the day is not asked about again */
    async markAsked(day) {
      const rec = copy(day);
      rec.planAsked = true;
      return write(rec);
    },
    /* "Yes": the plan was worn */
    async confirmPlan(day) {
      const rec = copy(day);
      rec.planned = false;
      rec.planAsked = true;
      return write(rec);
    },
    /* "No": the plan comes off the day */
    async dropPlan(day) {
      const rec = copy(day);
      rec.outfits = [];
      rec.garments = [];
      rec.planned = false;
      rec.planAsked = true;
      return write(rec);
    }
  };
  return api;
}
