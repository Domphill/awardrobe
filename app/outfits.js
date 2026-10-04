/* aWardrobe app: outfits (FR-63, FR-73, FR-74, FR-77). Saving renders the canvas as a picture
   and writes the outfit and its picture in one transaction; deleting keeps the garments and
   gives the days its pieces one by one. */
import { newRecord, touch, validateOutfit } from '../domain/model.js';
import { ValidationError } from './garments.js';

const round = (v) => Math.round(v * 10000) / 10000;
const clean = (p) => ({ garmentId: p.garmentId, x: round(p.x), y: round(p.y), w: round(p.w), z: p.z | 0, rot: Math.round(p.rot || 0), flip: !!p.flip });

const pictureRecord = (kind, layers) => newRecord('p', { kind, colour: layers.colour, alpha: layers.alpha, width: layers.width, height: layers.height, bytes: layers.colour.size + (layers.alpha ? layers.alpha.size : 0) });

export function createOutfits(app) {
  const r = app.records;
  const api = {
    /* the writes that bring an outfit's picture up to date after its pieces changed, for a
       transaction someone else owns (the garment delete cascade, FR-18) */
    async repaint(outfit) {
      const rendered = await app.pictures.renderOutfit(outfit.pieces);
      const picture = pictureRecord('outfit', rendered);
      const thumb = pictureRecord('thumb', rendered.thumb);
      const old = [outfit.picture, outfit.thumb].filter(Boolean);
      const rec = touch(Object.assign({}, outfit, { picture: picture.id, thumb: thumb.id }));
      return { rec, put: [picture, thumb], deletePictures: old };
    },
    garmentOf: (id) => r.get('garments', id) || null,
    validate: (form, pieces) => validateOutfit({ name: form.name, pieces }, api.garmentOf),
    /* the outfit and its picture together (FR-74); the old picture goes in the same write */
    async save({ existing, form, pieces }) {
      const problems = api.validate(form, pieces);
      if (problems.length) throw new ValidationError(problems);
      const rendered = await app.pictures.renderOutfit(pieces);
      const picture = pictureRecord('outfit', rendered);
      const thumb = pictureRecord('thumb', rendered.thumb);
      const rec = Object.assign(existing ? Object.assign({}, existing) : newRecord('o', {}), {
        name: String(form.name || '').trim(),
        seasons: (form.seasons || []).slice(),
        occasions: (form.occasions || []).slice(),
        favourite: !!form.favourite,
        pieces: pieces.map(clean),
        picture: picture.id,
        thumb: thumb.id
      });
      touch(rec);
      const old = [existing && existing.picture, existing && existing.thumb].filter(Boolean);
      await r.tx(['outfits', 'pictures'], (ops) => {
        ops.put('pictures', picture);
        ops.put('pictures', thumb);
        for (const id of old) ops.delete('pictures', id);
        ops.put('outfits', rec);
      });
      for (const id of old) app.pictures.forget(id);
      return { outfit: r.get('outfits', rec.id), skipped: rendered.skipped };
    },
    async setFavourite(id, on) {
      const o = r.get('outfits', id);
      if (!o) return;
      const rec = touch(Object.assign({}, o, { favourite: !!on }));
      await r.tx(['outfits'], (ops) => ops.put('outfits', rec));
    },
    /* the outfit and its picture go; the garments stay; a day that had the outfit keeps its
       pieces as garments (FR-77) */
    async remove(id) {
      const o = r.get('outfits', id);
      if (!o) return;
      const days = r.list('days').filter((d) => (d.outfits || []).includes(id));
      await r.tx(['outfits', 'pictures', 'days'], (ops) => {
        for (const d of days) {
          const rec = Object.assign({}, d);
          rec.outfits = rec.outfits.filter((x) => x !== id);
          rec.garments = (rec.garments || []).slice();
          for (const p of o.pieces || []) if (r.get('garments', p.garmentId) && !rec.garments.includes(p.garmentId)) rec.garments.push(p.garmentId);
          ops.put('days', touch(rec));
        }
        for (const pid of [o.picture, o.thumb]) if (pid) ops.delete('pictures', pid);
        ops.delete('outfits', id);
      });
      for (const pid of [o.picture, o.thumb]) if (pid) app.pictures.forget(pid);
    }
  };
  return api;
}
