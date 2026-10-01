/* aWardrobe app: settings. Stored as one meta record; defaults fill anything not set. */

export const DEFAULT_PREFS = { theme: 'system', currency: '£', tempUnit: 'C', place: null, onboarded: false };

export function createPrefs(records) {
  const listeners = new Set();
  const api = {
    get: () => Object.assign({}, DEFAULT_PREFS, records.meta('prefs', {})),
    async set(patch) {
      const next = Object.assign({}, records.meta('prefs', {}), patch);
      await records.setMeta('prefs', next);
      const now = api.get();
      for (const fn of listeners) fn(now);
      return now;
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
  return api;
}
