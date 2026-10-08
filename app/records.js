/* aWardrobe app: every garment, outfit and day record kept in memory after boot, written through
   the database, with change announcements so screens refresh. Pictures are not kept here; they are
   read on demand by app/pictures.js. */
import { StorageError } from '../infra/db.js';

const RECORD_STORES = ['garments', 'outfits', 'days'];
const ALL_STORES = ['garments', 'outfits', 'days', 'pictures', 'meta', 'drafts'];
const clone = (x) => (x === null || x === undefined ? x : structuredClone(x));

export function createRecords(db) {
  const maps = {};
  for (const s of RECORD_STORES) maps[s] = new Map();
  const meta = new Map();
  const listeners = new Set();
  let muted = 0;
  let held = false;
  const emit = (change) => {
    /* while a long job runs, listeners hear once at the end instead of once per write */
    if (muted) {
      held = true;
      return;
    }
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
  const readMeta = async () => {
    const next = new Map();
    for (const m of await db.getAll('meta')) next.set(m.key, m.value);
    return next;
  };
  /* test hooks: the next write is refused, or the n-th one from now, so the error paths can be checked */
  const guard = () => {
    if (api.failNext) {
      api.failNext = false;
      throw new StorageError("Saving failed: the write was refused.", 'write');
    }
    if (api.failAt > 0 && --api.failAt === 0) throw new StorageError("Saving failed: the write was refused.", 'write');
  };

  const api = {
    db,
    failNext: false,
    failAt: 0,
    abortNextTx: false,
    /* Reads everything first, then swaps it in, so a failed read leaves memory as it was. */
    async load() {
      const next = {};
      for (const s of RECORD_STORES) {
        next[s] = new Map();
        for (const rec of await db.getAll(s)) next[s].set(rec.id, rec);
      }
      const nextMeta = await readMeta();
      for (const s of RECORD_STORES) {
        maps[s].clear();
        for (const [k, v] of next[s]) maps[s].set(k, v);
      }
      meta.clear();
      for (const [k, v] of nextMeta) meta.set(k, v);
    },
    async reloadMeta() {
      const nextMeta = await readMeta();
      meta.clear();
      for (const [k, v] of nextMeta) meta.set(k, v);
    },
    list: (s) => [...maps[s].values()].map(clone),
    get: (s, id) => (maps[s].has(id) ? clone(maps[s].get(id)) : null),
    has: (s, id) => maps[s].has(id),
    count: (s) => maps[s].size,
    async put(s, rec) {
      guard();
      const copy = clone(rec);
      await db.put(s, copy);
      maps[s].set(copy.id, copy);
      emit({ store: s, id: copy.id, kind: 'put' });
      return clone(copy);
    },
    async remove(s, id) {
      guard();
      await db.delete(s, id);
      maps[s].delete(id);
      emit({ store: s, id, kind: 'remove' });
    },
    /* Several writes that happen together or not at all. `fn(ops)` queues them; nothing touches
       memory until the database transaction has completed. */
    async tx(stores, fn) {
      guard();
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
        /* a test hook: the transaction is abandoned after its writes were queued */
        if (api.abortNextTx) {
          api.abortNextTx = false;
          dbops.abort(new StorageError('The save was interrupted before it finished.', 'aborted'));
        }
      });
      for (const b of batch) applyToMemory(b);
      emit({ store: stores.join(','), id: null, kind: 'tx' });
    },
    meta: (key, fallback) => (meta.has(key) ? clone(meta.get(key)) : fallback),
    async setMeta(key, value) {
      guard();
      const v = clone(value);
      await db.put('meta', { key, value: v });
      meta.set(key, v);
      emit({ store: 'meta', id: key, kind: 'put' });
    },
    async deleteMeta(key) {
      guard();
      await db.delete('meta', key);
      meta.delete(key);
      emit({ store: 'meta', id: key, kind: 'remove' });
    },
    /* runs `fn` with change announcements held back, then announces once (a restore writes
       hundreds of times, and every screen would redraw for each) */
    async quiet(fn) {
      muted++;
      try {
        return await fn();
      } finally {
        muted--;
        if (!muted && held) {
          held = false;
          emit({ store: 'all', id: null, kind: 'batch' });
        }
      }
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async wipe() {
      guard();
      await db.clear(ALL_STORES);
      for (const s of RECORD_STORES) maps[s].clear();
      meta.clear();
      emit({ store: 'all', id: null, kind: 'wipe' });
    }
  };
  return api;
}
