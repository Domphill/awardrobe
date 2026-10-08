/* aWardrobe app: ideas (FR-89 to FR-94). Builds a day's context from the forecast or the season,
   asks domain/suggest for the suited outfits and one composed idea, keeps "Another idea" seeds
   per day for the session, and wears or plans an idea through the days module. */
import { contextFor, suitedOutfits, compose, reasonLine, daySeed } from '../domain/suggest.js';

const MAX_TRIES = 12;

export function createIdeas(app) {
  const seeds = new Map();
  /* when each garment and each outfit was last worn or planned, up to and including a day:
     a plan for Monday keeps Monday's pieces out of Tuesday's idea */
  const lastWornMap = (upTo) => {
    const last = new Map();
    const outfits = new Map(app.records.list('outfits').map((o) => [o.id, o]));
    const note = (id, day) => {
      if (!last.has(id) || last.get(id) < day) last.set(id, day);
    };
    for (const d of app.records.list('days')) {
      if (d.id > upTo) continue;
      for (const id of d.garments || []) note(id, d.id);
      for (const oid of d.outfits || []) {
        note(oid, d.id);
        const o = outfits.get(oid);
        for (const p of (o && o.pieces) || []) note(p.garmentId, d.id);
      }
    }
    return last;
  };
  const api = {
    context(dayKey) {
      const place = app.prefs.get().place;
      return contextFor({ dayKey, forecast: app.weather.dayForecast(dayKey), southern: !!(place && Number(place.latitude) < 0) });
    },
    /* the day's context, reason, suited outfits and one idea; the same until "another" */
    forDay(dayKey) {
      const ctx = api.context(dayKey);
      const last = lastWornMap(dayKey);
      const info = { today: dayKey, lastWornOf: (id) => last.get(id) || null };
      const garments = app.records.list('garments');
      const outfits = app.records.list('outfits');
      const seed = (daySeed(dayKey) + (seeds.get(dayKey) || 0)) >>> 0;
      return { dayKey, ctx, reason: reasonLine(ctx, app.prefs.get().tempUnit), outfits: suitedOutfits(outfits, garments, ctx, info, 4), idea: compose(garments, ctx, Object.assign({ seed }, info)), seed };
    },
    /* the next seed that gives a different combination, when the closet allows (FR-92) */
    another(dayKey) {
      const key = (x) => (x.idea ? x.idea.pieces.map((p) => p.id).sort().join() : '');
      const before = key(api.forDay(dayKey));
      const n0 = seeds.get(dayKey) || 0;
      let n = n0;
      let changed = false;
      for (let i = 0; i < MAX_TRIES && !changed; i++) {
        n++;
        seeds.set(dayKey, n);
        changed = key(api.forDay(dayKey)) !== before;
      }
      if (!changed) seeds.set(dayKey, n0);
      const after = api.forDay(dayKey);
      after.changed = changed;
      return after;
    },
    /* one tap: today it is worn, a day ahead it is planned (FR-92) */
    wear: (dayKey, idea) => app.days.logMany({ garmentIds: idea.pieces.map((p) => p.id), day: dayKey }),
    /* hands the idea to the builder, which opens with the pieces placed (FR-92) */
    saveAsOutfit(idea) {
      app.builderSeed = { garmentIds: idea.pieces.map((p) => p.id) };
    },
    reset: () => seeds.clear()
  };
  return api;
}
