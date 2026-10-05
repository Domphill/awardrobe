/* aWardrobe screen: Stats (FR-96 to FR-99): the four numbers, most worn, not worn in 90 days,
   cost per wear best and worst, the closet by category and by main colour, the gone group. */
import { h, btn, pic, empty, pageHead, sectionHead } from '../components.js';
import { money, plural, fmtShortYear } from '../format.js';
import { summary, mostWorn, notWornIn, costPerWearRanking, byCategory, byMainColour } from '../../domain/stats.js';
import { goneGroup, parseDay } from '../../domain/model.js';

const stat = (value, label, id, labelId) => h('div.stat', h('b.stat-value', { id }, value), h('span.stat-label', { id: labelId }, label));

export const stats = {
  name: 'stats',
  render(root, arg, { app, router }) {
    const garments = app.records.list('garments');
    const outfits = app.records.list('outfits');
    const days = app.records.list('days');
    const today = app.todayKey();
    root.appendChild(pageHead('Stats', 'What you actually wear'));
    if (!garments.length) {
      root.appendChild(empty('Nothing to count yet', 'Photograph your clothes and log a few days, and this page shows what you really wear.', btn('Add your first garment', () => router.go('edit', 'new'), { kind: 'primary', icon: 'camera' })));
      return;
    }
    const prefs = app.prefs.get();
    const stats = app.garments.stats();
    const sum = summary(garments, outfits, days, today);
    root.appendChild(
      h('div.stats-grid', stat(String(sum.garments), sum.garments === 1 ? 'piece' : 'pieces', 'stat-garments'), stat(String(sum.outfits), sum.outfits === 1 ? 'outfit' : 'outfits', 'stat-outfits'), stat((prefs.currency || '') + Math.round(sum.closetValue).toLocaleString('en-GB'), 'closet value', 'stat-value'), stat(String(sum.daysLoggedThisMonth), 'days logged in ' + sum.monthName, 'stat-days', 'stat-days-label'))
    );
    const thumbOf = (g) => pic(() => app.pictures.image(g.pictures && g.pictures.thumb, 'thumb'), { w: 56, h: 68, alt: g.name || g.type || '' });
    const nameOf = (g) => g.name || g.type || 'Garment';
    /* most worn */
    const top = mostWorn(garments, stats, 5);
    const topMax = top.length ? top[0].wears : 1;
    root.appendChild(
      h(
        'section#stats-most-worn',
        sectionHead('Most worn'),
        top.length
          ? h(
              'div.rank-list',
              top.map((x) =>
                h(
                  'button.rank-item',
                  { type: 'button', dataset: { id: x.garment.id }, onclick: () => router.go('garment', x.garment.id) },
                  thumbOf(x.garment),
                  h('span.rank-body', h('span.rank-name', nameOf(x.garment)), h('span.bar', h('span.bar-fill', { style: { width: Math.round((100 * x.wears) / topMax) + '%' } }))),
                  h('b.rank-count', String(x.wears))
                )
              )
            )
          : h('p.muted', 'Nothing logged yet. Tap "Wore it today" on a garment to start.')
      )
    );
    /* not worn in 90 days */
    const idle = notWornIn(garments, stats, today, 90);
    root.appendChild(
      h(
        'section#stats-idle',
        sectionHead('Not worn in 90 days', idle.length > 5 ? btn('See all', () => router.go('closet', 'notworn'), { kind: 'ghost', small: true, id: 'stats-see-all' }) : null),
        h('p.muted', idle.length ? 'That is ' + plural(idle.length, 'garment') + (idle.length > 5 ? ', the first five here' : '') + '.' : 'Everything has been worn in the last 90 days.'),
        idle.length
          ? h(
              'div.rank-list',
              idle.slice(0, 5).map((x) =>
                h('button.rank-item.idle-item', { type: 'button', dataset: { id: x.garment.id }, onclick: () => router.go('garment', x.garment.id) }, thumbOf(x.garment), h('span.rank-body', h('span.rank-name', nameOf(x.garment))), h('span.muted', x.lastWorn ? 'last ' + fmtShortYear(parseDay(x.lastWorn)) : 'never worn'))
              )
            )
          : null,
        idle.length && idle.length <= 5 ? h('div.actions', btn('See all', () => router.go('closet', 'notworn'), { kind: 'ghost', small: true, id: 'stats-see-all' })) : null
      )
    );
    /* cost per wear */
    const cpw = costPerWearRanking(garments, stats, 3);
    const cpwRow = (x) => h('button.rank-item', { type: 'button', dataset: { id: x.garment.id }, onclick: () => router.go('garment', x.garment.id) }, thumbOf(x.garment), h('span.rank-body', h('span.rank-name', nameOf(x.garment)), x.unworn ? h('span.muted', ' yet to earn its keep') : h('span.muted', ' ' + plural(x.wears, 'wear'))), h('b.rank-count', money(x.value, prefs.currency)));
    root.appendChild(
      h(
        'section#stats-cpw',
        sectionHead('Cost per wear'),
        cpw.priced
          ? [h('p.muted', 'Price divided by wears. Unworn counts as one wear.'), h('h3.sub-head', 'Best value'), h('div.rank-list.cpw-best', cpw.best.map(cpwRow)), h('h3.sub-head', 'Yet to earn their keep'), h('div.rank-list.cpw-worst', cpw.worst.map(cpwRow))]
          : h('p.muted#cpw-none', 'Add a price to a garment (on its edit screen) and this shows what each wear has cost you.')
      )
    );
    /* bars by category and by colour */
    const cats = byCategory(garments);
    const catMax = cats.length ? cats[0].count : 1;
    const cols = byMainColour(garments);
    const colMax = cols.length ? cols[0].count : 1;
    root.appendChild(
      h(
        'section#stats-bars',
        sectionHead('Your closet'),
        h('h3.sub-head', 'By category'),
        h('div.bars#bars-category', cats.map((c) => h('div.bar-row', { dataset: { key: c.key } }, h('span.bar-label', c.label), h('span.bar', h('span.bar-fill', { style: { width: Math.round((100 * c.count) / catMax) + '%' } })), h('span.bar-count', String(c.count))))),
        h('h3.sub-head', 'By main colour'),
        h('div.bars#bars-colour', cols.map((c) => h('div.bar-row', { dataset: { name: c.name } }, h('span.bar-label', h('span.swatch-dot', { style: { background: c.hex } }), c.name), h('span.bar', h('span.bar-fill', { style: { width: Math.round((100 * c.count) / colMax) + '%', background: c.hex } })), h('span.bar-count', String(c.count)))))
      )
    );
    /* the gone group */
    const gone = goneGroup(garments, stats);
    root.appendChild(
      h(
        'section#stats-gone',
        sectionHead('Gone from closet'),
        gone.count
          ? h('p', plural(gone.count, 'garment') + ' gone, which cost ' + money(gone.cost, prefs.currency) + (gone.averageCostPerWear !== null ? ', at ' + money(gone.averageCostPerWear, prefs.currency) + ' a wear on average' : '') + '. Not counted in the closet value above.')
          : h('p.muted', 'Nothing has gone yet.'),
        gone.count ? h('div.actions', btn('See them', () => router.go('closet', 'gone'), { kind: 'ghost', small: true })) : null
      )
    );
  }
};
