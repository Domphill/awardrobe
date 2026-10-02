/* aWardrobe screen: the Closet (FR-1 to FR-9). Cards with their cut-outs, the count, search,
   category chips with counts, sort, filters, and the gone list. The view (search, chip, sort,
   filters) is kept while you move about the app, so Back brings you to where you were. */
import { h, btn, iconBtn, pageHead, empty, pic, chip, selectEl, field, sheet, patchList, clear } from '../components.js';
import { icon } from '../icons.js';
import { plural, fmtShortYear } from '../format.js';
import { CATEGORIES, SEASONS, OCCASIONS, GONE_REASONS, category, parseDay } from '../../domain/model.js';
import { COLOUR_NAMES } from '../../domain/colour/naming.js';
import { sortGarments, categoryCounts, activeFilterCount, closetList, goneList, matchesQuery, passesFilters, EMPTY_FILTERS, SORTS } from '../../domain/search.js';

const freshView = () => ({ query: '', category: null, sort: 'newest', filters: Object.assign({}, EMPTY_FILTERS) });
let view = freshView();
const EMPTY_TEXT = 'Photograph each piece against a plain background, like a bed sheet or a wall, and aWardrobe cuts it out for you.';

export const closet = {
  name: 'closet',
  render(root, arg, { app, router }) {
    const all = app.records.list('garments');
    const active = closetList(all);
    const gone = goneList(all);
    if (!active.length && !gone.length) view = freshView();
    const goneLink = () => btn('Gone from closet (' + gone.length + ')', () => router.go('closet', 'gone'), { kind: 'ghost', id: 'closet-gone' });
    if (arg === 'gone') return renderGone(root, gone, { app, router });
    if (!active.length) {
      root.appendChild(pageHead('Closet', plural(0, 'piece')));
      root.appendChild(empty('Your closet is empty', EMPTY_TEXT, btn('Add your first garment', () => router.go('edit', 'new'), { kind: 'primary', icon: 'camera', id: 'closet-first' })));
      if (gone.length) root.appendChild(h('div.actions.center', goneLink()));
      return;
    }
    const stats = app.garments.stats();
    const today = app.todayKey();
    const total = active.length;
    const sub = h('p.sub');
    root.appendChild(h('div.page-head', h('div', h('h1.title', 'Closet'), sub)));

    const search = h('input.input#closet-search', { type: 'search', placeholder: 'Search by name, brand or colour', value: view.query, 'aria-label': 'Search your closet', autocomplete: 'off', autocapitalize: 'off' });
    const clearSearch = iconBtn('x', 'Clear search', () => {
      view.query = '';
      search.value = '';
      refresh();
    });
    const chipsRow = h('div.chips', { role: 'group', 'aria-label': 'Category', dataset: { role: 'categories' } });
    const sortSel = selectEl(SORTS.map((s) => ({ value: s.key, label: s.label })), view.sort, (v) => {
      view.sort = v;
      refresh();
    }, { id: 'closet-sort', 'aria-label': 'Sort by' });
    const filtersBtn = btn('Filters', () => openFilters(), { icon: 'settings', id: 'closet-filters' });
    const resetView = () => {
      view = Object.assign(freshView(), { sort: view.sort });
      search.value = '';
      refresh();
    };
    const clearAll = btn('Clear', resetView, { kind: 'ghost', id: 'closet-clear' });
    const grid = h('div.item-grid');
    const nothing = h('div.empty', { hidden: true }, h('h2', 'Nothing matches'), h('p', 'Try fewer words, or clear the search and filters.'), h('div.actions', btn('Clear search and filters', resetView, { kind: 'primary' })));
    root.appendChild(h('div.closet-tools', h('div.search-wrap', icon('search'), search, clearSearch), chipsRow, h('div.sort-row', sortSel, filtersBtn, clearAll)));
    root.appendChild(grid);
    root.appendChild(nothing);
    if (gone.length) root.appendChild(h('div.actions.center', goneLink()));
    search.addEventListener('input', () => {
      view.query = search.value;
      refresh();
    });

    const card = (g) =>
      h(
        'button.card-item',
        { type: 'button', dataset: { id: g.id }, onclick: () => router.go('garment', g.id) },
        pic(() => app.pictures.image(g.pictures && g.pictures.thumb, 'thumb'), { alt: g.name }),
        h('span.card-name', g.name || g.type || 'Untitled'),
        g.favourite ? h('span.fav-mark', { 'aria-hidden': 'true' }, icon('star')) : null
      );
    /* the chips are patched in place, so focus stays on the one that was tapped */
    const makeChip = (item) =>
      chip(item.label, { count: item.count, pressed: item.pressed, data: { category: item.key }, onClick: () => {
        view.category = item.key === 'all' || view.category === item.key ? null : item.key;
        refresh();
      } });
    const updateChip = (el, item) => {
      el.setAttribute('aria-pressed', String(item.pressed));
      const count = el.querySelector('.chip-count');
      if (count) count.textContent = String(item.count);
    };

    function refresh() {
      const base = active.filter((g) => matchesQuery(g, view.query) && passesFilters(g, view.filters, stats, today));
      const counts = categoryCounts(base);
      const chipItems = [{ key: 'all', label: 'All', count: base.length, pressed: !view.category }];
      for (const c of CATEGORIES) if (counts[c.key]) chipItems.push({ key: c.key, label: c.label, count: counts[c.key], pressed: view.category === c.key });
      if (view.category && !counts[view.category]) chipItems.push({ key: view.category, label: category(view.category).label, count: 0, pressed: true });
      patchList(chipsRow, chipItems, (x) => x.key, makeChip, updateChip);
      const shown = sortGarments(view.category ? base.filter((g) => g.category === view.category) : base, view.sort, stats);
      const narrowed = !!view.query.trim() || !!view.category || activeFilterCount(view.filters) > 0;
      sub.textContent = narrowed ? shown.length + ' of ' + total : plural(total, 'piece');
      const n = activeFilterCount(view.filters);
      filtersBtn.lastChild.textContent = n ? 'Filters (' + n + ')' : 'Filters';
      clearAll.hidden = !narrowed;
      clearSearch.hidden = !view.query;
      patchList(grid, shown, (g) => g.id, card);
      grid.hidden = shown.length === 0;
      nothing.hidden = shown.length > 0;
    }
    refresh();

    function openFilters() {
      const f = Object.assign({}, view.filters);
      const single = (name, values, selected, onChange) => {
        const row = h('div.toggle-chips', { role: 'group', 'aria-label': name, dataset: { filter: name } });
        for (const v of values) {
          const b = chip(v, { pressed: selected === v, onClick: () => {
            selected = selected === v ? null : v;
            for (const x of row.children) x.setAttribute('aria-pressed', String(x === b && selected === v));
            onChange(selected);
          } });
          row.appendChild(b);
        }
        return row;
      };
      const check = (id, label, value, onChange) => {
        const input = h('input', { type: 'checkbox', id, checked: value, onchange: () => onChange(input.checked) });
        return h('label.check', input, h('span', label));
      };
      const colourSel = selectEl([{ value: '', label: 'Any colour' }].concat(COLOUR_NAMES.map((n) => ({ value: n, label: n }))), f.colour || '', (v) => (f.colour = v || null), { 'aria-label': 'Main colour' });
      const s = sheet({
        title: 'Filters',
        body: h(
          'div.form',
          field('Main colour', h('div', { dataset: { filter: 'colour' } }, colourSel)),
          field('Season', single('season', SEASONS, f.season, (v) => (f.season = v))),
          field('Occasion', single('occasion', OCCASIONS, f.occasion, (v) => (f.occasion = v))),
          check('filter-favourites', 'Favourites only', f.favourites, (v) => (f.favourites = v)),
          check('filter-notworn90', 'Not worn in the last 90 days', f.notWorn90, (v) => (f.notWorn90 = v)),
          check('filter-neverworn', 'Never worn', f.neverWorn, (v) => (f.neverWorn = v))
        ),
        actions: [
          btn('Clear', () => {
            view.filters = Object.assign({}, EMPTY_FILTERS);
            s.close();
            refresh();
          }, { kind: 'ghost' }),
          btn('Show', () => {
            view.filters = f;
            s.close();
            refresh();
          }, { kind: 'primary' })
        ]
      });
    }
  }
};

const reasonLabel = (gone) => {
  const r = gone && GONE_REASONS.find((x) => x.key === gone.reason);
  return r ? r.label : 'Gone';
};
function renderGone(root, gone, { app, router }) {
  root.appendChild(h('div.page-top', btn('Back to the closet', () => router.back('closet'), { kind: 'ghost', icon: 'back', id: 'closet-back-active' })));
  root.appendChild(pageHead('Gone from closet', plural(gone.length, 'piece')));
  if (!gone.length) {
    root.appendChild(empty('Nothing has gone yet', 'When you sell, donate or lose a garment, mark it gone from its page and it will be listed here.'));
    return;
  }
  root.appendChild(
    h(
      'div.gone-list',
      gone.map((g) =>
        h(
          'button.gone-item',
          { type: 'button', dataset: { id: g.id }, onclick: () => router.go('garment', g.id) },
          pic(() => app.pictures.image(g.pictures && g.pictures.thumb, 'thumb'), { w: 96, h: 112, alt: g.name }),
          h('span.gone-text', h('b', g.name || g.type || 'Untitled'), h('span.muted', reasonLabel(g.gone) + (g.gone && g.gone.date ? ', ' + fmtShortYear(parseDay(g.gone.date)) : ''))),
          icon('chev')
        )
      )
    )
  );
}
