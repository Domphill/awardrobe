/* aWardrobe screen: More. Settings, privacy, storage, the error log, delete everything
   (FR-106 to FR-108, FR-111, FR-112, FR-115). Backup and weather cards arrive in later milestones. */
import { h, btn, card, sectionHead, segmented, field, pageHead, confirmSheet, toast } from '../components.js';
import { applyTheme, clearTheme } from '../shell.js';
import { versionNumber } from '../../app/version.js';
import { relativeDay } from '../format.js';
import { todayKey } from '../../domain/model.js';

const mb = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + ' MB' : Math.round(n / 1e3) + ' KB');

export const more = {
  name: 'more',
  render(root, arg, { app, router, shell }) {
    const prefs = app.prefs.get();
    /* a setting that cannot be saved says so and shows the stored value again */
    const save = (patch) =>
      app.prefs.set(patch).catch((e) => {
        toast("That couldn't be saved. " + ((e && e.message) || ''));
        shell.refresh();
      });
    root.appendChild(pageHead('More'));

    const lastBackup = app.records.meta('lastBackup', null);
    root.appendChild(
      card(
        sectionHead('Backup'),
        h('p.muted', 'Everything is on this device only. A backup file holds all your garments, photos, outfits and calendar, and can be restored on another phone or after a reset.'),
        h('p.muted#last-backup', lastBackup ? 'Last backup: ' + relativeDay(lastBackup.slice(0, 10), todayKey()) + '.' : 'No backup yet.'),
        h('p.fineprint', 'Making and restoring backups comes in a later update.')
      )
    );

    const env = app.env;
    const usage = h('p.muted#storage', 'Working out how much space your things use…');
    app.storage.estimate().then((u) => {
      usage.textContent = u && u.quota ? 'aWardrobe is using about ' + mb(u.used) + ' of the ' + mb(u.quota) + ' this browser allows.' : u ? 'aWardrobe is using about ' + mb(u.used) + '.' : "Storage use isn't reported by this browser.";
    });
    root.appendChild(card(sectionHead('Storage'), usage, h('p.fineprint', env.ios && !env.standalone ? 'On an iPhone, Safari can clear a website’s saved data if it isn’t opened for a while. Adding aWardrobe to your Home Screen (Share, then Add to Home Screen) stops that.' : env.standalone ? 'aWardrobe is installed, so the browser keeps its data.' : 'Clearing this browser’s site data would erase your wardrobe. Add it to your home screen and take a backup now and then.')));

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
          ? h('div#errors', h('p.muted', 'The last things that went wrong, newest first. Copy them to me if something keeps happening.'), h('ul.error-list', errors.map((e) => h('li', h('b', e.screen + ': '), e.message, h('span.fineprint', ' (' + relativeDay(e.at.slice(0, 10), todayKey()) + ')')))), btn('Clear this list', async () => {
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
