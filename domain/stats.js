/* aWardrobe domain: the Stats page's numbers (FR-96 to FR-99). Pure maths over the records and
   the wear map from domain/model.js. */
import { CATEGORIES, isGone, priceOf, closetValue, wearsOf, costPerWear, dayDiff } from './model.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const active = (garments) => garments.filter((g) => !isGone(g));
const hasEntries = (d) => (d.outfits && d.outfits.length) || (d.garments && d.garments.length);

/* garments not gone, outfits, the closet's value, and the days logged this month up to today */
export function summary(garments, outfits, days, todayKey) {
  const month = todayKey.slice(0, 7);
  return {
    garments: active(garments).length,
    outfits: (outfits || []).length,
    closetValue: closetValue(garments),
    daysLoggedThisMonth: (days || []).filter((d) => d.id.slice(0, 7) === month && d.id <= todayKey && hasEntries(d)).length,
    monthName: MONTHS[Number(todayKey.slice(5, 7)) - 1]
  };
}

/* the most worn garments, most first, worn at least once */
export function mostWorn(garments, stats, n) {
  return active(garments)
    .map((g) => ({ garment: g, wears: wearsOf(stats, g.id).wears }))
    .filter((x) => x.wears > 0)
    .sort((a, b) => b.wears - a.wears || (a.garment.name || '').localeCompare(b.garment.name || ''))
    .slice(0, n || 5);
}

/* garments not worn in the last `limit` days: never worn first, then the longest ago */
export function notWornIn(garments, stats, todayKey, limit) {
  limit = limit || 90;
  return active(garments)
    .map((g) => ({ garment: g, lastWorn: wearsOf(stats, g.id).lastWorn }))
    .filter((x) => !x.lastWorn || dayDiff(x.lastWorn, todayKey) > limit)
    .sort((a, b) => (a.lastWorn === b.lastWorn ? 0 : !a.lastWorn ? -1 : !b.lastWorn ? 1 : a.lastWorn.localeCompare(b.lastWorn)));
}

/* cost per wear over the priced garments, best value first and the worst last (unworn as one wear) */
export function costPerWearRanking(garments, stats, n) {
  const priced = active(garments)
    .filter((g) => priceOf(g) !== null)
    .map((g) => {
      const w = wearsOf(stats, g.id).wears;
      return { garment: g, wears: w, unworn: w === 0, value: costPerWear(priceOf(g), w) };
    })
    .sort((a, b) => a.value - b.value || (a.garment.name || '').localeCompare(b.garment.name || ''));
  const best = priced.slice(0, n || 3);
  const shown = new Set(best.map((x) => x.garment.id));
  const worst = priced
    .slice()
    .reverse()
    .filter((x) => !shown.has(x.garment.id))
    .slice(0, n || 3);
  return { priced: priced.length, best, worst };
}

/* the closet by category, most first */
export function byCategory(garments) {
  const counts = {};
  for (const g of active(garments)) counts[g.category] = (counts[g.category] || 0) + 1;
  return CATEGORIES.filter((c) => counts[c.key]).map((c) => ({ key: c.key, label: c.label, count: counts[c.key] })).sort((a, b) => b.count - a.count);
}
/* the closet by main colour, most first */
export function byMainColour(garments) {
  const counts = new Map();
  for (const g of active(garments)) {
    const c = g.colours && g.colours[0];
    if (!c) continue;
    const e = counts.get(c.name) || { name: c.name, hex: c.hex, count: 0 };
    e.count++;
    counts.set(c.name, e);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
