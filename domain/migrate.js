/* aWardrobe domain: moving data forward (architecture section 9.2; FR-101, FR-102, FR-104,
   FR-105, NFR-29). The old Wardrobe's records become aWardrobe's, with the same ids every time,
   so importing twice doubles nothing; and the data-version chain brings an older record up to
   date on open. Pure: the pictures themselves are converted elsewhere. */
import { CATEGORIES, SEASONS, OCCASIONS, GONE_REASONS, RECORD_VERSION } from './model.js';
import { pictureKind } from './image/mask.js';

export { pictureKind };

export const OLD_APP = 'wardrobe';
export const OLD_FORMAT = 1;
export const CURRENT_VERSION = RECORD_VERSION;
export const NOT_OLD_BACKUP = "That file isn't a backup from the old Wardrobe.";

export class MigrateError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'MigrateError';
    this.kind = kind || 'format';
  }
}

const isObject = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const isBlob = (x) => typeof Blob !== 'undefined' && x instanceof Blob;
const str = (v, max) => (v === null || v === undefined ? '' : String(v)).slice(0, max || 2000);
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const isoOr = (v, fallback) => (typeof v === 'string' && v && !isNaN(Date.parse(v)) ? v : fallback);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORY_KEYS = new Set(CATEGORIES.map((c) => c.key));
const listOf = (v, allowed) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x && (!allowed || allowed.includes(x))) : []);
const priceOf = (p) => {
  if (p === null || p === undefined || p === '') return null;
  const n = typeof p === 'number' ? p : Number(String(p).trim().replace(/^[£€$]/, ''));
  return isFinite(n) && n >= 0 ? n : null;
};

/* ---------- the old backup ---------- */
export const isOldBackup = (d) => isObject(d) && d.app === OLD_APP && d.format === OLD_FORMAT && Array.isArray(d.items);
/* the old file (or the old database's contents) with its lists made safe to walk */
export function validateOldBackup(d) {
  if (!isOldBackup(d)) throw new MigrateError(NOT_OLD_BACKUP);
  const arr = (v) => (Array.isArray(v) ? v.filter(isObject) : []);
  return {
    items: arr(d.items),
    outfits: arr(d.outfits),
    days: arr(d.days),
    prefs: isObject(d.prefs) ? d.prefs : {},
    images: arr(d.images).filter((im) => typeof im.id === 'string' && im.id && (typeof im.data === 'string' || isBlob(im.blob)))
  };
}

export const oldGarmentId = (id) => 'g_' + id;
export const oldOutfitId = (id) => 'o_' + id;
/* both pictures come from the one old image, so both ids come from its id */
export const oldPictureIds = (imageId) => ({ cutout: 'p_' + imageId, thumb: 'p_' + imageId + 't' });

/* an old item to a garment; null when it has no id or no photo (a garment is never saved without
   its pictures, FR-61). The picture's kind, size and shape are filled in once it is converted. */
export function mapOldItem(it, { now }) {
  if (!isObject(it) || !it.id || !it.image) return null;
  const imageId = String(it.image);
  const pics = oldPictureIds(imageId);
  const created = isoOr(it.created, now);
  const garment = {
    id: oldGarmentId(String(it.id)),
    v: CURRENT_VERSION,
    created,
    updated: isoOr(it.updated, created),
    name: str(it.name, 200).trim(),
    category: CATEGORY_KEYS.has(it.category) ? it.category : 'other',
    type: str(it.type, 60).trim(),
    brand: str(it.brand, 60).trim(),
    size: str(it.size, 20).trim(),
    notes: str(it.notes).trim(),
    price: priceOf(it.price),
    bought: typeof it.bought === 'string' && DAY.test(it.bought) ? it.bought : null,
    seasons: listOf(it.seasons, SEASONS),
    occasions: listOf(it.occasions, OCCASIONS),
    colours: (Array.isArray(it.colours) ? it.colours : [])
      .filter((c) => isObject(c) && c.name)
      .slice(0, 3)
      .map((c) => ({ name: String(c.name), hex: typeof c.hex === 'string' && c.hex ? c.hex : '#888888' })),
    favourite: !!it.favourite,
    status: 'active',
    gone: null,
    origin: 'wardrobe-import',
    pictures: { cutout: pics.cutout, thumb: pics.thumb, original: null },
    cutout: { kind: 'cutout', width: 0, height: 0, strength: 50, method: 'wardrobe-1', box: null, work: null },
    shape: null
  };
  return { garment, imageId };
}
/* an old outfit to an outfit: the pieces keep their place, size, layer, angle and mirror (the old
   canvas measured positions as fractions of its width too); its pictures are drawn afresh */
export function mapOldOutfit(o, { now }) {
  if (!isObject(o) || !o.id) return null;
  const pieces = (Array.isArray(o.items) ? o.items : []).filter((p) => isObject(p) && p.id).map((p) => ({ garmentId: oldGarmentId(String(p.id)), x: num(p.x, 0.3), y: num(p.y, 0.1), w: num(p.w, 0.4), z: num(p.z, 0) | 0, rot: Math.round(num(p.rot, 0)), flip: !!p.flip }));
  if (!pieces.length) return null;
  const created = isoOr(o.created, now);
  return { id: oldOutfitId(String(o.id)), v: CURRENT_VERSION, created, updated: isoOr(o.updated, created), name: str(o.name, 200).trim(), seasons: listOf(o.seasons, SEASONS), occasions: listOf(o.occasions, OCCASIONS), favourite: !!o.favourite, pieces, picture: null, thumb: null };
}
/* an old day to a day: `items` become `garments`; a day after today is a plan */
export function mapOldDay(d, todayKey, now) {
  if (!isObject(d)) return null;
  const id = typeof d.id === 'string' && DAY.test(d.id) ? d.id : typeof d.day === 'string' && DAY.test(d.day) ? d.day : null;
  if (!id) return null;
  const outfits = listOf(d.outfits).map(oldOutfitId);
  const garments = listOf(d.items).map(oldGarmentId);
  const note = str(d.note).trim();
  if (!outfits.length && !garments.length && !note) return null;
  return { id, v: CURRENT_VERSION, updated: isoOr(d.updated, now), outfits, garments, note, planned: id > todayKey, planAsked: false };
}
/* the old settings that have a place here, including the town */
export function mapOldPrefs(p) {
  const out = {};
  if (!isObject(p)) return out;
  if (['system', 'light', 'dark'].includes(p.theme)) out.theme = p.theme;
  if (['£', '€', '$'].includes(p.currency)) out.currency = p.currency;
  if (['C', 'F'].includes(p.tempUnit)) out.tempUnit = p.tempUnit;
  const pl = p.place;
  if (isObject(pl) && pl.name && pl.lat !== '' && pl.lon !== '' && isFinite(Number(pl.lat)) && isFinite(Number(pl.lon))) out.place = { name: String(pl.name), region: pl.region ? String(pl.region) : '', latitude: Number(pl.lat), longitude: Number(pl.lon) };
  return out;
}
/* the whole old backup mapped, with what could not be mapped named (FR-104) */
export function mapOldBackup(data, { todayKey, now }) {
  const v = validateOldBackup(data);
  const skipped = [];
  const garments = [];
  for (const it of v.items) {
    const m = mapOldItem(it, { now });
    if (m) garments.push(m);
    else skipped.push(it.id ? 'an item without a photo: ' + (it.name || it.type || it.id) : 'an item without an id');
  }
  const outfits = [];
  for (const o of v.outfits) {
    const m = mapOldOutfit(o, { now });
    if (m) outfits.push(m);
    else skipped.push('an outfit with nothing in it' + (o.name ? ': ' + o.name : ''));
  }
  const days = [];
  for (const d of v.days) {
    const m = mapOldDay(d, todayKey, now);
    if (m) days.push(m);
    else if (d.id || d.day) skipped.push('a day whose date could not be read: ' + (d.id || d.day));
  }
  return { garments, outfits, days, prefs: mapOldPrefs(v.prefs), skipped, images: v.images };
}

/* ---------- the data-version chain (NFR-29) ---------- */
/* one step per version: UPGRADES[store][n] takes a version-n record to n+1 */
const UPGRADES = {
  garments: [
    (g, now) =>
      Object.assign(
        { created: now, updated: now, name: '', category: 'other', type: '', brand: '', size: '', notes: '', price: null, bought: null, seasons: [], occasions: [], colours: [], favourite: false, status: 'active', gone: null, origin: 'app', cutout: null, shape: null },
        g,
        { v: 1, pictures: Object.assign({ cutout: null, thumb: null, original: null }, isObject(g.pictures) ? g.pictures : {}) }
      )
  ],
  outfits: [
    (o, now) =>
      Object.assign({ created: now, updated: now, name: '', seasons: [], occasions: [], favourite: false, picture: null, thumb: null }, o, {
        v: 1,
        pieces: (Array.isArray(o.pieces) ? o.pieces : []).map((p) => Object.assign({ x: 0.3, y: 0.1, w: 0.4, z: 0, rot: 0, flip: false }, p))
      })
  ],
  days: [(d, now) => Object.assign({ updated: now, outfits: [], garments: [], note: '', planned: false, planAsked: false }, d, { v: 1 })]
};
/* the record brought up to the current version; the same object back when it already is (or
   comes from a newer app, which this one cannot take backwards) */
export function upgradeRecord(store, rec, now) {
  const steps = UPGRADES[store];
  if (!steps) throw new MigrateError('There is no upgrade for ' + store + ' records.', 'store');
  let v = typeof rec.v === 'number' ? rec.v : 0;
  if (v >= CURRENT_VERSION) return rec;
  let cur = rec;
  while (v < CURRENT_VERSION) {
    cur = steps[v](cur, now);
    v++;
  }
  return cur;
}
/* ---------- a record from a file made safe (FR-104, NFR-29) ---------- */
const ORIGINS = ['app', 'wardrobe-import'];
const GONE_KEYS = GONE_REASONS.map((g) => g.key);
const text = (v, max) => (typeof v === 'string' ? v.slice(0, max || 2000) : '');
const bool = (v) => !!v;
const idOrNull = (v) => (typeof v === 'string' && v ? v : null);
const number = (v, d) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return isFinite(n) ? n : d;
};
const wrapAngle = (deg) => {
  let a = Math.round(deg) % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
};
/* every field of a restored record checked for its type, wrong ones dropped or coerced, so a
   hand-edited or damaged file can never leave a record the screens choke on; null when the
   record has no usable id */
export function sanitizeRecord(store, rec, now) {
  if (!isObject(rec) || typeof rec.id !== 'string' || !rec.id) return null;
  const base = { id: rec.id, v: CURRENT_VERSION };
  if (store === 'garments') {
    const created = isoOr(rec.created, now);
    const gone = rec.status === 'gone' && isObject(rec.gone) && GONE_KEYS.includes(rec.gone.reason) ? { reason: rec.gone.reason, date: typeof rec.gone.date === 'string' && DAY.test(rec.gone.date) ? rec.gone.date : null } : null;
    const pics = isObject(rec.pictures) ? rec.pictures : {};
    const cut = isObject(rec.cutout) ? { kind: rec.cutout.kind === 'photo' ? 'photo' : 'cutout', width: number(rec.cutout.width, 0), height: number(rec.cutout.height, 0), strength: number(rec.cutout.strength, 50), method: text(rec.cutout.method, 40), box: isObject(rec.cutout.box) ? rec.cutout.box : null, work: isObject(rec.cutout.work) ? rec.cutout.work : null } : null;
    const shape = Array.isArray(rec.shape) && rec.shape.length === 12 && rec.shape.every((x) => typeof x === 'number' && isFinite(x)) ? rec.shape.slice() : null;
    return Object.assign(base, {
      created,
      updated: isoOr(rec.updated, created),
      name: text(rec.name, 200),
      category: CATEGORY_KEYS.has(rec.category) ? rec.category : 'other',
      type: text(rec.type, 60),
      brand: text(rec.brand, 60),
      size: text(rec.size, 20),
      notes: text(rec.notes),
      price: priceOf(rec.price),
      bought: typeof rec.bought === 'string' && DAY.test(rec.bought) ? rec.bought : null,
      seasons: listOf(rec.seasons, SEASONS),
      occasions: listOf(rec.occasions, OCCASIONS),
      colours: (Array.isArray(rec.colours) ? rec.colours : [])
        .filter((c) => isObject(c) && typeof c.name === 'string' && c.name)
        .slice(0, 3)
        .map((c) => ({ name: c.name, hex: typeof c.hex === 'string' && c.hex ? c.hex : '#888888' })),
      favourite: bool(rec.favourite),
      status: gone ? 'gone' : 'active',
      gone,
      origin: ORIGINS.includes(rec.origin) ? rec.origin : 'app',
      pictures: { cutout: idOrNull(pics.cutout), thumb: idOrNull(pics.thumb), original: idOrNull(pics.original) },
      cutout: cut,
      shape
    });
  }
  if (store === 'outfits') {
    const created = isoOr(rec.created, now);
    return Object.assign(base, {
      created,
      updated: isoOr(rec.updated, created),
      name: text(rec.name, 200),
      seasons: listOf(rec.seasons, SEASONS),
      occasions: listOf(rec.occasions, OCCASIONS),
      favourite: bool(rec.favourite),
      pieces: (Array.isArray(rec.pieces) ? rec.pieces : []).filter((p) => isObject(p) && typeof p.garmentId === 'string' && p.garmentId).map((p) => ({ garmentId: p.garmentId, x: number(p.x, 0.3), y: number(p.y, 0.1), w: number(p.w, 0.4), z: number(p.z, 0) | 0, rot: wrapAngle(number(p.rot, 0)), flip: bool(p.flip) })),
      picture: idOrNull(rec.picture),
      thumb: idOrNull(rec.thumb)
    });
  }
  if (store === 'days') {
    if (!DAY.test(rec.id)) return null;
    return Object.assign(base, { updated: isoOr(rec.updated, now), outfits: listOf(rec.outfits), garments: listOf(rec.garments), note: text(rec.note), planned: bool(rec.planned), planAsked: bool(rec.planAsked) });
  }
  throw new MigrateError('There is no cleaning for ' + store + ' records.', 'store');
}

export function upgradeAll({ garments, outfits, days }, now) {
  let changed = 0;
  const run = (store, list) =>
    (list || []).map((rec) => {
      const up = upgradeRecord(store, rec, now);
      if (up !== rec) changed++;
      return up;
    });
  return { garments: run('garments', garments), outfits: run('outfits', outfits), days: run('days', days), changed };
}
