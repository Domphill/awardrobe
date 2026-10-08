/* aWardrobe screen parts: the backup card on More, the old-Wardrobe offer on the home, and the
   restore and copy flows they share (FR-100 to FR-106). */
import { h, btn, card, sectionHead, sheet, confirmSheet, busy, toast } from '../components.js';
import { relativeDay, plural, bytesText } from '../format.js';
import { applyTheme } from '../shell.js';
import { dayKey } from '../../domain/model.js';

const summary = (c) => plural(c.garments, 'garment') + ', ' + plural(c.outfits, 'outfit') + ' and ' + plural(c.days, 'day');

export function backupCard({ app, router, shell }) {
  const lastBackup = app.records.meta('lastBackup', null);
  const due = app.backup.due();
  const el = card(sectionHead('Backup'));
  el.id = 'backup-card';
  el.appendChild(h('p.muted', 'Everything is on this device only. A backup file holds all your garments, photos, outfits and calendar, and can be restored on another phone or after a reset.'));
  el.appendChild(h('p.muted#last-backup', lastBackup ? 'Last backup: ' + relativeDay(dayKey(new Date(lastBackup)), app.todayKey()) + '.' : 'No backup yet.'));
  if (due.due) el.appendChild(h('p.warning#backup-due', due.ever ? "It's been " + plural(due.days, 'day') + ' since your last backup.' : 'Your clothes have never been backed up.'));
  el.appendChild(h('div.actions', btn('Make a backup', () => makeBackup({ app, shell }), { kind: 'primary', icon: 'download', id: 'backup-make' }), btn('Restore from a backup', () => restoreFromFile({ app, router, shell }), { icon: 'upload', id: 'backup-restore' })));
  if (app.backup.oldApp.found) {
    el.appendChild(h('p.muted', "The old Wardrobe's data is on this device too. aWardrobe only reads it and never changes it."));
    el.appendChild(h('div.actions', btn('Copy from the old Wardrobe', () => copyFromOldApp({ app, router, shell }), { icon: 'upload', id: 'old-copy' })));
  }
  return el;
}

/* the home's offer when the old app's data is found and has not been copied or waved away (FR-103) */
export function oldAppOffer({ app, router, shell }) {
  if (!app.backup.oldApp.found || app.records.meta('oldCopied', null) || app.records.meta('oldOfferDismissed', null)) return null;
  const el = card(
    sectionHead('Your old Wardrobe is here'),
    h('p.muted', 'The old Wardrobe app has clothes on this device. Copy them into aWardrobe with their cut-outs, outfits and calendar. The old app is only read and stays as it is.'),
    h(
      'div.actions',
      btn('Copy from the old Wardrobe', () => copyFromOldApp({ app, router, shell }), { kind: 'primary', icon: 'upload', id: 'old-copy-home' }),
      btn('Not now', async () => {
        try {
          await app.records.setMeta('oldOfferDismissed', app.now().toISOString());
        } catch (e) {
          toast("That couldn't be saved. " + ((e && e.message) || ''));
        }
      }, { kind: 'ghost', id: 'old-offer-dismiss' })
    )
  );
  el.id = 'old-offer';
  return el;
}

/* progress words a few times a second, not once per picture, so a screen reader is not flooded */
function paced(b, wording) {
  let last = 0;
  return (p) => {
    const t = Date.now();
    if (p.done !== p.total && p.done % 10 !== 0 && t - last < 400) return;
    last = t;
    b.text(wording(p));
  };
}

/* ---------- making a backup (FR-100, FR-106) ---------- */
async function makeBackup({ app, shell }) {
  const b = busy('Packing your wardrobe…');
  let made;
  try {
    made = await app.backup.make({ onProgress: paced(b, (p) => 'Packing photos ' + p.done + ' of ' + p.total + '…') });
  } catch (e) {
    b.close();
    toast('The backup could not be made. ' + ((e && e.message) || ''));
    return;
  }
  b.close();
  if (made.missing.length) toast(plural(made.missing.length, 'picture') + ' could not be found, so ' + (made.missing.length === 1 ? 'it is' : 'they are') + ' not in the backup.');
  await offerSave({ app, shell }, made, false);
}
async function offerSave({ app, shell }, made, retried) {
  let result;
  try {
    result = await app.backup.save(made);
  } catch (e) {
    toast('The backup could not be saved. ' + ((e && e.message) || ''));
    return;
  }
  if (result === 'saved') {
    toast('Backup saved: ' + made.name + '.');
    shell.refresh();
  } else if (result === 'cancelled') toast('The backup was not saved.');
  else if (retried) toast('The browser did not allow the save. Try Make a backup again.');
  else {
    /* the browser wants the save to start from a tap of its own: the file is ready, one tap saves it */
    const s = sheet({
      title: 'Your backup is ready',
      body: h('div.form', h('p', summary(made.counts) + ', ' + bytesText(made.bytes) + '. Tap Save to choose where it goes.')),
      actions: [
        btn('Save', async () => {
          s.close();
          await offerSave({ app, shell }, made, true);
        }, { kind: 'primary', id: 'backup-save-now' })
      ]
    });
  }
}

/* ---------- restoring and copying (FR-101 to FR-104) ---------- */
async function restoreFromFile(ctx) {
  const file = await ctx.app.files.pick('.zip,.json,application/zip,application/json');
  if (!file) return;
  const b = busy('Reading the file…');
  let found;
  try {
    found = await ctx.app.backup.inspect(file);
  } catch (e) {
    b.close();
    toast((e && e.message) || "That file couldn't be read.");
    return;
  }
  b.close();
  await runRestore(ctx, found);
}
async function copyFromOldApp(ctx) {
  const b = busy('Reading the old Wardrobe…');
  let found;
  try {
    found = await ctx.app.backup.inspectOldApp();
  } catch (e) {
    b.close();
    toast((e && e.message) || "The old Wardrobe's data couldn't be read.");
    return;
  }
  b.close();
  await runRestore(ctx, found);
}
const verbOf = (found) => (found.kind !== 'wardrobe' ? 'Restore' : found.source === 'device' ? 'Copy' : 'Bring in');
async function runRestore(ctx, found) {
  const { app } = ctx;
  const fromOld = found.kind === 'wardrobe';
  let mode = 'add';
  if (app.backup.hasThings()) {
    mode = await askMode(found);
    if (!mode) return;
    if (mode === 'replace') {
      const ok = await confirmSheet({ title: 'Replace everything?', body: (fromOld ? "The old Wardrobe's clothes are brought in first" : 'The backup is brought in first') + ', then every garment, photo, outfit and calendar day on this device that is not in it is deleted.', confirm: 'Replace everything', danger: true });
      if (!ok) return;
    }
  }
  /* not enough room: say so before starting (NFR-17) */
  const room = await app.backup.room(found);
  if (room && room.needed > room.free) {
    const carryOn = await confirmSheet({ title: 'Not much room', body: 'The ' + (fromOld ? 'old Wardrobe' : 'backup') + ' needs about ' + bytesText(room.needed) + ' but only about ' + bytesText(room.free) + ' is free on this device. Free some space first, or carry on and see how far it gets: whatever comes in is whole.', confirm: 'Carry on', cancel: 'Cancel' });
    if (!carryOn) return;
  }
  const b = busy(fromOld ? 'Converting…' : 'Restoring…');
  const report = await app.backup.restore(found, { mode, onProgress: paced(b, (p) => (fromOld ? 'Converting ' : 'Restoring ') + p.step + ' ' + p.done + ' of ' + p.total + '…') });
  b.close();
  applyTheme(app.prefs.get().theme);
  showReport(ctx, report);
}
function askMode(found) {
  return new Promise((resolve) => {
    const what = found.kind === 'wardrobe' ? "the old Wardrobe's" : "the backup's";
    const title = verbOf(found) + ' ' + summary(found.counts) + (found.kind === 'wardrobe' ? ' from the old Wardrobe' : '') + '?';
    const body = found.damaged
      ? h('div.form', h('p.warning', 'This file is cut short, so only what is whole in it can be added to what is already here.'))
      : h('div.form', h('p', 'Add them to what is already here, keeping the newer copy of anything that is on both sides, or replace everything on this device with ' + what + ' contents.'));
    const s = sheet({
      title,
      body,
      actions: [found.damaged ? null : btn('Replace everything', () => s.close('replace'), { kind: 'danger', id: 'restore-replace' }), btn('Add to mine', () => s.close('add'), { kind: 'primary', id: 'restore-add' })].filter(Boolean),
      onClose: (r) => resolve(r || null)
    });
  });
}
function showReport({ router, shell }, report) {
  const came = report.garments + report.outfits + report.days;
  const from = report.from === 'wardrobe' ? 'From the old Wardrobe: ' : '';
  const lines = [];
  if (!came && report.kept && !report.error) lines.push(h('p', (from ? from + 'nothing' : 'Nothing') + ' new came in: ' + plural(report.kept, 'record') + ' already here ' + (report.kept === 1 ? 'is' : 'are') + ' the same or newer.'));
  else {
    lines.push(h('p', from + summary(report) + ' came in.'));
    if (report.kept) lines.push(h('p.muted', plural(report.kept, 'record') + ' already here ' + (report.kept === 1 ? 'was' : 'were') + ' kept, being the same or newer.'));
  }
  if (report.removed) lines.push(h('p.muted', plural(report.removed, 'record') + ' not in the file ' + (report.removed === 1 ? 'was' : 'were') + ' removed.'));
  if (report.error) lines.push(h('p.warning', 'The restore stopped part-way: ' + report.error + ' What came in before that is whole.'));
  for (const note of report.notes || []) lines.push(h('p.muted', note[0].toUpperCase() + note.slice(1) + '.'));
  if (report.skipped.length) lines.push(h('div#restore-skipped', h('p', 'Could not be read:'), h('ul', report.skipped.map((s) => h('li', s)))));
  const s = sheet({
    title: report.error ? 'Restore stopped' : report.from === 'wardrobe' ? 'Brought in' : 'Restored',
    body: h('div.form', ...lines),
    actions: [btn('Done', () => s.close(true), { kind: 'primary', id: 'restore-done' })],
    onClose: () => {
      shell.refresh();
      if (came) router.go('closet', null);
    }
  });
  s.el.querySelector('.sheet').id = 'restore-report';
}
