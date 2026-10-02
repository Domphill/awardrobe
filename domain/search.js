/* aWardrobe domain: search, filter and sort of garments (FR-1 to FR-8). Pure: lists in, lists
   out; the wear counts come from model.wearStats. */
import { category, wearsOf, dayDiff } from './model.js';

/* lower case with accents stripped, so "cafe" finds "Café" (FR-3) */
export const fold = (s) =>
  String(s === null || s === undefined ? '' : s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const EMPTY_FILTERS = Object.freeze({ colour: null, season: null, occasion: null, favourites: false, notWorn90: false, neverWorn: false });
export const SORTS = [
  { key: 'newest', label: 'Newest first' },
  { key: 'name', label: 'Name' },
  { key: 'mostWorn', label: 'Most worn' },
  { key: 'leastWorn', label: 'Least worn' },
  { key: 'price', label: 'Price, high to low' }
];
export const NOT_WORN_DAYS = 90;

export const isActive = (g) => g.status !== 'gone';
export const closetList = (garments) => garments.filter(isActive);
/* gone garments, most recently gone first, undated ones last (FR-8) */
export function goneList(garments) {
  return garments
    .filter((g) => !isActive(g))
    .sort((a, b) => {
      const da = (a.gone && a.gone.date) || '';
      const db = (b.gone && b.gone.date) || '';
      if (da !== db) return da && db ? (da < db ? 1 : -1) : da ? -1 : 1;
      return byName(a, b);
    });
}

/* everything a word can match: name, brand, type, category, colour names, occasions, notes */
export function searchText(g) {
  const parts = [g.name, g.brand, g.type, category(g.category).label, ...(g.colours || []).map((c) => c.name), ...(g.occasions || []), g.notes];
  return fold(parts.filter(Boolean).join(' '));
}
export function matchesQuery(g, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const t = searchText(g);
  return words.every((w) => t.includes(w));
}

export function activeFilterCount(f) {
  f = f || EMPTY_FILTERS;
  let n = 0;
  for (const k of ['colour', 'season', 'occasion', 'favourites', 'notWorn90', 'neverWorn']) if (f[k]) n++;
  return n;
}
/* the filters combine as AND; the colour filter is on the main colour (FR-56) */
export function passesFilters(g, f, stats, today) {
  if (!f) return true;
  if (f.colour && !(g.colours && g.colours.length && g.colours[0].name === f.colour)) return false;
  if (f.season && !(g.seasons || []).includes(f.season)) return false;
  if (f.occasion && !(g.occasions || []).includes(f.occasion)) return false;
  if (f.favourites && !g.favourite) return false;
  if (f.neverWorn || f.notWorn90) {
    const w = wearsOf(stats, g.id);
    if (f.neverWorn && w.wears > 0) return false;
    if (f.notWorn90 && w.lastWorn && dayDiff(w.lastWorn, today) <= NOT_WORN_DAYS) return false;
  }
  return true;
}
/* view: { query, category, filters } */
export function applyFilters(garments, view, stats, today) {
  view = view || {};
  const f = view.filters || EMPTY_FILTERS;
  return garments.filter((g) => isActive(g) && (!view.category || g.category === view.category) && matchesQuery(g, view.query || '') && passesFilters(g, f, stats, today));
}
/* how many garments each category has, for the chips; categories with none are absent (FR-4) */
export function categoryCounts(garments) {
  const counts = {};
  for (const g of garments) if (isActive(g)) counts[g.category] = (counts[g.category] || 0) + 1;
  return counts;
}

const collator = new Intl.Collator('en-GB', { sensitivity: 'base', numeric: true });
const byName = (a, b) => collator.compare(a.name || '', b.name || '') || collator.compare(a.id || '', b.id || '');
const priceOf = (g) => (g.price === null || g.price === undefined || g.price === '' || isNaN(Number(g.price)) ? null : Number(g.price));
export function sortGarments(list, sort, stats) {
  const w = (g) => wearsOf(stats, g.id).wears;
  const newest = (a, b) => (b.created || '').localeCompare(a.created || '') || byName(a, b);
  const cmp =
    {
      newest,
      name: byName,
      mostWorn: (a, b) => w(b) - w(a) || byName(a, b),
      leastWorn: (a, b) => w(a) - w(b) || byName(a, b),
      price: (a, b) => {
        const pa = priceOf(a);
        const pb = priceOf(b);
        if (pa === null && pb === null) return byName(a, b);
        if (pa === null) return 1;
        if (pb === null) return -1;
        return pb - pa || byName(a, b);
      }
    }[sort] || newest;
  return list.slice().sort(cmp);
}
