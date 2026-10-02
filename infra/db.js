/* aWardrobe infra: IndexedDB, the database inside the browser. Six stores keyed by id (meta and
   drafts by key). Every write goes through a transaction, so a failure leaves nothing behind.
   Only this file talks to IndexedDB. */

export const DB_NAME = 'awardrobe';
export const STORES = { garments: 'id', outfits: 'id', days: 'id', pictures: 'id', meta: 'key', drafts: 'key' };
export const STORE_NAMES = Object.keys(STORES);

export class StorageError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'StorageError';
    this.kind = kind || 'write';
  }
}

function wrap(err) {
  if (err instanceof StorageError) return err;
  const name = err && err.name;
  if (name === 'QuotaExceededError') return new StorageError("There isn't enough space to save this. Free some space or take a backup first.", 'quota');
  return new StorageError('Saving failed: ' + ((err && err.message) || 'database error') + '.', 'write');
}
const req = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(wrap(r.error));
  });

export function openDb(name = DB_NAME) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) return reject(new StorageError('This browser cannot store data.', 'unavailable'));
    let r;
    try {
      r = indexedDB.open(name, 1);
    } catch (e) {
      return reject(new StorageError('This browser cannot store data.', 'unavailable'));
    }
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const [store, key] of Object.entries(STORES)) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: key });
    };
    r.onsuccess = () => resolve(new Db(r.result));
    r.onerror = () => reject(new StorageError('This browser cannot store data.', 'unavailable'));
    r.onblocked = () => reject(new StorageError('The database is open in another tab.', 'blocked'));
  });
}

class Db {
  constructor(idb) {
    this.idb = idb;
    this.name = idb.name;
    idb.onversionchange = () => idb.close();
  }
  close() {
    this.idb.close();
  }
  getAll(store) {
    return req(this.idb.transaction(store, 'readonly').objectStore(store).getAll());
  }
  getAllKeys(store) {
    return req(this.idb.transaction(store, 'readonly').objectStore(store).getAllKeys());
  }
  get(store, key) {
    return req(this.idb.transaction(store, 'readonly').objectStore(store).get(key));
  }
  put(store, rec) {
    return this.tx([store], (ops) => ops.put(store, rec));
  }
  delete(store, key) {
    return this.tx([store], (ops) => ops.delete(store, key));
  }
  clear(stores) {
    return this.tx(stores, (ops) => stores.forEach((s) => ops.clear(s)));
  }
  /* One transaction over several stores. `fn(ops)` must issue its writes at once (not after an
     await), or the browser commits early. Any failure aborts the lot and rejects with a StorageError. */
  tx(stores, fn) {
    return new Promise((resolve, reject) => {
      let t;
      try {
        t = this.idb.transaction(stores, 'readwrite');
      } catch (e) {
        return reject(wrap(e));
      }
      let failed = null;
      const abort = (e) => {
        failed = failed || wrap(e);
        try {
          t.abort();
        } catch (x) {
          /* already aborted */
        }
      };
      const ops = {
        put: (s, rec) => {
          try {
            const r = t.objectStore(s).put(rec);
            r.onerror = (ev) => {
              ev.preventDefault();
              abort(r.error);
            };
          } catch (e) {
            abort(e);
          }
        },
        delete: (s, key) => {
          try {
            t.objectStore(s).delete(key);
          } catch (e) {
            abort(e);
          }
        },
        clear: (s) => {
          try {
            t.objectStore(s).clear();
          } catch (e) {
            abort(e);
          }
        },
        get: (s, key) => req(t.objectStore(s).get(key)),
        abort: (e) => abort(e || new Error('the write was abandoned'))
      };
      t.oncomplete = () => resolve();
      t.onabort = () => reject(failed || wrap(t.error || new Error('the write was abandoned')));
      t.onerror = (ev) => {
        ev.preventDefault();
        abort(t.error);
      };
      try {
        const res = fn(ops);
        if (res && typeof res.then === 'function') res.then(null, abort);
      } catch (e) {
        abort(e);
      }
    });
  }
}

/* A stand-in with the same shape when the browser cannot store anything (a private window):
   everything lives in memory for the session (FR-113). */
export function memoryDb() {
  const data = {};
  for (const s of STORE_NAMES) data[s] = new Map();
  const keyOf = (s, rec) => rec[STORES[s]];
  const ops = {
    put: (s, rec) => {
      const k = keyOf(s, rec);
      if (k === undefined || k === null) throw new StorageError('Saving failed: the record has no key.', 'write');
      data[s].set(k, structuredClone(rec));
    },
    delete: (s, key) => data[s].delete(key),
    clear: (s) => data[s].clear(),
    get: async (s, key) => structuredClone(data[s].get(key)),
    abort: (e) => {
      throw e || new Error('the write was abandoned');
    }
  };
  return {
    name: 'memory',
    memory: true,
    close() {},
    getAll: async (s) => [...data[s].values()].map((x) => structuredClone(x)),
    getAllKeys: async (s) => [...data[s].keys()],
    get: async (s, key) => (data[s].has(key) ? structuredClone(data[s].get(key)) : undefined),
    put: async (s, rec) => ops.put(s, rec),
    delete: async (s, key) => ops.delete(s, key),
    clear: async (stores) => stores.forEach((s) => ops.clear(s)),
    async tx(stores, fn) {
      const snapshot = {};
      for (const s of stores) snapshot[s] = new Map(data[s]);
      try {
        await fn(ops);
      } catch (e) {
        for (const s of stores) data[s] = snapshot[s];
        throw wrap(e);
      }
    }
  };
}

export function deleteDb(name) {
  return new Promise((resolve) => {
    let r;
    try {
      r = indexedDB.deleteDatabase(name);
    } catch (e) {
      return resolve(false);
    }
    r.onsuccess = () => resolve(true);
    r.onerror = () => resolve(false);
    r.onblocked = () => resolve(false);
  });
}

export async function estimate() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      return { used: e.usage || 0, quota: e.quota || 0 };
    }
  } catch (e) {
    /* not reported by this browser */
  }
  return null;
}

export async function persist() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch (e) {
    /* not available */
  }
  return false;
}

export async function databaseNames() {
  try {
    if (indexedDB.databases) return (await indexedDB.databases()).map((d) => d.name);
  } catch (e) {
    /* not available */
  }
  return null;
}
