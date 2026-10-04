/* aWardrobe screen: the outfit page (FR-63, FR-73, FR-75 to FR-77): the picture, the pieces,
   wears, logging it as worn, favourite, edit and delete. */
import { h, btn, iconBtn, pic, empty, sectionHead, confirmSheet, sheet, toast, chip } from '../components.js';
import { relativeDay, plural } from '../format.js';

const stat = (value, label, id) => h('div.stat', h('b.stat-value', { id }, value), h('span.stat-label', label));

export const outfit = {
  name: 'outfit',
  render(root, arg, { app, router }) {
    const o = arg ? app.records.get('outfits', arg) : null;
    if (!o) {
      root.appendChild(empty('This outfit is no longer here', 'It may have been deleted on this phone or another.', btn('Go to Outfits', () => router.go('outfits', null, { replace: true }), { kind: 'primary' })));
      return;
    }
    const wears = app.days.outfitWears(o.id);
    const garments = (o.pieces || []).map((p) => app.records.get('garments', p.garmentId)).filter(Boolean);
    root.appendChild(
      h(
        'div.page-top',
        btn('Outfits', () => router.back('outfits'), { kind: 'ghost', icon: 'back', id: 'outfit-back' }),
        h(
          'div.actions',
          iconBtn('star', 'Favourite', async () => {
            try {
              await app.outfits.setFavourite(o.id, !o.favourite);
            } catch (e) {
              toast("That couldn't be saved. " + ((e && e.message) || ''));
            }
          }, { id: 'outfit-fav', pressed: !!o.favourite }),
          iconBtn('edit', 'Edit', () => router.go('build', o.id), { id: 'outfit-edit' })
        )
      )
    );
    root.appendChild(h('div.hero.dots.hero-outfit', pic(() => app.pictures.image(o.picture, 'full'), { eager: true, natural: true, alt: o.name || 'The outfit', w: 600, h: 800 })));
    root.appendChild(h('h1.title#outfit-name', o.name || 'Outfit'));
    const tags = (o.seasons || []).concat(o.occasions || []);
    if (tags.length) root.appendChild(h('div.chips', tags.map((t) => chip(t))));
    root.appendChild(h('div.stats#outfit-stats', stat(wears.wears ? plural(wears.wears, 'wear') : 'Not worn yet', wears.wears ? 'worn' : '', 'stat-outfit-wears'), stat(wears.lastWorn ? relativeDay(wears.lastWorn, app.todayKey()) : 'Never', 'last worn', 'stat-outfit-last')));
    const log = async (day) => {
      try {
        await app.days.log({ outfitId: o.id, day });
        toast(day && day > app.todayKey() ? 'Planned for ' + relativeDay(day, app.todayKey()) + '.' : 'Logged as worn.');
      } catch (e) {
        toast("That couldn't be saved. " + ((e && e.message) || ''));
      }
    };
    const anotherDay = () => {
      const input = h('input.input', { type: 'date', value: app.todayKey() });
      const s = sheet({
        title: 'Which day?',
        body: h('label.field', h('span.label', 'Day'), input, h('span.hint', 'A day ahead is planned; the app asks later whether you wore it.')),
        actions: [
          btn('Cancel', () => s.close(), { kind: 'ghost' }),
          btn('Log it', () => {
            if (!input.value) return;
            s.close();
            log(input.value);
          }, { kind: 'primary' })
        ]
      });
    };
    root.appendChild(h('div.actions', btn('Wore it today', () => log(null), { kind: 'primary', icon: 'check', id: 'outfit-wear' }), btn('Another day', anotherDay, { icon: 'calendar', id: 'outfit-wear-day' })));
    root.appendChild(
      h(
        'section#outfit-pieces',
        sectionHead(plural(garments.length, 'piece')),
        h('ul.plain-list', garments.map((g) => h('li', btn((g.name || g.type || 'Garment') + (g.status === 'gone' ? ' (gone)' : ''), () => router.go('garment', g.id), { kind: 'ghost', icon: 'hanger' }))))
      )
    );
    root.appendChild(
      h(
        'div.danger-zone',
        btn('Delete this outfit', async () => {
          const ok = await confirmSheet({ title: 'Delete this outfit?', body: 'The garments stay in your closet. Days that wore this outfit keep its pieces one by one. Its picture is deleted.', confirm: 'Delete', danger: true });
          if (!ok) return;
          try {
            await app.outfits.remove(o.id);
            toast('Outfit deleted.');
            router.go('outfits', null, { replace: true });
          } catch (e) {
            toast("That couldn't be deleted. " + ((e && e.message) || ''));
          }
        }, { kind: 'danger', icon: 'trash', id: 'outfit-delete' })
      )
    );
  }
};
