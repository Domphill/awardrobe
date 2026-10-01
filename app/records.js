/* aWardrobe app: every garment, outfit and day record kept in memory after boot, written through
   the database, with change announcements so screens refresh. Pictures are not kept here; they are
   read on demand by app/pictures.js. */

const RECORD_STORES = ['garments', 'outfits', 'days'];
const ALL_STORES = ['garments', 'outfits', 'days', 'pictures', 'meta', 'drafts'];
const clone = (x) => (x === null || x === undefined ? x : structuredClone(x));

export function createRecords(db) {
  const maps = {};
  for (const s of RECORD_STORES) maps[s] = new Map();
  const meta = new Map();
  const listeners = new Set();
  const emit = (change) => {
    for (const fn of listeners) {
      try {
        fn(change);
      } catch (e) {
        console.error(e);
      }
    }
  };
  const applyToMemory = (b) => {
    if (b.s === 'meta') {
      if (b.op === 'put') meta.set(b.rec.key, b.rec.value);
      else if (b.op === 'delete') meta.delete(b.key);
      else meta.clear();
    } else if (maps[b.s]) {
      if (b.op === 'put') maps[b.s].set(b.rec.id, b.rec);
      else if (b.op === 'delete') maps[b.s].delete(b.key);
      else maps[b.s].clear();
    }
  };

  const api = {
    db,
    async load() {
      for (const s of RECORD_STORES) {
        maps[s].clear();
        for (const rec of await db.getAll(s)) maps[s].set(rec.id, rec);
      }
      meta.clear();
      for (const m of await db.getAll('meta')) meta.set(m.key, m.value);
    },
    list: (s) => [...maps[s].values()].map(clone),
    get: (s, id) => (maps[s].has(id) ? clone(maps[s].get(id)) : null),
    has: (s, id) => maps[s].has(id),
    count: (s) => maps[s].size,
    async put(s, rec) {
      const copy = clone(rec);
      await db.put(s, copy);
      maps[s].set(copy.id, copy);
      emit({ store: s, id: copy.id, kind: 'put' });
      return clone(copy);
    },
    async remove(s, id) {
      await db.delete(s, id);
      maps[s].delete(id);
      emit({ store: s, id, kind: 'remove' });
    },
    /* Several writes that happen together or not at all. `fn(ops)` queues them; nothing touches
       memory until the database transaction has completed. */
    async tx(stores, fn) {
      const batch = [];
      const ops = {
        put: (s, rec) => batch.push({ op: 'put', s, rec: clone(rec) }),
        delete: (s, key) => batch.push({ op: 'delete', s, key }),
        clear: (s) => batch.push({ op: 'clear', s })
      };
      fn(ops);
      await db.tx(stores, (dbops) => {
        for (const b of batch) {
          if (b.op === 'put') dbops.put(b.s, b.rec);
          else if (b.op === 'delete') dbops.delete(b.s, b.key);
          else dbops.clear(b.s);
        }
      });
      for (const b of batch) applyToMemory(b);
      emit({ store: stores.join(','), id: null, kind: 'tx' });
    },
    meta: (key, fallback) => (meta.has(key) ? clone(meta.get(key)) : fallback),
    async setMeta(key, value) {
      const v = clone(value);
      await db.put('meta', { key, value: v });
      meta.set(key, v);
      emit({ store: 'meta', id: key, kind: 'put' });
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async wipe() {
      await db.clear(ALL_STORES);
      for (const s of RECORD_STORES) maps[s].clear();
      meta.clear();
      emit({ store: 'all', id: null, kind: 'wipe' });
    }
  };
  return api;
}
