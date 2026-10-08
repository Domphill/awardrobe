/* aWardrobe app: backup, restore and the old Wardrobe (architecture section 9; FR-100 to FR-106,
   NFR-17, NFR-18, NFR-27). A backup is a zip of the records and every picture's stored blob, laid
   out as parts so the file is never held in memory. A restore reads the file a picture at a time
   and writes each garment with its pictures in one transaction, so a stop part-way leaves whole
   garments and the report says what came in; "Replace everything" brings the file in first and
   only then removes what the file does not hold, so an early failure loses nothing. The old app's
   backup file, or its database on this device, is converted through domain/migrate.js with the
   pictures split by the photo tools; the old data is never written to. */
import { planBackup, writeZip, readZip, validateManifest, validateRecords, pictureIdsOf, picturePaths, shouldReplace, backupDue, BackupError, NOT_A_BACKUP } from '../domain/backup-format.js';
import { isOldBackup, mapOldBackup, upgradeRecord, sanitizeRecord, MigrateError } from '../domain/migrate.js';
import { findOldWardrobe, readOldWardrobe } from '../infra/old-wardrobe.js';
import { dayKey } from '../domain/model.js';

export const NOT_ANY_BACKUP = "That file isn't a backup from aWardrobe or the old Wardrobe.";
export const DAMAGED_FILE = 'That file could not be read. It may be damaged.';
const MAX_TEXT_FILE = 1500 * 1024 * 1024;
const label = (g) => g.name || g.type || g.id;
const outfitLabel = (o) => 'the outfit ' + (o.name || o.id);

/* a data: URL to a blob, decoded here: the page allows no fetch but the weather's (NFR-3) */
export function dataUrlToBlob(s) {
  const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(s || '');
  if (!m) return null;
  const type = m[1] || 'application/octet-stream';
  if (!m[2]) {
    try {
      return new Blob([decodeURIComponent(m[3])], { type });
    } catch (e) {
      return null;
    }
  }
  let bin;
  try {
    bin = atob(m[3].replace(/\s+/g, ''));
  } catch (e) {
    return null;
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
const parseJson = (text, message) => {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new BackupError(message);
  }
};
const picRec = (id, kind, layers, stamp) => ({ id, v: 1, created: stamp, updated: stamp, kind, colour: layers.colour, alpha: layers.alpha || null, width: layers.width, height: layers.height, bytes: layers.bytes || layers.colour.size + (layers.alpha ? layers.alpha.size : 0) });
/* a failure of the photo tools themselves stops the restore; anything else is one record's problem */
const isToolFailure = (e) => !!e && e.name === 'WorkerError';

export function createBackup(app) {
  const r = app.records;
  const now = () => app.now();
  const crcOf = (blob) => app.images().call('crc32', { blob }, [], { timeoutMs: 120000 });
  const progress = (fn, info) => {
    if (!fn) return;
    try {
      fn(info);
    } catch (e) {
      /* a progress report never stops the work */
    }
  };
  const api = {
    /* the old Wardrobe's database on this device, with what it holds (FR-103) */
    oldApp: { found: false, counts: null },
    async checkOldApp() {
      let counts = null;
      try {
        counts = await findOldWardrobe();
      } catch (e) {
        counts = null;
      }
      const found = !!counts && counts.garments + counts.outfits + counts.days > 0;
      api.oldApp = { found, counts };
      return found;
    },
    fileName: () => 'awardrobe-backup-' + dayKey(now()) + '.zip',
    /* the reminder (FR-106) */
    due: () => backupDue({ lastBackup: r.meta('lastBackup', null), garments: r.list('garments'), now: now() }),
    hasThings: () => r.count('garments') + r.count('outfits') + r.count('days') > 0,
    /* FR-100: the records and every picture into one zip, laid out as parts (NFR-18) */
    async make(opts) {
      opts = opts || {};
      const garments = r.list('garments');
      const outfits = r.list('outfits');
      const days = r.list('days');
      const ids = [...pictureIdsOf(garments, outfits)];
      const pictures = [];
      const entries = [];
      const missing = [];
      let n = 0;
      for (const id of ids) {
        const rec = await r.db.get('pictures', id);
        if (!rec || !rec.colour) {
          missing.push(id);
          continue;
        }
        const paths = picturePaths(rec);
        entries.push({ name: paths.colour, data: rec.colour, crc: await crcOf(rec.colour) });
        if (rec.alpha) entries.push({ name: paths.alpha, data: rec.alpha, crc: await crcOf(rec.alpha) });
        pictures.push({ id: rec.id, kind: rec.kind, width: rec.width, height: rec.height, bytes: rec.bytes, colour: paths.colour, alpha: paths.alpha });
        progress(opts.onProgress, { done: ++n, total: ids.length });
      }
      /* a picture that could not be found is not pointed at from the file either */
      const lost = new Set(missing);
      const strip = (rec, keys) => {
        if (!lost.size) return rec;
        const copy = Object.assign({}, rec);
        if (keys) for (const k of keys) if (lost.has(copy[k])) copy[k] = null;
        if (copy.pictures) copy.pictures = Object.fromEntries(Object.entries(copy.pictures).map(([k, v]) => [k, lost.has(v) ? null : v]));
        return copy;
      };
      const { manifest, records } = planBackup({ garments: garments.map((g) => strip(g)), outfits: outfits.map((o) => strip(o, ['picture', 'thumb'])), days, prefs: r.meta('prefs', {}), pictures }, now());
      entries.unshift({ name: 'manifest.json', data: JSON.stringify(manifest) }, { name: 'records.json', data: JSON.stringify(records) });
      const blob = writeZip(entries, now());
      return { blob, name: api.fileName(), counts: manifest.counts, bytes: blob.size, missing };
    },
    /* hands the file to the share sheet or the download; a save sets the last-backup time (FR-106) */
    async save(made) {
      const result = await app.files.save(made.blob, made.name);
      if (result === 'saved') await r.setMeta('lastBackup', now().toISOString());
      return result;
    },
    /* what a chosen file is (FR-102, FR-104): an aWardrobe backup, the old Wardrobe's, or neither;
       `damaged` says the file is cut short, `bytes` roughly what it needs in storage */
    async inspect(file) {
      if (!file || typeof file.slice !== 'function') throw new BackupError(NOT_ANY_BACKUP);
      const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      if (head[0] === 0x50 && head[1] === 0x4b) {
        const zip = await readZip(file);
        const me = zip.entry('manifest.json');
        const re = zip.entry('records.json');
        if (!me || !re) throw new BackupError(NOT_A_BACKUP);
        const manifest = validateManifest(parseJson(await zip.text(me), NOT_A_BACKUP));
        const records = validateRecords(parseJson(await zip.text(re), NOT_A_BACKUP));
        const damaged = zip.repaired || zip.entries.some((e) => e.truncated);
        const bytes = zip.entries.reduce((s, e) => s + (e.truncated ? 0 : e.csize), 0);
        return { kind: 'awardrobe', zip, manifest, records, damaged, bytes, counts: { garments: records.garments.length, outfits: records.outfits.length, days: records.days.length } };
      }
      /* the old app's file is JSON; nothing else is read whole, and nothing huge is (NFR-18) */
      let i = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf ? 3 : 0;
      while (i < head.length && (head[i] === 0x20 || head[i] === 0x0a || head[i] === 0x0d || head[i] === 0x09)) i++;
      if (head[i] !== 0x7b) throw new BackupError(NOT_ANY_BACKUP);
      if (file.size > MAX_TEXT_FILE) throw new BackupError('That file is too big to read as a backup.');
      let data = null;
      try {
        data = JSON.parse(await file.text());
      } catch (e) {
        throw new BackupError(DAMAGED_FILE, 'damaged');
      }
      if (isOldBackup(data)) return { kind: 'wardrobe', data, source: 'file', damaged: false, bytes: file.size, counts: { garments: data.items.length, outfits: (data.outfits || []).length, days: (data.days || []).length } };
      if (data && data.app === 'awardrobe') throw new BackupError('That is one part of an aWardrobe backup, not the whole file. Choose the backup file itself, the one ending in .zip.');
      throw new BackupError(NOT_ANY_BACKUP);
    },
    /* the old app's database on this device, read only (FR-103) */
    async inspectOldApp() {
      const data = await readOldWardrobe();
      if (!data) throw new MigrateError("The old Wardrobe's data could not be found on this device.");
      let bytes = 0;
      for (const im of data.images) bytes += im.blob.size;
      return { kind: 'wardrobe', data, source: 'device', damaged: false, bytes, counts: { garments: data.items.length, outfits: data.outfits.length, days: data.days.length } };
    },
    /* how much the file needs against what the browser has free, or null when not reported (NFR-17) */
    async room(found) {
      let e = null;
      try {
        e = await app.storage.estimate();
      } catch (x) {
        e = null;
      }
      if (!e || !e.quota) return null;
      return { needed: found.bytes || 0, free: Math.max(0, e.quota - e.used) };
    },
    /* FR-101, FR-102, FR-104: brings a backup in, added to what is here or replacing it. The
       report counts what came in and what was kept because it was the same or newer here, names
       what could not be read, and says when a failure part-way stopped it. A marker in meta
       says a restore is under way, so one cut off by the app closing is reported next time. */
    async restore(found, opts) {
      opts = opts || {};
      const mode = opts.mode === 'replace' ? 'replace' : 'add';
      const wasEmpty = !api.hasThings();
      const report = { from: found.kind, source: found.source || 'file', mode, garments: 0, outfits: 0, days: 0, kept: 0, skipped: [], notes: [], error: null };
      try {
        await r.quiet(async () => {
          await r.setMeta('import', { started: now().toISOString(), mode, from: found.kind });
          const inFile = found.kind === 'awardrobe' ? await restoreOwn(found, mode, wasEmpty, report, opts) : await restoreOld(found, mode, wasEmpty, report, opts);
          if (mode === 'replace') await removeTheRest(inFile, report);
          await r.deleteMeta('import');
        });
      } catch (e) {
        report.error = (e && e.message) || String(e);
        try {
          await r.deleteMeta('import');
        } catch (x) {
          /* the marker stays: the next open says the restore did not finish */
        }
      }
      return report;
    }
  };

  /* the settings from a backup: all of them when replacing or starting from nothing, otherwise
     only the town, and only when none is set here */
  async function applyPrefs(incoming, mode, wasEmpty) {
    const patch = {};
    const cur = app.prefs.get();
    for (const [k, v] of Object.entries(incoming || {})) if (mode === 'replace' || wasEmpty || (k === 'place' && !cur.place && v)) patch[k] = v;
    patch.onboarded = true;
    await app.prefs.set(patch);
  }
  const why = (e) => {
    const kind = e && e.kind;
    if (kind === 'missing') return 'its picture is not in the file';
    if (kind === 'damaged') return 'its picture is damaged in the file';
    if (kind === 'truncated') return 'the file is cut short at its picture';
    return (e && e.message) || 'it could not be read';
  };
  /* after "Replace everything" has brought the file in: whatever the file does not hold goes,
     in one transaction, with the pictures nothing points at any more (NFR-27) */
  async function removeTheRest(inFile, report) {
    const garments = r.list('garments');
    const outfits = r.list('outfits');
    const days = r.list('days');
    const goneGarments = garments.filter((g) => !inFile.garments.has(g.id));
    const goneOutfits = outfits.filter((o) => !inFile.outfits.has(o.id));
    const goneDays = days.filter((d) => !inFile.days.has(d.id));
    const keep = pictureIdsOf(garments.filter((g) => inFile.garments.has(g.id)), outfits.filter((o) => inFile.outfits.has(o.id)));
    const gonePictures = (await r.db.getAllKeys('pictures')).filter((id) => !keep.has(id));
    if (!goneGarments.length && !goneOutfits.length && !goneDays.length && !gonePictures.length) return;
    await r.tx(['garments', 'outfits', 'days', 'pictures'], (ops) => {
      for (const g of goneGarments) ops.delete('garments', g.id);
      for (const o of goneOutfits) ops.delete('outfits', o.id);
      for (const d of goneDays) ops.delete('days', d.id);
      for (const id of gonePictures) ops.delete('pictures', id);
    });
    for (const id of gonePictures) app.pictures.forget(id);
    report.removed = goneGarments.length + goneOutfits.length + goneDays.length;
  }
  /* an outfit written with pictures drawn afresh from the pieces it still has */
  async function writeRepainted(o, pieces, existing) {
    const rp = await app.outfits.repaint(Object.assign({}, o, { pieces }));
    rp.rec.created = o.created;
    rp.rec.updated = o.updated;
    const old = existing ? [existing.picture, existing.thumb].filter(Boolean) : [];
    await r.tx(['outfits', 'pictures'], (ops) => {
      for (const p of rp.put) ops.put('pictures', p);
      for (const id of old) ops.delete('pictures', id);
      ops.put('outfits', rp.rec);
    });
    for (const id of old) app.pictures.forget(id);
  }

  async function restoreOwn({ zip, records }, mode, wasEmpty, report, opts) {
    const stamp = now().toISOString();
    const inFile = { garments: new Set(), outfits: new Set(), days: new Set() };
    const picMeta = new Map(records.pictures.map((p) => [p.id, p]));
    for (const d of records.dropped) report.skipped.push(d);
    const total = records.garments.length + records.outfits.length;
    let n = 0;
    const takes = (existing, rec) => mode === 'replace' || !existing || shouldReplace(existing, rec);
    const readPicture = async (id) => {
      const meta = picMeta.get(id);
      if (!meta) throw new BackupError('missing', 'missing');
      const ce = zip.entry(meta.colour);
      if (!ce) throw new BackupError('missing', 'missing');
      const colour = await zip.blob(ce);
      if (!(await zip.check(ce, crcOf))) throw new BackupError('damaged', 'damaged');
      let alpha = null;
      if (meta.alpha) {
        const ae = zip.entry(meta.alpha);
        if (!ae) throw new BackupError('missing', 'missing');
        alpha = await zip.blob(ae);
        if (!(await zip.check(ae, crcOf))) throw new BackupError('damaged', 'damaged');
      }
      return picRec(id, meta.kind, { colour, alpha, width: meta.width, height: meta.height, bytes: meta.bytes }, stamp);
    };
    const writeWith = async (store, rec, pics, existing, pictureIds) => {
      const fresh = new Set(pics.map((p) => p.id));
      const old = existing ? pictureIds(existing).filter((id) => id && !fresh.has(id)) : [];
      await r.tx([store, 'pictures'], (ops) => {
        for (const p of pics) ops.put('pictures', p);
        for (const id of old) ops.delete('pictures', id);
        ops.put(store, rec);
      });
      for (const id of old) app.pictures.forget(id);
      for (const p of pics) app.pictures.forget(p.id);
    };
    for (const raw of records.garments) {
      const g = sanitizeRecord('garments', upgradeRecord('garments', raw, stamp), stamp);
      if (!g) {
        report.skipped.push('a garment that could not be read');
        continue;
      }
      inFile.garments.add(g.id);
      progress(opts.onProgress, { step: 'garment', done: ++n, total, name: label(g) });
      const existing = r.get('garments', g.id);
      if (!takes(existing, g)) {
        report.kept++;
        continue;
      }
      const pics = [];
      try {
        if (!g.pictures.cutout || !g.pictures.thumb) throw new BackupError('missing', 'missing');
        pics.push(await readPicture(g.pictures.cutout), await readPicture(g.pictures.thumb));
        /* the reduced original is a bonus: without it the garment still comes in (FR-105) */
        if (g.pictures.original) {
          try {
            pics.push(await readPicture(g.pictures.original));
          } catch (e) {
            if (isToolFailure(e)) throw e;
            g.pictures.original = null;
          }
        }
      } catch (e) {
        if (isToolFailure(e)) throw e;
        report.skipped.push(label(g) + ': ' + why(e));
        continue;
      }
      await writeWith('garments', g, pics, existing, (x) => Object.values(x.pictures || {}));
      report.garments++;
    }
    for (const raw of records.outfits) {
      const o = sanitizeRecord('outfits', upgradeRecord('outfits', raw, stamp), stamp);
      if (!o) {
        report.skipped.push('an outfit that could not be read');
        continue;
      }
      inFile.outfits.add(o.id);
      progress(opts.onProgress, { step: 'outfit', done: ++n, total, name: o.name || o.id });
      const existing = r.get('outfits', o.id);
      if (!takes(existing, o)) {
        report.kept++;
        continue;
      }
      const pieces = o.pieces.filter((p) => r.has('garments', p.garmentId));
      if (!pieces.length) {
        report.skipped.push(outfitLabel(o) + ': none of its pieces came in');
        continue;
      }
      try {
        if (pieces.length < o.pieces.length || !o.picture || !o.thumb) {
          /* a piece did not come in, or the file has no picture for it: drawn afresh (FR-74) */
          await writeRepainted(o, pieces, existing);
          if (pieces.length < o.pieces.length) report.notes.push(outfitLabel(o) + ' was drawn again without a piece that did not come in');
        } else {
          const pics = [await readPicture(o.picture), await readPicture(o.thumb)];
          await writeWith('outfits', o, pics, existing, (x) => [x.picture, x.thumb]);
        }
      } catch (e) {
        if (isToolFailure(e) || (e && e.name === 'StorageError')) throw e;
        report.skipped.push(outfitLabel(o) + ': ' + why(e));
        continue;
      }
      report.outfits++;
    }
    const dayWrites = [];
    for (const raw of records.days) {
      const d = sanitizeRecord('days', upgradeRecord('days', raw, stamp), stamp);
      if (!d) continue;
      inFile.days.add(d.id);
      d.outfits = d.outfits.filter((id) => r.has('outfits', id));
      d.garments = d.garments.filter((id) => r.has('garments', id));
      if (!d.outfits.length && !d.garments.length && !d.note) continue;
      const existing = r.get('days', d.id);
      if (!takes(existing, d)) {
        report.kept++;
        continue;
      }
      dayWrites.push(d);
    }
    if (dayWrites.length) await r.tx(['days'], (ops) => dayWrites.forEach((d) => ops.put('days', d)));
    report.days = dayWrites.length;
    await applyPrefs(records.prefs, mode, wasEmpty);
    return inFile;
  }

  async function restoreOld({ data, source }, mode, wasEmpty, report, opts) {
    const stamp = now().toISOString();
    const mapped = mapOldBackup(data, { todayKey: app.todayKey(), now: stamp });
    const inFile = { garments: new Set(mapped.garments.map((x) => x.garment.id)), outfits: new Set(mapped.outfits.map((o) => o.id)), days: new Set(mapped.days.map((d) => d.id)) };
    for (const s of mapped.skipped) report.skipped.push(s);
    const images = new Map(mapped.images.map((im) => [im.id, im]));
    const blobOf = (id) => {
      const im = images.get(id);
      if (!im) return null;
      return im.blob || dataUrlToBlob(im.data);
    };
    const total = mapped.garments.length + mapped.outfits.length;
    let n = 0;
    const takes = (existing, rec) => mode === 'replace' || !existing || shouldReplace(existing, rec);
    for (const { garment: g, imageId } of mapped.garments) {
      progress(opts.onProgress, { step: 'garment', done: ++n, total, name: label(g) });
      const existing = r.get('garments', g.id);
      if (!takes(existing, g)) {
        report.kept++;
        continue;
      }
      const blob = blobOf(imageId);
      if (!blob) {
        report.skipped.push(label(g) + ': its photo is not in the file');
        continue;
      }
      let conv;
      try {
        conv = await app.images().call('convertOld', { blob }, [], { timeoutMs: 60000 });
      } catch (e) {
        if (isToolFailure(e)) throw e;
        report.skipped.push(label(g) + ': its photo could not be read');
        continue;
      }
      g.cutout = { kind: conv.kind, width: conv.width, height: conv.height, strength: 50, method: 'wardrobe-1', box: null, work: null };
      g.shape = conv.shape || null;
      const pics = [picRec(g.pictures.cutout, 'cutout', conv.cutout, stamp), picRec(g.pictures.thumb, 'thumb', conv.thumb, stamp)];
      const fresh = new Set(pics.map((p) => p.id));
      const old = existing ? Object.values(existing.pictures || {}).filter((id) => id && !fresh.has(id)) : [];
      await r.tx(['garments', 'pictures'], (ops) => {
        for (const p of pics) ops.put('pictures', p);
        for (const id of old) ops.delete('pictures', id);
        ops.put('garments', g);
      });
      for (const id of old) app.pictures.forget(id);
      for (const p of pics) app.pictures.forget(p.id);
      report.garments++;
    }
    for (const o of mapped.outfits) {
      progress(opts.onProgress, { step: 'outfit', done: ++n, total, name: o.name || o.id });
      const pieces = o.pieces.filter((p) => r.has('garments', p.garmentId));
      if (!pieces.length) {
        report.skipped.push(outfitLabel(o) + ': none of its pieces came over');
        continue;
      }
      const existing = r.get('outfits', o.id);
      if (!takes(existing, o)) {
        report.kept++;
        continue;
      }
      try {
        await writeRepainted(o, pieces, existing);
      } catch (e) {
        if (isToolFailure(e) || (e && e.name === 'StorageError')) throw e;
        report.skipped.push(outfitLabel(o) + ': its picture could not be drawn');
        continue;
      }
      if (pieces.length < o.pieces.length) report.notes.push(outfitLabel(o) + ' came over without a piece that did not');
      report.outfits++;
    }
    const dayWrites = [];
    for (const d of mapped.days) {
      d.outfits = d.outfits.filter((id) => r.has('outfits', id));
      d.garments = d.garments.filter((id) => r.has('garments', id));
      if (!d.outfits.length && !d.garments.length && !d.note) continue;
      const existing = r.get('days', d.id);
      if (!takes(existing, d)) {
        report.kept++;
        continue;
      }
      dayWrites.push(d);
    }
    if (dayWrites.length) await r.tx(['days'], (ops) => dayWrites.forEach((d) => ops.put('days', d)));
    report.days = dayWrites.length;
    await applyPrefs(mapped.prefs, mode, wasEmpty);
    if (source === 'device') await r.setMeta('oldCopied', stamp);
    return inFile;
  }
  return api;
}
