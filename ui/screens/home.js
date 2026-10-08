/* aWardrobe screen piece: the Today card at the top of the Closet (FR-89 to FR-94). Today's
   weather or the season with the reason line, the saved outfits that suit it, one combination
   from the closet with "Wear this today", "Another idea" and "Save as outfit", or what has been
   logged for today once something has. The card redraws itself in place, never the Closet. */
import { h, btn, pic, toast } from '../components.js';
import { icon } from '../icons.js';
import { temperature, fmtShort } from '../format.js';

export const KIND_ICON = { clear: 'sun', partly: 'partly', cloudy: 'cloud', fog: 'fog', drizzle: 'rain', rain: 'rain', showers: 'rain', snow: 'snow', thunder: 'storm' };
export const kindIcon = (ctx) => (ctx.source === 'forecast' ? KIND_ICON[ctx.kind] || 'cloud' : ctx.band === 'hot' || ctx.band === 'warm' ? 'sun' : 'calendar');
export const WX_TITLE = { clear: 'Clear', partly: 'Some cloud', cloudy: 'Cloudy', fog: 'Fog', drizzle: 'Drizzle', rain: 'Rain', showers: 'Showers', snow: 'Snow', thunder: 'Thunder' };

const nameOf = (g) => g.name || g.type || 'Garment';
export const degrees = (c, unit) => temperature(c, unit).replace(/°[CF]$/, '°');
/* an outfit's picture, or its first piece's when it has none yet */
export function outfitThumbId(app, o) {
  if (o.thumb || o.picture) return o.thumb || o.picture;
  const g = (o.pieces || []).map((p) => app.records.get('garments', p.garmentId)).find((x) => x && x.pictures && x.pictures.thumb);
  return g ? g.pictures.thumb : null;
}
export const pieceThumb = (app, g, size) => h('span.idea-piece', { dataset: { id: g.id }, title: nameOf(g) }, pic(() => app.pictures.image(g.pictures && g.pictures.thumb, 'thumb'), { w: size || 56, h: Math.round((size || 56) * 1.2), alt: nameOf(g) }));
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
/* when a forecast was fetched, in words: "09:10 today", "yesterday 18:40", "3 Oct 07:30" */
export function whenOf(iso, app) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'earlier';
  const now = app.now();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  return sameDay ? timeFmt.format(d) + ' today' : yesterday ? 'yesterday ' + timeFmt.format(d) : fmtShort(d) + ' ' + timeFmt.format(d);
}

/* the line under the weather: where the forecast came from, or why there is none (FR-89) */
export function sourceNote(app, router, ctx, w, id) {
  const sel = 'p.muted.today-note#' + (id || 'today-note');
  if (!w.place) return h(sel, 'No town set, so ideas go by the season. ', btn('Set your town', () => router.go('more', 'weather'), { kind: 'ghost', small: true, id: (id || 'today') + '-set-town' }));
  if (ctx.source !== 'forecast') {
    const why = w.errorKind === 'offline' ? "you're offline" + (w.tooOld ? ' and the last forecast is too old' : '') : w.error ? w.error.replace(/\.$/, '') : w.tooOld ? 'the last forecast is too old' : w.fetching ? 'fetching it now' : 'none has been fetched yet';
    return h(sel, 'No forecast right now (' + why + '): ideas go by the season.');
  }
  if (w.from === 'earlier' || w.error) return h(sel, 'Forecast from earlier (' + whenOf(w.at, app) + ')' + (w.errorKind === 'offline' ? ", you're offline." : w.error ? ', the weather service did not answer just now.' : '.'));
  return null;
}

export function todayCard(ctx, opts) {
  const { app, router } = ctx;
  opts = opts || {};
  const today = app.todayKey();
  const prefs = app.prefs.get();
  const w = app.weather.state();
  const d = app.ideas.forDay(today);
  const c = d.ctx;
  const card = h('section.today#today-card', { 'aria-label': 'Today', dataset: { compact: opts.compact ? '1' : '0' } });
  const headline = c.source === 'forecast' ? temperature(c.temp, prefs.tempUnit) + (c.low !== null ? ' (low ' + degrees(c.low, prefs.tempUnit) + ')' : '') + (w.place ? ' in ' + w.place.name : '') + ', ' + (WX_TITLE[c.kind] || 'cloudy').toLowerCase() + (c.rain >= 20 ? ', ' + Math.round(c.rain) + '% chance of rain' : '') : c.season + ', going by the season';
  card.appendChild(h('div.today-wx', icon(kindIcon(c)), h('div', h('b#today-weather', headline), h('span#today-reason', d.reason))));
  const note = sourceNote(app, router, c, w);
  if (note) card.appendChild(note);
  if (opts.compact) return card;
  /* the saved outfits that suit today (FR-90) */
  if (d.outfits.length) {
    card.appendChild(
      h(
        'div.today-outfits#today-outfits',
        h('h2.sub-head', 'Outfits that suit today'),
        h('div.outfit-row', d.outfits.map((x) => h('button.outfit-link', { type: 'button', dataset: { id: x.outfit.id }, onclick: () => router.go('outfit', x.outfit.id) }, pic(() => app.pictures.image(outfitThumbId(app, x.outfit), 'thumb'), { w: 54, h: 72, alt: '' }), h('span.outfit-link-name', x.outfit.name || 'Outfit'))))
      )
    );
  }
  const rec = app.days.get(today);
  const logged = rec && ((rec.outfits && rec.outfits.length) || (rec.garments && rec.garments.length));
  if (logged) {
    /* today is logged: show it rather than another idea */
    const pieces = (rec.garments || []).map((id) => app.records.get('garments', id)).filter(Boolean);
    const outfits = (rec.outfits || []).map((id) => app.records.get('outfits', id)).filter(Boolean);
    card.appendChild(
      h(
        'div.today-logged#today-logged',
        h('h2.sub-head', 'Logged for today'),
        h('div.idea-row', outfits.map((o) => h('button.outfit-link', { type: 'button', dataset: { id: o.id }, onclick: () => router.go('outfit', o.id) }, pic(() => app.pictures.image(outfitThumbId(app, o), 'thumb'), { w: 54, h: 72, alt: '' }), h('span.outfit-link-name', o.name || 'Outfit'))), pieces.map((g) => pieceThumb(app, g))),
        h('div.actions', btn('See day', () => router.go('calendar', today), { small: true, icon: 'calendar', id: 'today-see-day' }))
      )
    );
    return card;
  }
  if (!d.idea) {
    card.appendChild(h('p.muted#today-none', "Nothing in your closet suits today's weather yet. Tag seasons on your garments, or add a few pieces, and an idea appears here."));
    return card;
  }
  const idea = d.idea;
  card.appendChild(h('div.idea-row#today-idea', idea.pieces.map((g) => pieceThumb(app, g))));
  card.appendChild(h('p.fineprint', idea.pieces.map(nameOf).join(', ') + (idea.layered ? ', layered' : '') + '.'));
  const fail = (e) => toast("That couldn't be saved. " + ((e && e.message) || ''));
  card.appendChild(
    h(
      'div.actions',
      btn('Wear this today', async () => {
        try {
          await app.ideas.wear(today, idea);
          toast('Logged for today.', { action: { label: 'See day', run: () => router.go('calendar', today) } });
        } catch (e) {
          fail(e);
        }
      }, { kind: 'primary', icon: 'check', id: 'today-wear' }),
      btn('Another idea', () => {
        const r = app.ideas.another(today);
        if (!r.changed) toast("That's the only combination that suits today.");
        const fresh = refreshTodayCard(ctx);
        const again = fresh && fresh.querySelector('#today-another');
        if (again) again.focus({ preventScroll: true });
      }, { icon: 'shuffle', id: 'today-another' }),
      btn('Save as outfit', () => {
        app.ideas.saveAsOutfit(idea);
        router.go('build', 'new');
      }, { icon: 'layers', id: 'today-save' })
    )
  );
  return card;
}

/* redraws the card where it stands, leaving the rest of the Closet (its search, its focus) alone */
export function refreshTodayCard(ctx) {
  const old = document.getElementById('today-card');
  if (!old) return null;
  const fresh = todayCard(ctx, { compact: old.dataset.compact === '1' });
  old.replaceWith(fresh);
  return fresh;
}
