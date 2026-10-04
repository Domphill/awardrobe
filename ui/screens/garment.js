/* aWardrobe screen: the garment page (FR-10, FR-11, FR-13, FR-17 to FR-19). Wear logging and
   "gone" controls arrive with the calendar milestone; outfits with the outfits milestone. */
import { h, btn, iconBtn, pic, empty, sectionHead, confirmSheet, toast } from '../components.js';
import { wearsOf, costPerWear, parseDay, GONE_REASONS } from '../../domain/model.js';
import { money, relativeDay, fmtShortYear, plural } from '../format.js';

const stat = (value, label, id) => h('div.stat', h('b.stat-value', { id }, value), h('span.stat-label', label));

export const garment = {
  name: 'garment',
  render(root, arg, { app, router }) {
    const g = arg ? app.records.get('garments', arg) : null;
    if (!g) {
      root.appendChild(empty('This garment is no longer here', 'It may have been deleted on this phone or another.', btn('Go to Closet', () => router.go('closet', null, { replace: true }), { kind: 'primary' })));
      return;
    }
    const prefs = app.prefs.get();
    const stats = app.garments.stats();
    const w = wearsOf(stats, g.id);
    const cpw = costPerWear(g.price, w.wears);
    const outfits = app.garments.outfitsOf(g.id);

    root.appendChild(
      h(
        'div.page-top',
        btn('Closet', () => router.back('closet'), { kind: 'ghost', icon: 'back', id: 'garment-back' }),
        h(
          'div.actions',
          iconBtn('star', 'Favourite', async () => {
            try {
              await app.garments.setFavourite(g.id, !g.favourite);
            } catch (e) {
              toast("That couldn't be saved. " + ((e && e.message) || ''));
            }
          }, { id: 'garment-fav', pressed: !!g.favourite }),
          iconBtn('edit', 'Edit', () => router.go('edit', g.id), { id: 'garment-edit' })
        )
      )
    );
    const isCutout = !g.cutout || g.cutout.kind !== 'photo';
    const size = g.cutout && g.cutout.width && g.cutout.height ? { w: g.cutout.width, h: g.cutout.height } : {};
    root.appendChild(h('div.hero' + (isCutout ? '.dots' : ''), pic(() => app.pictures.image(g.pictures && g.pictures.cutout, 'full'), Object.assign({ eager: true, natural: true, alt: g.name || g.type || 'The garment' }, size))));
    if (g.status === 'gone') {
      const reason = GONE_REASONS.find((r) => r.key === (g.gone && g.gone.reason));
      root.appendChild(h('p.warning#garment-gone', 'Marked gone from your closet' + (reason ? ' (' + reason.label.toLowerCase() : '') + (g.gone && g.gone.date ? (reason ? ', ' : ' (') + fmtShortYear(parseDay(g.gone.date)) : '') + (reason || (g.gone && g.gone.date) ? ')' : '') + '. Bringing it back arrives with the calendar update.'));
    }
    root.appendChild(h('h1.title#garment-name', g.name || g.type || 'Untitled'));
    const sub = [g.brand, g.type ? g.type.toLowerCase() : '', g.size ? 'size ' + g.size : ''].filter(Boolean).join(', ');
    if (sub) root.appendChild(h('p.sub#garment-sub', sub));
    if (g.colours && g.colours.length) root.appendChild(h('div.colour-chips', g.colours.map((c) => h('span.colour-chip', h('span.swatch-dot', { style: { background: c.hex } }), h('span.colour-name', c.name)))));
    const tags = (g.seasons || []).concat(g.occasions || []);
    if (tags.length) root.appendChild(h('div.tag-chips', tags.map((t) => h('span.tag', t))));
    root.appendChild(h('div.stat-row', stat(String(w.wears), w.wears === 1 ? 'wear' : 'wears', 'stat-wears'), stat(w.lastWorn ? relativeDay(w.lastWorn, app.todayKey()) : 'Never', 'last worn', 'stat-last'), stat(cpw === null ? 'No price' : money(cpw, prefs.currency), 'per wear', 'stat-cpw')));
    root.appendChild(h('p.fineprint', 'Logging what you wore arrives with the calendar update.'));
    root.appendChild(
      h(
        'section#garment-outfits',
        sectionHead(outfits.length ? 'In ' + plural(outfits.length, 'outfit') : 'Not in any outfit yet'),
        outfits.length ? h('ul.plain-list', outfits.map((o) => h('li', btn(o.name || 'Outfit', () => router.go('outfit', o.id), { kind: 'ghost', icon: 'layers' })))) : null
      )
    );
    const details = [];
    if (g.price !== null && g.price !== undefined) details.push('Paid ' + money(g.price, prefs.currency));
    if (g.bought) details.push((details.length ? 'bought ' : 'Bought ') + fmtShortYear(parseDay(g.bought)));
    if (details.length) root.appendChild(h('p.muted#garment-details', details.join(', ') + '.'));
    if (g.notes) root.appendChild(h('p#garment-notes', g.notes));
    root.appendChild(
      h(
        'div.danger-zone',
        btn('Delete this garment', async () => {
          const ok = await confirmSheet({ title: 'Delete this garment?', body: 'It leaves every outfit and every day it is in, and its pictures are deleted; an outfit with nothing else in it is deleted too. If you no longer own it but want it in your stats, mark it gone instead (coming with the calendar update).', confirm: 'Delete', danger: true });
          if (!ok) return;
          try {
            await app.garments.remove(g.id);
          } catch (e) {
            toast("That couldn't be done. " + ((e && e.message) || ''));
            return;
          }
          toast('Deleted.');
          router.go('closet', null, { replace: true });
        }, { kind: 'ghost danger-text', icon: 'trash', id: 'garment-delete' })
      )
    );
  }
};
