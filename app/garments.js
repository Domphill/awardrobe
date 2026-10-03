/* aWardrobe app: garments. Add, change and delete; the one-transaction save of the record with
   its three pictures (FR-61); favourite, gone and bring back; the type guess with the nearest-
   neighbour vote over your own garments (architecture section 10); the suggested name (FR-58). */
import { newRecord, touch, validateGarment, wearStats, markGone as goneOf, bringBack as backOf } from '../domain/model.js';
import { guessType } from '../domain/image/shape.js';

export class ValidationError extends Error {
  constructor(problems) {
    super(problems.join(' '));
    this.name = 'ValidationError';
    this.problems = problems;
  }
}

/* "Navy jumper": the main colour and the type, the type lower-cased unless it starts with a
   single capital letter on its own, as "T-shirt" does */
export function suggestName(colours, type) {
  const colour = colours && colours.length ? colours[0].name : '';
  const t = (type || '').trim();
  if (!t) return colour;
  const lowered = /^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
  return colour ? colour + ' ' + lowered : t;
}
const parsePrice = (p) => {
  if (p === null || p === undefined || p === '') return null;
  if (typeof p === 'number') return p;
  const s = String(p).trim().replace(/^[£€$]/, '');
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : s;
};
const pictureRecord = (kind, pic) => Object.assign(newRecord('p', { kind }), { colour: pic.colour, alpha: pic.alpha || null, width: pic.width, height: pic.height, bytes: pic.bytes === undefined ? (pic.colour ? pic.colour.size : 0) + (pic.alpha ? pic.alpha.size : 0) : pic.bytes });

export function createGarments(app) {
  const r = app.records;
  const fieldsFrom = (form) => ({
    name: (form.name || '').trim(),
    category: form.category || 'other',
    type: (form.type || '').trim(),
    brand: (form.brand || '').trim(),
    size: (form.size || '').trim(),
    notes: (form.notes || '').trim(),
    price: parsePrice(form.price),
    bought: form.bought || null,
    seasons: (form.seasons || []).slice(),
    occasions: (form.occasions || []).slice(),
    colours: (form.colours || []).slice(0, 3).map((c) => ({ name: c.name, hex: c.hex })),
    favourite: !!form.favourite
  });
  const api = {
    /* wears and last worn per garment, as of today */
    stats: () => wearStats(r.list('days'), r.list('outfits'), app.todayKey()),
    outfitsOf: (id) => r.list('outfits').filter((o) => (o.pieces || []).some((p) => p.garmentId === id)),
    examples: () => r.list('garments').filter((g) => g.shape && g.shape.length === 12 && g.category && g.type).map((g) => ({ shape: g.shape, category: g.category, type: g.type })),
    guess: (features, colours) => (features ? guessType(features, api.examples(), colours) : null),
    suggestName,
    /* the problems with a form, in plain words (FR-60); hasPhoto: a picture exists or is coming */
    validate(form, hasPhoto) {
      const check = Object.assign(fieldsFrom(form), { price: form.price, pictures: hasPhoto ? { cutout: 'coming' } : null });
      return validateGarment(check);
    },
    /* the record and its pictures together, or nothing (FR-61). `result` is the session's
       finalize() output for a new or changed photo; null keeps the pictures as they are. */
    async save({ existing, form, result }) {
      const problems = api.validate(form, !!(result || (existing && existing.pictures && existing.pictures.cutout)));
      if (problems.length) throw new ValidationError(problems);
      const rec = Object.assign(existing ? Object.assign({}, existing) : newRecord('g', { status: 'active', gone: null, origin: 'app', shape: null }), fieldsFrom(form));
      const pics = [];
      const oldIds = [];
      if (result) {
        const cut = pictureRecord('cutout', result.cutout);
        const th = pictureRecord('thumb', result.thumb);
        const orig = result.original && result.original.blob ? pictureRecord('original', { colour: result.original.blob, alpha: null, width: result.original.width, height: result.original.height, bytes: result.original.blob.size }) : null;
        pics.push(cut, th);
        if (orig) pics.push(orig);
        /* a cut-out redone from the stored original keeps that original (FR-31) */
        const keepId = result.original && result.original.keepId ? result.original.keepId : null;
        if (existing && existing.pictures) for (const id of Object.values(existing.pictures)) if (id && id !== keepId) oldIds.push(id);
        rec.pictures = { cutout: cut.id, thumb: th.id, original: orig ? orig.id : keepId };
        rec.cutout = { kind: result.kind, width: result.cutout.width, height: result.cutout.height, strength: result.strength, method: result.method };
        rec.shape = result.shape || null;
      }
      touch(rec);
      const warning = await storageWarning();
      await r.tx(['garments', 'pictures'], (ops) => {
        for (const p of pics) ops.put('pictures', p);
        for (const id of oldIds) ops.delete('pictures', id);
        ops.put('garments', rec);
      });
      for (const id of oldIds) app.pictures.forget(id);
      return { garment: r.get('garments', rec.id), warning };
    },
    async setFavourite(id, on) {
      const g = r.get('garments', id);
      if (!g) return null;
      g.favourite = !!on;
      return r.put('garments', touch(g));
    },
    async markGone(id, reason, date) {
      const g = r.get('garments', id);
      if (!g) return null;
      return r.put('garments', touch(goneOf(g, reason, date)));
    },
    async bringBack(id) {
      const g = r.get('garments', id);
      if (!g) return null;
      return r.put('garments', touch(backOf(g)));
    },
    /* the record, its pictures, and its entries in every outfit and day go together (FR-18) */
    async remove(id) {
      const g = r.get('garments', id);
      if (!g) return;
      const picIds = Object.values(g.pictures || {}).filter(Boolean);
      const outfits = r.list('outfits').filter((o) => (o.pieces || []).some((p) => p.garmentId === id));
      const days = r.list('days').filter((d) => (d.garments || []).includes(id));
      await r.tx(['garments', 'pictures', 'outfits', 'days'], (ops) => {
        ops.delete('garments', id);
        for (const p of picIds) ops.delete('pictures', p);
        for (const o of outfits) {
          o.pieces = o.pieces.filter((p) => p.garmentId !== id);
          ops.put('outfits', touch(o));
        }
        for (const d of days) {
          d.garments = d.garments.filter((x) => x !== id);
          ops.put('days', touch(d));
        }
      });
      for (const p of picIds) app.pictures.forget(p);
    }
  };
  async function storageWarning() {
    try {
      const e = await app.storage.estimate();
      if (e && e.quota && e.used / e.quota > 0.8) return 'Storage is ' + Math.round((100 * e.used) / e.quota) + '% full. Take a backup soon.';
    } catch (x) {
      /* not reported */
    }
    return null;
  }
  return api;
}
