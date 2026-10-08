/* aWardrobe infra: the old Wardrobe's database on this device, read and never written
   (architecture section 9.3, FR-103). It is opened only when it already exists: a request that
   would create it is abandoned, so a device without the old app gains no database (NFR-34). */
import { databaseNames } from './db.js';

export const OLD_DB = 'wardrobe';
const OLD_STORES = ['items', 'outfits', 'days', 'images', 'meta'];
const req = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('The old database could not be read.'));
  });

/* the old database if it exists, else null; never upgraded, never created */
function openExisting() {
  return new Promise((resolve) => {
    let r;
    try {
      r = indexedDB.open(OLD_DB);
    } catch (e) {
      return resolve(null);
    }
    r.onupgradeneeded = () => {
      try {
        r.transaction.abort();
      } catch (e) {
        /* nothing was created */
      }
      resolve(null);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(null);
    r.onblocked = () => resolve(null);
  });
}
/* what the old database holds, or null when there is none (an empty one counts as nothing) */
export async function findOldWardrobe() {
  const names = await databaseNames();
  if (names && !names.includes(OLD_DB)) return null;
  const db = await openExisting();
  if (!db) return null;
  try {
    const stores = ['items', 'outfits', 'days'].filter((s) => db.objectStoreNames.contains(s));
    if (!stores.includes('items')) return null;
    const tx = db.transaction(stores, 'readonly');
    const count = async (s) => (stores.includes(s) ? await req(tx.objectStore(s).count()) : 0);
    return { garments: await count('items'), outfits: await count('outfits'), days: await count('days') };
  } catch (e) {
    return null;
  } finally {
    db.close();
  }
}
/* everything in the old database, in the shape of its backup file, the pictures as blobs */
export async function readOldWardrobe() {
  if (!(await findOldWardrobe())) return null;
  const db = await openExisting();
  if (!db) return null;
  try {
    const stores = OLD_STORES.filter((s) => db.objectStoreNames.contains(s));
    if (!stores.includes('items')) return null;
    const tx = db.transaction(stores, 'readonly');
    const all = async (s) => (stores.includes(s) ? await req(tx.objectStore(s).getAll()) : []);
    const items = await all('items');
    const outfits = await all('outfits');
    const days = await all('days');
    const images = (await all('images')).filter((im) => im && im.id && im.blob).map((im) => ({ id: im.id, blob: im.blob }));
    const meta = await all('meta');
    const prefs = ((meta || []).find((m) => m && m.key === 'prefs') || {}).value || {};
    return { app: 'wardrobe', format: 1, exported: null, items, outfits, days, images, prefs };
  } finally {
    db.close();
  }
}
