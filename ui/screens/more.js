/* aWardrobe screen: More. Settings, privacy, storage, the error log, delete everything
   (FR-86, FR-106 to FR-108, FR-111, FR-112, FR-115). The backup card is in backup.js. */
import { h, btn, card, sectionHead, segmented, field, pageHead, confirmSheet, toast, clear } from '../components.js';
import { applyTheme, clearTheme } from '../shell.js';
import { versionNumber } from '../../app/version.js';
import { relativeDay, bytesText } from '../format.js';
import { whenOf } from './home.js';
import { todayKey, dayKey } from '../../domain/model.js';
import { backupCard } from './backup.js';


export const more = {
  name: 'more',
  render(root, arg, { app, router, shell, nav }) {
    const prefs = app.prefs.get();
    /* a half-finished change of town is forgotten on arrival; a redraw keeps it */
    if (nav) {
      changingTown = false;
      townQuery = '';
    }
    /* a setting that cannot be saved says so and shows the stored value again */
    const save = (patch) =>
      app.prefs.set(patch).catch((e) => {
        toast("That couldn't be saved. " + ((e && e.message) || ''));
        shell.refresh();
      });
    root.appendChild(pageHead('More'));

    const backup = backupCard({ app, router, shell });
    root.appendChild(backup);
    if (arg === 'backup' && nav) setTimeout(() => backup.scrollIntoView({ block: 'start' }), 60);

    const env = app.env;
    const usage = h('p.muted#storage', 'Working out how much space your things use…');
    const full = h('p.warning#storage-warning', { role: 'alert', hidden: true });
    app.storage.estimate().then((u) => {
      usage.textContent = u && u.quota ? 'aWardrobe is using about ' + bytesText(u.used) + ' of the ' + bytesText(u.quota) + ' this browser allows.' : u ? 'aWardrobe is using about ' + bytesText(u.used) + '.' : "Storage use isn't reported by this browser.";
      /* above 80% the app warns and suggests a backup (NFR-17) */
      if (u && u.quota && u.used / u.quota > 0.8) {
        full.textContent = 'Storage is ' + Math.round((100 * u.used) / u.quota) + '% full. Take a backup and free some space, or new photos may not save.';
        full.hidden = false;
      } else full.remove();
    });
    root.appendChild(card(sectionHead('Storage'), usage, full, h('p.fineprint', env.ios && !env.standalone ? 'On an iPhone, Safari can clear a website’s saved data if it isn’t opened for a while. Adding aWardrobe to your Home Screen (Share, then Add to Home Screen) stops that.' : env.standalone ? 'aWardrobe is installed, so the browser keeps its data.' : 'Clearing this browser’s site data would erase your wardrobe. Add it to your home screen and take a backup now and then.')));

    root.appendChild(weatherCard({ app, router, shell }, arg === 'weather'));

    root.appendChild(
      card(
        sectionHead('Appearance'),
        field('Theme', segmented({ name: 'theme', label: 'Theme', value: prefs.theme, options: [{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], onChange: (v) => {
          applyTheme(v);
          save({ theme: v });
        } })),
        field('Currency', segmented({ name: 'currency', label: 'Currency', value: prefs.currency, options: ['£', '€', '$'].map((c) => ({ value: c, label: c })), onChange: (v) => save({ currency: v }) })),
        field('Temperatures', segmented({ name: 'tempUnit', label: 'Temperature unit', value: prefs.tempUnit, options: [{ value: 'C', label: '°C' }, { value: 'F', label: '°F' }], onChange: (v) => save({ tempUnit: v }) }))
      )
    );

    root.appendChild(
      card(
        sectionHead('New photos'),
        field('Cut out the garment automatically', segmented({ name: 'autoCutout', label: 'Cut out new photos automatically', value: prefs.autoCutout === false ? 'off' : 'on', options: [{ value: 'on', label: 'Yes, cut it out' }, { value: 'off', label: 'No, keep the photo' }], onChange: (v) => save({ autoCutout: v !== 'off' }) }), 'With this off, a new photo is kept as it is. You can still cut it out in the editor by unticking "Keep the whole photo instead".')
      )
    );

    root.appendChild(
      card(
        sectionHead('Privacy'),
        h('p.muted#privacy', 'Everything in aWardrobe stays on this device: your garments, photos, outfits, calendar and settings. Nothing is sent anywhere. The one exception is optional: if you add a town for the weather, that town’s map position is sent to Open-Meteo, a free weather service, to fetch the forecast, and nothing else.'),
        h('p.fineprint#version', 'Version ' + versionNumber() + '.')
      )
    );

    const errors = app.errors.list();
    root.appendChild(
      card(
        sectionHead('Report a problem'),
        errors.length
          ? h('div#errors', h('p.muted', 'The last things that went wrong, newest first. Copy them to me if something keeps happening.'), h('ul.error-list', errors.map((e) => h('li', h('b', e.screen + ': '), e.message, h('span.fineprint', ' (' + relativeDay(dayKey(new Date(e.at)), todayKey()) + ')')))), btn('Clear this list', async () => {
              await app.errors.clear();
              shell.refresh();
            }, { small: true, kind: 'ghost' }))
          : h('p.muted#errors', 'Nothing has gone wrong so far.')
      )
    );

    root.appendChild(
      h(
        'div.danger-zone',
        btn('Delete everything', async () => {
          const ok = await confirmSheet({ title: 'Delete your whole wardrobe?', body: 'Every garment, photo, outfit and calendar day on this device. Take a backup first if there is any doubt.', confirm: 'Delete everything', danger: true, typed: 'DELETE' });
          if (!ok) return;
          try {
            await app.records.wipe();
          } catch (e) {
            toast("That couldn't be done. " + ((e && e.message) || ''));
            return;
          }
          clearTheme();
          shell.onboardedThisSession = true;
          toast('Everything has been deleted.');
          router.go('closet', null, { replace: true });
        }, { kind: 'ghost danger-text', icon: 'trash', id: 'delete-all' })
      )
    );
  }
};

/* ---------- the weather (FR-86 to FR-89, FR-95, FR-112) ---------- */

let changingTown = false;
let townQuery = '';
const position = (p) => Number(p.latitude).toFixed(2) + ', ' + Number(p.longitude).toFixed(2);
const plainError = (e) => {
  const kind = e && e.kind;
  if (kind === 'offline') return "You're offline. Try again when you have a connection.";
  if (kind === 'timeout') return 'The weather service took too long to answer. Try again in a moment.';
  if (kind === 'notAllowed') return 'That address is not allowed.';
  return ((e && e.message) || 'The weather service did not answer.') + ' Try again later.';
};

function weatherCard({ app, shell }, focus) {
  const w = app.weather.state();
  const el = card(sectionHead('Weather'));
  el.id = 'weather-card';
  if (w.place && !changingTown) {
    el.appendChild(h('p#weather-town', 'Weather set to ' + w.place.name + (w.place.region ? ', ' + w.place.region : '') + '.'));
    const status = w.days.length ? 'Forecast from ' + whenOf(w.at, app) + (w.from === 'earlier' || w.error ? ' (from earlier' + (w.errorKind === 'offline' ? ", you're offline" : w.error ? ', the service did not answer just now' : '') + ')' : '') + '.' : w.error ? w.error + ' Ideas go by the season until the next try.' : w.fetching ? 'Fetching the forecast…' : 'No forecast fetched yet.';
    el.appendChild(h('p.muted#weather-status', { role: 'status', 'aria-live': 'polite' }, status));
    el.appendChild(h('p.fineprint#weather-privacy', "Only the town's map position (" + position(w.place) + ') is sent, to Open-Meteo, to fetch the forecast. Nothing else leaves the phone.'));
    el.appendChild(
      h(
        'div.actions',
        btn('Change town', () => {
          changingTown = true;
          shell.refresh();
        }, { small: true, id: 'weather-change' }),
        btn('Stop using the weather', async () => {
          try {
            await app.weather.clearPlace();
            toast('Weather off. Ideas go by the season.');
          } catch (e) {
            toast("That couldn't be saved. " + ((e && e.message) || ''));
          }
        }, { small: true, kind: 'ghost', id: 'weather-stop' })
      )
    );
    return el;
  }
  /* the search */
  const input = h('input.input#town-search', { type: 'search', placeholder: 'Your town', 'aria-label': 'Your town', autocomplete: 'off', autocapitalize: 'words', enterkeyhint: 'search', value: townQuery, oninput: () => (townQuery = input.value) });
  const results = h('div.town-list#town-results');
  const status = h('p.muted#weather-status', { role: 'status', 'aria-live': 'polite', hidden: true });
  const say = (msg, id) => {
    clear(results);
    status.hidden = !msg;
    status.textContent = msg || '';
    status.id = id || 'weather-status';
  };
  let searching = false;
  const search = async () => {
    const q = input.value.trim();
    if (!q || searching) return;
    searching = true;
    say('Searching…');
    try {
      const found = await app.weather.search(q);
      searching = false;
      if (!found.length) {
        say('No town by that name. Try the nearest bigger town, or check the spelling.', 'town-none');
        return;
      }
      say('');
      for (const [i, r] of found.entries()) {
        results.appendChild(h('button.town-item', { type: 'button', dataset: { i: String(i) }, onclick: async () => {
          try {
            changingTown = false;
            townQuery = '';
            await app.weather.setPlace(r);
            toast('Weather set to ' + r.name + '.');
          } catch (e) {
            toast("That couldn't be saved. " + ((e && e.message) || ''));
          }
        } }, h('b', r.name), h('span.muted', r.region ? ' ' + r.region : '')));
      }
    } catch (e) {
      searching = false;
      say(plainError(e));
    }
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      search();
    }
  });
  el.appendChild(h('p.muted', 'Set your town and the forecast shapes the ideas on the Closet and the calendar. Without one, ideas go by the season.'));
  el.appendChild(h('div.search-row', input, btn('Search', search, { kind: 'primary', small: true, id: 'town-go' })));
  el.appendChild(results);
  el.appendChild(status);
  el.appendChild(h('p.fineprint#weather-privacy', 'What you type here is sent to Open-Meteo to find the town. Once a town is chosen, only its map position goes with each forecast request. Nothing else ever leaves the phone.'));
  if (w.place) el.appendChild(h('div.actions', btn('Cancel', () => {
    changingTown = false;
    townQuery = '';
    shell.refresh();
  }, { small: true, kind: 'ghost' })));
  if (focus) setTimeout(() => {
    el.scrollIntoView({ block: 'start' });
    input.focus({ preventScroll: true });
  }, 60);
  return el;
}
