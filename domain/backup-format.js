/* aWardrobe domain: the backup file (architecture section 9.1; FR-100, FR-101, FR-104, FR-106,
   NFR-18, NFR-29). A zip written with the "store" method (the pictures are already compressed),
   laid out as a list of parts in which every picture is its stored blob, untouched, so the whole
   file is never held in memory. It is read back from the directory at its end or, when the end is
   missing, by walking the entries from the start, so a file cut short still gives up what it has.

   The format, so another program could read it:
     manifest.json      { app: "awardrobe", format: 2, exported, dataVersion, counts }
     records.json       { garments, outfits, days, prefs, pictures: [{ id, kind, width, height, bytes, colour, alpha }] }
     pictures/<id>.jpg  the colour layer of a picture
     pictures/<id>.png  its alpha layer (the see-through map), where it has one

   Pure: no screen, no storage, no network. */
import { crc32, crc32Stream } from './crc32.js';

export const APP = 'awardrobe';
export const FORMAT = 2;
export const DATA_VERSION = 1;
export const REMINDER_DAYS = 30;
export const PICTURE_DIR = 'pictures/';
export const NOT_A_BACKUP = "That file isn't an aWardrobe backup.";
const MAX_ENTRIES = 65535;
const MAX_BYTES = 0xffffffff;
const SLICE = 1024 * 1024;
const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const STORE = 0;
const DEFLATE = 8;
const FLAG_UTF8 = 0x0800;
const FLAG_DESCRIPTOR = 0x0008;
/* what a backup carries of the settings: never the welcome flag */
const SETTINGS = ['theme', 'currency', 'tempUnit', 'place', 'autoCutout'];

export class BackupError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'BackupError';
    this.kind = kind || 'format';
  }
}
const enc = new TextEncoder();
const dec = new TextDecoder();
const isBlob = (x) => typeof Blob !== 'undefined' && x instanceof Blob;
const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const put16 = (b, i, v) => {
  b[i] = v & 255;
  b[i + 1] = (v >>> 8) & 255;
};
const put32 = (b, i, v) => {
  b[i] = v & 255;
  b[i + 1] = (v >>> 8) & 255;
  b[i + 2] = (v >>> 16) & 255;
  b[i + 3] = (v >>> 24) & 255;
};
const read = async (file, start, end) => new Uint8Array(await file.slice(start, end).arrayBuffer());

/* the checksum of a blob, read a slice at a time so a big picture never sits in memory whole */
export async function crcOfBlob(blob, slice) {
  const s = crc32Stream();
  const step = slice || SLICE;
  for (let at = 0; at < blob.size; at += step) s.update(await read(blob, at, Math.min(blob.size, at + step)));
  return s.value();
}

/* ---------- writing ---------- */
const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
const dosDate = (d) => ((Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;

function localHeader(name, crc, size, time, date) {
  const b = new Uint8Array(30 + name.length);
  put32(b, 0, SIG_LOCAL);
  put16(b, 4, 20);
  put16(b, 6, FLAG_UTF8);
  put16(b, 8, STORE);
  put16(b, 10, time);
  put16(b, 12, date);
  put32(b, 14, crc);
  put32(b, 18, size);
  put32(b, 22, size);
  put16(b, 26, name.length);
  put16(b, 28, 0);
  b.set(name, 30);
  return b;
}
function centralHeader(name, crc, size, time, date, offset) {
  const b = new Uint8Array(46 + name.length);
  put32(b, 0, SIG_CENTRAL);
  put16(b, 4, 20);
  put16(b, 6, 20);
  put16(b, 8, FLAG_UTF8);
  put16(b, 10, STORE);
  put16(b, 12, time);
  put16(b, 14, date);
  put32(b, 16, crc);
  put32(b, 20, size);
  put32(b, 24, size);
  put16(b, 28, name.length);
  put16(b, 30, 0);
  put16(b, 32, 0);
  put16(b, 34, 0);
  put16(b, 36, 0);
  put32(b, 38, 0);
  put32(b, 42, offset);
  b.set(name, 46);
  return b;
}
function endRecord(count, cdSize, cdOffset) {
  const b = new Uint8Array(22);
  put32(b, 0, SIG_END);
  put16(b, 4, 0);
  put16(b, 6, 0);
  put16(b, 8, count);
  put16(b, 10, count);
  put32(b, 12, cdSize);
  put32(b, 16, cdOffset);
  put16(b, 20, 0);
  return b;
}

/* The zip as parts: small header buffers and the entries' data as given. An entry is
   { name, data: string | Uint8Array | Blob, crc? }; a blob must bring its checksum, computed
   elsewhere in slices, so nothing here ever reads a picture. */
export function zipParts(entries, now) {
  now = now || new Date();
  const time = dosTime(now);
  const date = dosDate(now);
  if (entries.length > MAX_ENTRIES) throw new BackupError('A backup can hold at most ' + MAX_ENTRIES + ' files.', 'limit');
  const parts = [];
  const central = [];
  const seen = new Set();
  let offset = 0;
  for (const e of entries) {
    if (!e || typeof e.name !== 'string' || !e.name) throw new BackupError('An entry has no name.', 'limit');
    if (seen.has(e.name)) throw new BackupError('"' + e.name + '" is in the backup twice.', 'limit');
    seen.add(e.name);
    let data = e.data;
    let size;
    let crc;
    if (isBlob(data)) {
      if (typeof e.crc !== 'number') throw new BackupError('"' + e.name + '" needs its checksum.', 'limit');
      size = data.size;
      crc = e.crc >>> 0;
    } else {
      if (typeof data === 'string') data = enc.encode(data);
      else if (!(data instanceof Uint8Array)) data = new Uint8Array(data || 0);
      size = data.length;
      crc = typeof e.crc === 'number' ? e.crc >>> 0 : crc32(data);
    }
    const name = enc.encode(e.name);
    const local = localHeader(name, crc, size, time, date);
    parts.push(local);
    if (size) parts.push(data);
    central.push(centralHeader(name, crc, size, time, date, offset));
    offset += local.length + size;
    if (offset > MAX_BYTES) throw new BackupError('A backup must be under 4 GB.', 'limit');
  }
  const cdOffset = offset;
  let cdSize = 0;
  for (const c of central) {
    parts.push(c);
    cdSize += c.length;
  }
  parts.push(endRecord(entries.length, cdSize, cdOffset));
  return { parts, size: cdOffset + cdSize + 22, count: entries.length };
}
export function writeZip(entries, now) {
  return new Blob(zipParts(entries, now).parts, { type: 'application/zip' });
}

/* ---------- reading ---------- */
function parseCentral(cd, count, fileSize) {
  const out = [];
  let i = 0;
  while (i + 46 <= cd.length && out.length < count) {
    if (u32(cd, i) !== SIG_CENTRAL) break;
    const method = u16(cd, i + 10);
    const crc = u32(cd, i + 16);
    const csize = u32(cd, i + 20);
    const usize = u32(cd, i + 24);
    const n = u16(cd, i + 28);
    const m = u16(cd, i + 30);
    const k = u16(cd, i + 32);
    const offset = u32(cd, i + 42);
    const name = dec.decode(cd.subarray(i + 46, i + 46 + n));
    out.push({ name, size: usize, csize, crc, method, offset, truncated: offset + 30 + n + csize > fileSize, dataStart: undefined });
    i += 46 + n + m + k;
  }
  return out.length || !count ? out : null;
}
/* without a directory: one local header after another, until one runs off the end */
async function walkLocal(file) {
  const out = [];
  const size = file.size;
  let at = 0;
  while (at + 30 <= size) {
    const lh = await read(file, at, at + 30);
    if (u32(lh, 0) !== SIG_LOCAL) break;
    const flags = u16(lh, 6);
    const method = u16(lh, 8);
    const crc = u32(lh, 14);
    const csize = u32(lh, 18);
    const usize = u32(lh, 22);
    const n = u16(lh, 26);
    const m = u16(lh, 28);
    const name = dec.decode(await read(file, at + 30, at + 30 + n));
    const dataStart = at + 30 + n + m;
    /* sizes written after the data (not by this app) cannot be trusted without the directory */
    const truncated = dataStart + csize > size || !!(flags & FLAG_DESCRIPTOR);
    out.push({ name, size: usize, csize, crc, method, offset: at, dataStart, truncated });
    if (truncated) break;
    at = dataStart + csize;
  }
  if (!out.length) throw new BackupError(NOT_A_BACKUP);
  return out;
}

/* Opens a zip for reading. Returns its entries and ways to get at each one: a blob (a slice of the
   file, nothing read), its bytes or text (checked against the checksum), or a check alone. */
export async function readZip(file) {
  if (!file || typeof file.slice !== 'function' || typeof file.size !== 'number' || file.size < 22) throw new BackupError(NOT_A_BACKUP);
  const size = file.size;
  const head = await read(file, 0, 4);
  if (u32(head, 0) !== SIG_LOCAL) throw new BackupError(NOT_A_BACKUP);
  const tailStart = Math.max(0, size - 65557);
  const tail = await read(file, tailStart, size);
  let entries = null;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tail, i) !== SIG_END) continue;
    const count = u16(tail, i + 10);
    const cdSize = u32(tail, i + 12);
    const cdOffset = u32(tail, i + 16);
    if (cdOffset + cdSize <= tailStart + i) entries = parseCentral(await read(file, cdOffset, cdOffset + cdSize), count, size);
    break;
  }
  const repaired = !entries;
  if (repaired) entries = await walkLocal(file);
  const byName = new Map(entries.map((e) => [e.name, e]));
  const dataStart = async (e) => {
    if (e.dataStart === undefined) {
      const lh = await read(file, e.offset, e.offset + 30);
      if (u32(lh, 0) !== SIG_LOCAL) throw new BackupError('"' + e.name + '" in the backup could not be found.', 'damaged');
      e.dataStart = e.offset + 30 + u16(lh, 26) + u16(lh, 28);
      if (e.dataStart + e.csize > size) e.truncated = true;
    }
    return e.dataStart;
  };
  const api = {
    entries,
    repaired,
    size,
    entry: (name) => byName.get(name) || null,
    /* the entry's data as a blob: a slice of the file, so nothing is read here */
    async blob(e) {
      const at = await dataStart(e);
      if (e.truncated) throw new BackupError('"' + e.name + '" in the backup is cut short.', 'truncated');
      const raw = file.slice(at, at + e.csize);
      if (e.method === STORE) return raw;
      if (e.method === DEFLATE && typeof DecompressionStream === 'function') return new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
      throw new BackupError('"' + e.name + '" in the backup is packed in a way this phone cannot read.', 'unsupported');
    },
    /* true when the entry's bytes match its checksum; `crcOf(blob)` may be the worker's */
    async check(e, crcOf) {
      const b = await api.blob(e);
      return (await (crcOf || crcOfBlob)(b)) === e.crc;
    },
    async bytes(e) {
      const out = new Uint8Array(await (await api.blob(e)).arrayBuffer());
      if (crc32(out) !== e.crc) throw new BackupError('"' + e.name + '" in the backup is damaged.', 'damaged');
      return out;
    },
    async text(e) {
      return dec.decode(await api.bytes(e));
    }
  };
  return api;
}

/* ---------- what goes in, and what comes out ---------- */
export const picturePaths = (pic) => ({ colour: PICTURE_DIR + pic.id + '.jpg', alpha: pic.alpha ? PICTURE_DIR + pic.id + '.png' : null });
/* every picture a garment or an outfit refers to, in a steady order */
export function pictureIdsOf(garments, outfits) {
  const ids = new Set();
  for (const g of garments || []) for (const id of Object.values((g && g.pictures) || {})) if (id) ids.add(id);
  for (const o of outfits || []) for (const id of [o && o.picture, o && o.thumb]) if (id) ids.add(id);
  return ids;
}
export function settingsOf(prefs) {
  const out = {};
  for (const k of SETTINGS) if (prefs && prefs[k] !== undefined) out[k] = prefs[k];
  return out;
}
/* the manifest and the records of a backup; `pictures` are the picture records with their paths */
export function planBackup({ garments, outfits, days, prefs, pictures }, now) {
  const records = {
    garments: garments || [],
    outfits: outfits || [],
    days: days || [],
    prefs: settingsOf(prefs),
    pictures: (pictures || []).map((p) => ({ id: p.id, kind: p.kind, width: p.width, height: p.height, bytes: p.bytes, colour: p.colour, alpha: p.alpha || null }))
  };
  const manifest = { app: APP, format: FORMAT, exported: (now || new Date()).toISOString(), dataVersion: DATA_VERSION, counts: { garments: records.garments.length, outfits: records.outfits.length, days: records.days.length, pictures: records.pictures.length } };
  return { manifest, records };
}
export function validateManifest(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || m.app !== APP || typeof m.format !== 'number') throw new BackupError(NOT_A_BACKUP);
  if (m.format > FORMAT) throw new BackupError('This backup was made by a newer aWardrobe. Update the app, then try again.', 'newer');
  if (m.format < 1) throw new BackupError(NOT_A_BACKUP);
  return {
    app: APP,
    format: m.format,
    exported: typeof m.exported === 'string' ? m.exported : '',
    dataVersion: Number(m.dataVersion) || 0,
    counts: Object.assign({ garments: 0, outfits: 0, days: 0, pictures: 0 }, m.counts && typeof m.counts === 'object' ? m.counts : {})
  };
}
export function validateRecords(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) throw new BackupError(NOT_A_BACKUP);
  const list = (k) => {
    const v = r[k];
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) throw new BackupError(NOT_A_BACKUP);
    return v;
  };
  const dropped = [];
  const withId = (k, label) =>
    list(k).filter((x) => {
      const ok = !!x && typeof x === 'object' && typeof x.id === 'string' && !!x.id;
      if (!ok) dropped.push('a ' + label + ' without an id');
      return ok;
    });
  const garments = withId('garments', 'garment');
  const outfits = withId('outfits', 'outfit');
  const days = withId('days', 'day');
  const pictures = withId('pictures', 'picture')
    .filter((p) => {
      const ok = typeof p.colour === 'string' && !!p.colour;
      if (!ok) dropped.push('a picture without its files: ' + p.id);
      return ok;
    })
    .map((p) => ({ id: p.id, kind: typeof p.kind === 'string' ? p.kind : 'cutout', width: Number(p.width) || 0, height: Number(p.height) || 0, bytes: Number(p.bytes) || 0, colour: p.colour, alpha: typeof p.alpha === 'string' && p.alpha ? p.alpha : null }));
  return { garments, outfits, days, prefs: settingsOf(r.prefs && typeof r.prefs === 'object' && !Array.isArray(r.prefs) ? r.prefs : {}), pictures, dropped };
}
/* the merge rule (FR-101): a record on both sides keeps whichever was changed more recently */
export const shouldReplace = (existing, incoming) => !existing || String((incoming && incoming.updated) || '') > String(existing.updated || '');

/* the reminder (FR-106): due 30 days after the last backup or, with no backup ever, 30 days
   after the first garment; never with an empty closet */
export function backupDue({ lastBackup, garments, now }) {
  const ever = !!lastBackup;
  if (!garments || !garments.length) return { due: false, days: null, ever };
  let since = null;
  if (lastBackup) since = Date.parse(lastBackup);
  else for (const g of garments) {
    const c = Date.parse((g && g.created) || '');
    if (!isNaN(c) && (since === null || c < since)) since = c;
  }
  if (since === null || isNaN(since)) return { due: false, days: null, ever };
  const days = Math.floor(((now || new Date()).getTime() - since) / 86400000);
  return { due: days >= REMINDER_DAYS, days, ever };
}
