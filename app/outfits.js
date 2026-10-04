/* aWardrobe app: outfits (FR-63, FR-73, FR-74, FR-77). Saving renders the canvas as a picture
   and writes the outfit and its picture in one transaction; deleting keeps the garments and
   gives the days its pieces one by one. */
import { newRecord, touch, validateOutfit } from '../domain/model.js';
import { ValidationError } from './garments.js';

const round = (v) => Math.round(v * 10000) / 10000;
const clean = (p) => ({ garmentId: p.garmentId, x: round(p.x), y: round(p.y), w: round(p.w), z: p.z | 0, rot: Math.round(p.rot || 0), flip: !!p.flip });

export function createOutfits(app) {
  const r = app.records;
  const api = {
    garmentOf: (id) => r.get('garments', id) || null,
    validate: (form, pieces) => validateOutfit({ name: form.name, pieces }, api.garmentOf),
    /* the outfit and its picture together (FR-74); the old picture goes in the same write */
    async save({ existing, form, pieces }) {
      const problems = api.validate(form, pieces);
      if (problems.length) throw new ValidationError(problems);
      const rendered = await app.pictures.renderOutfit(pieces);
      const picture = newRecord('p', { kind: 'outfit', colour: rendered.colour, alpha: rendered.alpha, width: rendered.width, height: rendered.height, bytes: rendered.colour.size + (rendered.alpha ? rendered.alpha.size : 0) });
      const rec = Object.assign(existing ? Object.assign({}, existing) : newRecord('o', {}), {
        name: String(form.name || '').trim(),
        seasons: (form.seasons || []).slice(),
        occasions: (form.occasions || []).slice(),
        favourite: !!form.favourite,
        pieces: pieces.map(clean),
        picture: picture.id
      });
      touch(rec);
      const oldPicture = existing && existing.picture;
      await r.tx(['outfits', 'pictures'], (ops) => {
        ops.put('pictures', picture);
        if (oldPicture) ops.delete('pictures', oldPicture);
        ops.put('outfits', rec);
      });
      if (oldPicture) app.pictures.forget(oldPicture);
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
        if (o.picture) ops.delete('pictures', o.picture);
        ops.delete('outfits', id);
      });
      if (o.picture) app.pictures.forget(o.picture);
    }
  };
  return api;
}
