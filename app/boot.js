/* aWardrobe app: start-up. Opens the database (or falls back to memory only when it cannot be
   opened, read, or does not answer in time), loads the records, wires the settings and the
   error log. The screen is wired in main.js. */
import { openDb, memoryDb, estimate, persist, StorageError } from '../infra/db.js';
import { env } from '../infra/platform.js';
import { createRecords } from './records.js';
import { createPrefs } from './prefs.js';
import { VERSION } from './version.js';
import { createImageWorker } from '../infra/worker-client.js';
import { todayKey as dayOf } from '../domain/model.js';
import { createPictures } from './pictures.js';
import { createDrafts } from './drafts.js';
import { createGarments } from './garments.js';

const MAX_ERRORS = 20;
const OPEN_TIMEOUT = 8000;

/* The last 20 things that went wrong (FR-115). An entry is listed at once and written behind;
   the stored list is read fresh each time, so a wipe or a reload is always respected. */
export function createErrorLog(records) {
  const pending = [];
  const copy = (e) => Object.assign({}, e);
  let chain = Promise.resolve();
  return {
    list: () => pending.concat(records.meta('errors', [])).slice(0, MAX_ERRORS).map(copy),
    /* Writes go one after another, so two errors in quick succession are both kept. */
    record(entry) {
      const e = Object.assign({ at: new Date().toISOString() }, entry);
      pending.unshift(e);
      const run = chain.then(async () => {
        try {
          const next = [copy(e)].concat(records.meta('errors', [])).slice(0, MAX_ERRORS);
          await records.setMeta('errors', next);
        } catch (x) {
          /* recording an error must never raise another */
        } finally {
          const i = pending.indexOf(e);
          if (i >= 0) pending.splice(i, 1);
        }
      });
      chain = run;
      return run;
    },
    async clear() {
      pending.length = 0;
      await records.setMeta('errors', []);
    }
  };
}

function withTimeout(promise, ms) {
  let timer;
  const late = { value: false };
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      late.value = true;
      reject(new StorageError('The database did not answer in time.', 'timeout'));
    }, ms);
  });
  promise.then(
    (db) => {
      clearTimeout(timer);
      if (late.value && db && db.close) db.close();
    },
    () => clearTimeout(timer)
  );
  return Promise.race([promise, timeout]);
}

export async function createApp(opts) {
  opts = opts || {};
  let db;
  let memoryOnly = false;
  try {
    if (opts.forceNoStorage) throw new StorageError('storage switched off for this test', 'unavailable');
    const opening = opts.hangOpen ? new Promise(() => {}) : openDb();
    db = await withTimeout(opening, opts.openTimeout || OPEN_TIMEOUT);
  } catch (e) {
    db = memoryDb();
    memoryOnly = true;
  }
  let records = createRecords(db);
  try {
    if (opts.breakLoad) throw new StorageError('the records could not be read', 'read');
    await records.load();
  } catch (e) {
    try {
      db.close();
    } catch (x) {
      /* already closed */
    }
    db = memoryDb();
    memoryOnly = true;
    records = createRecords(db);
    await records.load();
  }
  const prefs = createPrefs(records);
  const errors = createErrorLog(records);
  let frozen = null;
  let imageWorker = null;
  const app = {
    db,
    records,
    prefs,
    errors,
    memoryOnly,
    env,
    storage: { estimate, persist },
    version: VERSION,
    /* "now", which the tests can freeze */
    now: () => (frozen ? new Date(frozen.getTime()) : new Date()),
    setNow(d) {
      frozen = d ? new Date(d) : null;
    },
    todayKey: () => dayOf(app.now()),
    /* the image worker, started the first time it is needed and shared by every screen */
    images() {
      if (!imageWorker) imageWorker = createImageWorker();
      return imageWorker;
    },
    close() {
      try {
        db.close();
      } catch (e) {
        /* already closed */
      }
      if (imageWorker) {
        imageWorker.terminate();
        imageWorker = null;
      }
    }
  };
  app.pictures = createPictures(records);
  app.drafts = createDrafts(records);
  app.garments = createGarments(app);
  return app;
}
