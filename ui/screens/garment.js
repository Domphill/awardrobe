/* aWardrobe screen: the garment page (FR-10 to FR-19): the cut-out, the facts, wears and cost
   per wear, "Wore it today" and "Another day", the outfits it is in, gone and bring back. */
import { h, btn, iconBtn, pic, empty, sectionHead, confirmSheet, sheet, toast } from '../components.js';
import { askGone } from './gone.js';
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
      root.appendChild(h('p.warning#garment-gone', 'Gone from your closet' + (reason ? ' (' + reason.label.toLowerCase() : '') + (g.gone && g.gone.date ? (reason ? ', ' : ' (') + fmtShortYear(parseDay(g.gone.date)) : '') + (reason || (g.gone && g.gone.date) ? ')' : '') + '.'));
    }
    root.appendChild(h('h1.title#garment-name', g.name || g.type || 'Untitled'));
    const sub = [g.brand, g.type ? g.type.toLowerCase() : '', g.size ? 'size ' + g.size : ''].filter(Boolean).join(', ');
    if (sub) root.appendChild(h('p.sub#garment-sub', sub));
    if (g.colours && g.colours.length) root.appendChild(h('div.colour-chips', g.colours.map((c) => h('span.colour-chip', h('span.swatch-dot', { style: { background: c.hex } }), h('span.colour-name', c.name)))));
    const tags = (g.seasons || []).concat(g.occasions || []);
    if (tags.length) root.appendChild(h('div.tag-chips', tags.map((t) => h('span.tag', t))));
    root.appendChild(h('div.stat-row', stat(String(w.wears), w.wears === 1 ? 'wear' : 'wears', 'stat-wears'), stat(w.lastWorn ? relativeDay(w.lastWorn, app.todayKey()) : 'Never', 'last worn', 'stat-last'), stat(cpw === null ? 'No price' : money(cpw, prefs.currency), 'per wear', 'stat-cpw')));
    const fail = (e) => toast("That couldn't be saved. " + ((e && e.message) || ''));
    const log = async (day) => {
      const key = day || app.todayKey();
      try {
        await app.days.log({ garmentId: g.id, day: key });
      } catch (e) {
        fail(e);
        return false;
      }
      toast(key > app.todayKey() ? 'Planned for ' + relativeDay(key, app.todayKey()) + '.' : 'Logged as worn.', { action: { label: 'See day', run: () => router.go('calendar', key) } });
      return true;
    };
    const anotherDay = () => {
      const input = h('input.input', { type: 'date', value: app.todayKey() });
      const problem = h('p.problem', { role: 'alert', hidden: true });
      const s = sheet({
        title: 'Which day?',
        body: h('div.form', h('label.field', h('span.label', 'Day'), input, h('span.hint', 'A day ahead is planned; the app asks later whether you wore it.')), problem),
        actions: [
          btn('Cancel', () => s.close(), { kind: 'ghost' }),
          btn('Log it', async () => {
            if (!input.value) {
              problem.textContent = 'Choose a date first.';
              problem.hidden = false;
              input.focus();
              return;
            }
            if (await log(input.value)) s.close();
          }, { kind: 'primary' })
        ]
      });
    };
    if (g.status === 'gone') {
      root.appendChild(h('div.actions', btn('Bring back', async () => {
        try {
          await app.garments.bringBack(g.id);
          toast('Back in your closet.');
        } catch (e) {
          fail(e);
        }
      }, { kind: 'primary', icon: 'restore', id: 'garment-bring-back' })));
    } else {
      root.appendChild(h('div.actions', btn('Wore it today', () => log(null), { kind: 'primary', icon: 'check', id: 'garment-wear' }), btn('Another day', anotherDay, { icon: 'calendar', id: 'garment-wear-day' })));
    }
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
          const ok = await confirmSheet({ title: 'Delete this garment?', body: 'It leaves every outfit and every day it is in, and its pictures are deleted; an outfit with nothing else in it is deleted too. If you no longer own it but want it in your stats, mark it gone instead.', confirm: 'Delete', danger: true });
          if (!ok) return;
          try {
            await app.garments.remove(g.id);
          } catch (e) {
            toast("That couldn't be done. " + ((e && e.message) || ''));
            return;
          }
          toast('Deleted.');
          router.go('closet', null, { replace: true });
        }, { kind: 'ghost danger-text', icon: 'trash', id: 'garment-delete' }),
        g.status === 'gone' ? null : btn('Gone from closet', () => askGone(app, g), { kind: 'ghost', icon: 'upload', id: 'garment-gone-btn' })
      )
    );
  }
};
