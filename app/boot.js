/* aWardrobe app: start-up. Opens the database (or falls back to memory only), loads the records,
   wires the settings and the error log. The screen is wired in main.js. */
import { openDb, memoryDb, estimate, persist, StorageError } from '../infra/db.js';
import { env } from '../infra/platform.js';
import { createRecords } from './records.js';
import { createPrefs } from './prefs.js';
import { VERSION } from './version.js';

const MAX_ERRORS = 20;

/* The last 20 things that went wrong (FR-115). Kept in memory at once, written behind. */
export function createErrorLog(records) {
  let list = null;
  const current = () => (list === null ? (list = records.meta('errors', [])) : list);
  return {
    list: () => current().map((e) => Object.assign({}, e)),
    async record(entry) {
      const l = current();
      l.unshift(Object.assign({ at: new Date().toISOString() }, entry));
      while (l.length > MAX_ERRORS) l.pop();
      try {
        await records.setMeta('errors', l.map((e) => Object.assign({}, e)));
      } catch (e) {
        /* recording an error must never raise another */
      }
    },
    async clear() {
      list = [];
      await records.setMeta('errors', []);
    }
  };
}

export async function createApp(opts) {
  opts = opts || {};
  let db;
  let memoryOnly = false;
  try {
    if (opts.forceNoStorage) throw new StorageError('storage switched off for this test', 'unavailable');
    db = await openDb();
  } catch (e) {
    db = memoryDb();
    memoryOnly = true;
  }
  const records = createRecords(db);
  await records.load();
  const prefs = createPrefs(records);
  const errors = createErrorLog(records);
  return {
    db,
    records,
    prefs,
    errors,
    memoryOnly,
    env,
    storage: { estimate, persist },
    version: VERSION,
    close() {
      try {
        db.close();
      } catch (e) {
        /* already closed */
      }
    }
  };
}
