/* aWardrobe screens: the Calendar (FR-78 to FR-85): a month at a time, Monday first, today
   marked, a picture and a count on each day with something worn or planned, the forecast's
   symbol and high on the days that have one; the day sheet to see, add and remove, with the
   note; "This week", seven days each with its forecast and either its plan or an idea to plan
   in one tap, the saved outfits that suit it, "Another idea" or "Choose my own"; and the
   passed-plan question (FR-81). */
import { h, btn, iconBtn, pic, sheet, segmented, clear, toast } from '../components.js';
import { icon } from '../icons.js';
import { fmtLong, fmtLongYear, fmtMonthYear, fmtWeekdayShort, fmtShort, plural, temperature } from '../format.js';
import { parseDay, dayKey, addDays, isGone, CATEGORIES } from '../../domain/model.js';
import { matchesQuery } from '../../domain/search.js';
import { kindIcon, pieceThumb, outfitThumbId, degrees, whenOf, WX_TITLE } from './home.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
let shownMonth = null;
let asking = false;

const monthOf = (key) => key.slice(0, 7);
const firstOf = (ym) => parseDay(ym + '-01');
const shiftMonth = (ym, n) => {
  const d = firstOf(ym);
  d.setMonth(d.getMonth() + n);
  return dayKey(d).slice(0, 7);
};
/* a day's name, with the year when it is not this year */
const dayName = (key, today) => (key.slice(0, 4) === today.slice(0, 4) ? fmtLong(parseDay(key)) : fmtLongYear(parseDay(key)));
const hasEntries = (rec) => !!rec && ((rec.outfits && rec.outfits.length) || (rec.garments && rec.garments.length));
const fail = (e) => toast("That couldn't be saved. " + ((e && e.message) || ''));

/* ---------- the month ---------- */

export const calendar = {
  name: 'calendar',
  render(root, arg, ctx) {
    const { app, router, nav } = ctx;
    const today = app.todayKey();
    const prefs = app.prefs.get();
    /* the route's day is honoured on arrival only; a refresh (every record change) keeps the month shown and leaves closed sheets closed */
    const wanted = nav && (arg === 'today' ? today : arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : null);
    /* arriving (the tab, a link) opens the asked-for day's month, else the current one; only a refresh keeps the month being looked at */
    if (nav) shownMonth = monthOf(wanted || today);
    if (!shownMonth) shownMonth = monthOf(today);
    const draw = () => {
      clear(root);
      const title = h('h1.title#cal-title', fmtMonthYear(firstOf(shownMonth)));
      root.appendChild(
        h(
          'div.page-top',
          title,
          h('div.actions', iconBtn('back', 'Previous month', () => {
            shownMonth = shiftMonth(shownMonth, -1);
            draw();
          }, { id: 'cal-prev' }), btn('Today', () => {
            shownMonth = monthOf(today);
            draw();
          }, { small: true, id: 'cal-today' }), iconBtn('chev', 'Next month', () => {
            shownMonth = shiftMonth(shownMonth, 1);
            draw();
          }, { id: 'cal-next' }))
        )
      );
      root.appendChild(h('div.actions.cal-views', btn('This week', () => router.go('week', null), { small: true, icon: 'calendar', id: 'cal-week' })));
      root.appendChild(h('div.cal-weekdays', { 'aria-hidden': 'true' }, WEEKDAYS.map((w) => h('span', w))));
      const grid = h('div.cal-grid#cal-grid', { role: 'group', 'aria-label': fmtMonthYear(firstOf(shownMonth)) });
      const first = firstOf(shownMonth);
      const lead = (first.getDay() + 6) % 7;
      for (let i = 0; i < lead; i++) grid.appendChild(h('span.cal-blank'));
      const byKey = new Map(app.days.inMonth(shownMonth).map((d) => [d.id, d]));
      for (let d = new Date(first); d.getMonth() === first.getMonth(); d = addDays(d, 1)) {
        const key = dayKey(d);
        const rec = byKey.get(key);
        const count = rec ? (rec.outfits || []).length + (rec.garments || []).length : 0;
        const fc = app.weather.dayForecast(key);
        const cell = h('button.cal-day', { type: 'button', dataset: { day: key }, 'aria-label': fmtLong(d) + (count ? ', ' + plural(count, 'thing') + (rec.planned && !rec.planAsked ? ' planned' : ' worn') : '') + (fc ? ', ' + (WX_TITLE[fc.kind] || 'cloudy').toLowerCase() + ' ' + temperature(fc.high, prefs.tempUnit) : ''), onclick: () => openDaySheet(ctx, key) }, h('span.cal-num', String(d.getDate())));
        if (key === today) cell.classList.add('today');
        if (rec && rec.planned && !rec.planAsked && count) cell.classList.add('planned');
        if (count) {
          cell.classList.add('has');
          const outfit = (rec.outfits || []).map((id) => app.records.get('outfits', id)).find(Boolean);
          const garment = (rec.garments || []).map((id) => app.records.get('garments', id)).find(Boolean);
          const picId = (outfit && outfitThumbId(app, outfit)) || (garment && garment.pictures && garment.pictures.thumb) || null;
          if (picId) cell.appendChild(pic(() => app.pictures.image(picId, 'thumb'), { w: 60, h: 72, alt: '' }));
          if (count > 1) cell.appendChild(h('span.cal-count', String(count)));
        }
        /* the forecast's symbol and high (FR-85) */
        if (fc) cell.appendChild(h('span.cal-wx', { 'aria-hidden': 'true' }, icon(kindIcon({ source: 'forecast', kind: fc.kind })), h('span.cal-high', degrees(fc.high, prefs.tempUnit))));
        grid.appendChild(cell);
      }
      root.appendChild(grid);
      root.appendChild(h('p.fineprint', 'Tap a day to see what you wore, or to plan it. A day ahead is a plan; the app asks later whether you wore it.'));
    };
    draw();
    if (wanted) openDaySheet(ctx, wanted);
  }
};

/* ---------- the day sheet (FR-79), shared by the month and the week ---------- */

export function openDaySheet(ctx, key, onChange) {
  const { app, router } = ctx;
  const today = app.todayKey();
  if (document.getElementById('day-sheet')) return;
  const body = h('div.form');
  const s = sheet({ title: dayName(key, today), body, actions: [btn('Done', () => s.close(), { kind: 'primary', id: 'day-done' })], onClose: () => onChange && onChange() });
  s.el.id = 'day-sheet';
  const fill = () => {
    clear(body);
    const rec = app.days.get(key);
    const items = [];
    for (const id of (rec && rec.outfits) || []) {
      const o = app.records.get('outfits', id);
      items.push(h('div.day-item', { dataset: { kind: 'outfit', id } }, btn((o && o.name) || 'An outfit that is no longer here', () => {
        if (!o) return;
        s.close();
        router.go('outfit', id);
      }, { kind: 'ghost', icon: 'layers' }), iconBtn('x', 'Remove', () => change(() => app.days.remove({ outfitId: id, day: key })), { cls: 'day-remove' })));
    }
    for (const id of (rec && rec.garments) || []) {
      const g = app.records.get('garments', id);
      items.push(h('div.day-item', { dataset: { kind: 'garment', id } }, btn(g ? (g.name || g.type || 'Garment') + (isGone(g) ? ' (gone)' : '') : 'A garment that is no longer here', () => {
        if (!g) return;
        s.close();
        router.go('garment', id);
      }, { kind: 'ghost', icon: 'hanger' }), iconBtn('x', 'Remove', () => change(() => app.days.remove({ garmentId: id, day: key })), { cls: 'day-remove' })));
    }
    if (rec && rec.planned && !rec.planAsked && items.length) body.appendChild(h('p.muted', key > today ? 'Planned.' : 'Planned; the app will ask whether you wore it.'));
    body.appendChild(items.length ? h('div.day-items', items) : h('p.muted', key > today ? 'Nothing planned for this day yet.' : 'Nothing logged for this day.'));
    body.appendChild(h('div.actions', btn('Add an outfit', () => pickOutfit(app, key, fill), { small: true, icon: 'layers', id: 'day-add-outfit' }), btn('Add pieces', () => pickPieces(app, key, fill), { small: true, icon: 'hanger', id: 'day-add-pieces' })));
    const note = h('textarea.input#day-note', { rows: '2', maxlength: '200', placeholder: 'A note: where you went, how it felt', onchange: () => change(() => app.days.setNote(key, note.value), true) });
    note.value = (rec && rec.note) || '';
    body.appendChild(h('label.field', h('span.label', 'Note'), note));
  };
  const change = async (fn, quiet) => {
    try {
      await fn();
      if (!quiet) fill();
    } catch (e) {
      fail(e);
    }
  };
  fill();
  return s;
}

function pickOutfit(app, key, done) {
  const outfits = app.records.list('outfits').slice().sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  const s = sheet({
    title: 'Which outfit?',
    body: outfits.length
      ? h('div.pick-list', outfits.map((o) => h('button.pick-item', { type: 'button', dataset: { id: o.id }, onclick: async () => {
          s.close();
          try {
            await app.days.log({ outfitId: o.id, day: key });
            done();
          } catch (e) {
            fail(e);
          }
        } }, pic(() => app.pictures.image(outfitThumbId(app, o), 'thumb'), { w: 48, h: 64, alt: '' }), h('span.pick-name', o.name || 'Outfit'))))
      : h('p.muted', 'No outfits yet. Build one from the Outfits tab first.'),
    actions: [btn('Cancel', () => s.close(), { kind: 'ghost' })]
  });
}

function pickPieces(app, key, done) {
  const wearable = app.records.list('garments').filter((g) => !isGone(g));
  const rec = app.days.get(key);
  const already = new Set((rec && rec.garments) || []);
  const picked = new Set();
  let query = '';
  let cat = 'all';
  const list = h('div.pick-list');
  const addBtn = btn('Add', async () => {
    s.close();
    try {
      await app.days.logMany({ garmentIds: Array.from(picked), day: key });
      done();
    } catch (e) {
      fail(e);
    }
  }, { kind: 'primary' });
  addBtn.disabled = true;
  const refresh = () => {
    clear(list);
    const shown = wearable.filter((g) => (cat === 'all' || g.category === cat) && (!query || matchesQuery(g, query)));
    if (!shown.length) list.appendChild(h('p.muted', wearable.length ? 'Nothing matches.' : 'Your closet is empty.'));
    for (const g of shown) {
      const item = h('button.pick-item', { type: 'button', dataset: { id: g.id }, 'aria-pressed': String(picked.has(g.id)), disabled: already.has(g.id), onclick: () => {
        if (picked.has(g.id)) picked.delete(g.id);
        else picked.add(g.id);
        item.setAttribute('aria-pressed', String(picked.has(g.id)));
        addBtn.disabled = !picked.size;
        addBtn.lastChild.textContent = picked.size ? 'Add ' + picked.size : 'Add';
      } }, pic(() => app.pictures.image(g.pictures && g.pictures.thumb, 'thumb'), { w: 48, h: 58, alt: '' }), h('span.pick-name', (g.name || g.type || 'Garment') + (already.has(g.id) ? ' (already on this day)' : '')));
      list.appendChild(item);
    }
  };
  const search = h('input.input', { type: 'search', placeholder: 'Search', 'aria-label': 'Search your closet', oninput: () => {
    query = search.value;
    refresh();
  } });
  const cats = CATEGORIES.filter((c) => wearable.some((g) => g.category === c.key));
  const seg = segmented({ name: 'day-pick-category', label: 'Category', value: 'all', options: [{ value: 'all', label: 'All' }].concat(cats.map((c) => ({ value: c.key, label: c.label }))), onChange: (v) => {
    cat = v;
    refresh();
  } });
  const s = sheet({ title: 'Add pieces', wide: true, body: h('div.form', search, seg, list), actions: [btn('Cancel', () => s.close(), { kind: 'ghost' }), addBtn] });
  refresh();
}

/* ---------- This week (FR-84, FR-91, FR-92) ---------- */

/* one day's row: the date (a button that opens the day sheet), the forecast, and either the
   plan (or today's log) or the idea with the suited outfits and the three buttons */
function weekRow(ctx, i) {
  const { app, router } = ctx;
  const today = app.todayKey();
  const prefs = app.prefs.get();
  const d = addDays(parseDay(today), i);
  const key = dayKey(d);
  const rec = app.days.get(key);
  const fc = app.weather.dayForecast(key);
  const row = h('div.week-day', { dataset: { day: key } });
  if (key === today) row.classList.add('today');
  const when = (i === 0 ? 'Today' : fmtWeekdayShort(d)) + ' ' + fmtShort(d);
  row.appendChild(h('button.week-when', { type: 'button', 'aria-label': when + ', choose my own', onclick: () => openDaySheet(ctx, key) }, h('b', i === 0 ? 'Today' : fmtWeekdayShort(d)), h('span', fmtShort(d))));
  if (fc) {
    const kind = WX_TITLE[fc.kind] || 'Cloudy';
    row.appendChild(h('div.week-wx', { role: 'img', 'aria-label': kind + ', high ' + temperature(fc.high, prefs.tempUnit) + ', low ' + temperature(fc.low, prefs.tempUnit) }, icon(kindIcon({ source: 'forecast', kind: fc.kind })), h('span', { 'aria-hidden': 'true' }, h('b.week-high', degrees(fc.high, prefs.tempUnit)), ' ', h('span.week-low', degrees(fc.low, prefs.tempUnit)))));
  } else row.appendChild(h('div.week-wx.none'));
  if (hasEntries(rec)) {
    /* the plan, or what was worn today */
    const pieces = (rec.garments || []).map((id) => app.records.get('garments', id)).filter(Boolean);
    const outfits = (rec.outfits || []).map((id) => app.records.get('outfits', id)).filter(Boolean);
    const planned = rec.planned && !rec.planAsked;
    row.classList.add('planned');
    row.appendChild(
      h(
        'div.week-plan',
        h('div.idea-row', outfits.map((o) => h('span.idea-piece.outfit', { dataset: { id: o.id }, title: o.name || 'Outfit' }, pic(() => app.pictures.image(outfitThumbId(app, o), 'thumb'), { w: 56, h: 67, alt: o.name || 'Outfit' }))), pieces.map((g) => pieceThumb(app, g))),
        h('span.week-state', icon('check'), planned ? 'Planned' : 'Worn', outfits.length ? ': ' + outfits.map((o) => o.name || 'Outfit').join(', ') : '')
      )
    );
    row.appendChild(h('div.week-actions', btn('Change', () => openDaySheet(ctx, key), { small: true, kind: 'ghost' })));
    return row;
  }
  const idea = app.ideas.forDay(key);
  const body = h('div.week-idea');
  if (idea.idea) body.appendChild(h('div.idea-row', idea.idea.pieces.map((g) => pieceThumb(app, g))));
  else body.appendChild(h('p.muted.week-none', 'Nothing in your closet suits this day yet: tag seasons on your garments, or add a few pieces.'));
  body.appendChild(h('span.week-reason', idea.reason));
  /* the saved outfits that suit the day, one tap plans one (FR-91, FR-92) */
  if (idea.outfits.length) {
    body.appendChild(
      h(
        'div.week-outfits',
        h('span.label', 'Outfits that suit:'),
        idea.outfits.slice(0, 3).map((x) =>
          h('button.week-outfit', { type: 'button', dataset: { id: x.outfit.id }, 'aria-label': (i === 0 ? 'Wear ' : 'Plan ') + (x.outfit.name || 'this outfit') + (i === 0 ? ' today' : ' for ' + when), onclick: async () => {
            try {
              await app.days.log({ outfitId: x.outfit.id, day: key });
              toast(i === 0 ? 'Logged for today.' : 'Planned for ' + fmtWeekdayShort(d) + '.');
            } catch (e) {
              fail(e);
            }
          } }, pic(() => app.pictures.image(outfitThumbId(app, x.outfit), 'thumb'), { w: 22, h: 28, alt: '' }), h('span', x.outfit.name || 'Outfit'))
        )
      )
    );
  }
  row.appendChild(body);
  const actions = h('div.week-actions');
  if (idea.idea) {
    actions.appendChild(btn(i === 0 ? 'Wear this' : 'Plan this', async () => {
      try {
        await app.ideas.wear(key, idea.idea);
        toast(i === 0 ? 'Logged for today.' : 'Planned for ' + fmtWeekdayShort(d) + '.');
      } catch (e) {
        fail(e);
      }
    }, { small: true, kind: 'primary' }));
    actions.appendChild(btn('Another idea', () => {
      const r = app.ideas.another(key);
      if (!r.changed) toast("That's the only combination that suits this day.");
      const fresh = weekRow(ctx, i);
      row.replaceWith(fresh);
      const again = fresh.querySelector('.week-another');
      if (again) again.focus({ preventScroll: true });
    }, { small: true, cls: 'week-another' }));
  }
  actions.appendChild(btn('Choose my own', () => openDaySheet(ctx, key), { small: true, kind: 'ghost' }));
  row.appendChild(actions);
  void router;
  return row;
}

export const week = {
  name: 'week',
  render(root, arg, ctx) {
    const { app, router } = ctx;
    const w = app.weather.state();
    const sub = w.place && w.days.length ? 'Ideas for each day, from the forecast for ' + w.place.name : 'Ideas for each day, going by the season';
    root.appendChild(h('div.page-top', h('div', h('h1.title', 'This week'), h('p.sub#week-sub', sub)), btn('Month', () => router.go('calendar', null), { small: true, id: 'week-month' })));
    /* why there is no forecast, when there is none (FR-89) */
    if (!w.place) root.appendChild(h('p.muted.today-note#week-note', 'No town set, so ideas go by the season. ', btn('Set your town', () => router.go('more', 'weather'), { kind: 'ghost', small: true, id: 'week-set-town' })));
    else if (!w.days.length) {
      const why = w.errorKind === 'offline' ? "you're offline" + (w.tooOld ? ' and the last forecast is too old' : '') : w.error ? w.error.replace(/\.$/, '') : w.tooOld ? 'the last forecast is too old' : w.fetching ? 'fetching it now' : 'none has been fetched yet';
      root.appendChild(h('p.muted.today-note#week-note', 'No forecast right now (' + why + '): ideas go by the season.'));
    } else if (w.from === 'earlier' || w.error) root.appendChild(h('p.muted.today-note#week-note', 'Forecast from earlier (' + whenOf(w.at, app) + ')' + (w.errorKind === 'offline' ? ", you're offline." : w.error ? ', the weather service did not answer just now.' : '.')));
    const list = h('div.week-list');
    for (let i = 0; i < 7; i++) list.appendChild(weekRow(ctx, i));
    root.appendChild(list);
    root.appendChild(h('p.fineprint', 'Tap a day to choose your own outfit or pieces instead. A day ahead is a plan; the app asks later whether you wore it.'));
  }
};

/* ---------- the passed-plan question (FR-81) ---------- */

/* The oldest planned day that has gone by and was never asked about. Shown once, whatever the
   answer, so an ignored question counts the plan as worn. */
export async function askPassedPlans(app, router) {
  if (asking || document.getElementById('plan-question') || document.querySelector('.sheet')) return;
  const due = app.days.passedPlans();
  if (!due.length) return;
  const day = due[0];
  asking = true;
  try {
    await app.days.markAsked(day.id);
  } catch (e) {
    asking = false;
    return;
  }
  const today = app.todayKey();
  const names = [];
  for (const id of day.outfits || []) {
    const o = app.records.get('outfits', id);
    if (o) names.push(o.name || 'an outfit');
  }
  for (const id of day.garments || []) {
    const g = app.records.get('garments', id);
    if (g) names.push(g.name || g.type || 'a garment');
  }
  const next = () => setTimeout(() => askPassedPlans(app, router), 200);
  /* closing either sheet without choosing counts the plan as worn, as the sheet says */
  const keep = () => app.days.confirmPlan(day.id).then(next, fail);
  let answered = false;
  const s = sheet({
    title: 'Did you wear this on ' + dayName(day.id, today) + '?',
    body: h('div.form', h('p', 'You had planned ' + (names.length ? names.join(', ') : 'something') + '.'), h('p.muted', 'If you close this without answering, it counts as worn.')),
    actions: [
      btn('No', () => {
        answered = true;
        s.close();
        let answered2 = false;
        const s2 = sheet({
          title: 'What happened on ' + dayName(day.id, today) + '?',
          body: h('div.form', h('p.muted', 'Remove the plan, or say what you wore instead.'), h('p.muted', 'Close this and the plan stays, counted as worn.')),
          actions: [
            btn('Remove', () => {
              answered2 = true;
              s2.close();
              app.days.dropPlan(day.id).then(next, fail);
            }, { id: 'plan-remove' }),
            btn('I wore something else', () => {
              answered2 = true;
              s2.close();
              app.days.dropPlan(day.id).then(() => router.go('calendar', day.id), fail);
            }, { kind: 'primary', id: 'plan-else' })
          ],
          onClose: () => {
            if (!answered2) keep();
          }
        });
      }, { id: 'plan-no' }),
      btn('Yes', () => {
        answered = true;
        s.close();
        keep();
      }, { kind: 'primary', id: 'plan-yes' })
    ],
    onClose: () => {
      asking = false;
      if (!answered) keep();
    }
  });
  s.el.id = 'plan-question';
}
