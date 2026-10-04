/* aWardrobe app: settings. Stored as one meta record; defaults fill anything not set. */

export const DEFAULT_PREFS = { theme: 'system', currency: '£', tempUnit: 'C', place: null, onboarded: false, autoCutout: true };

export function createPrefs(records) {
  const listeners = new Set();
  let chain = Promise.resolve();
  const api = {
    get: () => Object.assign({}, DEFAULT_PREFS, records.meta('prefs', {})),
    /* Changes are written one after another, so two quick taps cannot lose each other, and the
       stored settings are re-read first, so a change made in another tab is not overwritten. */
    set(patch) {
      const run = chain.then(async () => {
        await records.reloadMeta();
        const next = Object.assign({}, records.meta('prefs', {}), patch);
        await records.setMeta('prefs', next);
        const now = api.get();
        for (const fn of listeners) fn(now);
        return now;
      });
      chain = run.catch(() => {});
      return run;
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
  return api;
}
