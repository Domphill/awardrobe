/* aWardrobe ui: which screen is open, from the address hash (#/garment/g_…), and how to move.
   The position inside the app's own history is kept in history.state, so the browser's Back
   button and the app's back arrow agree. */

export const SCREENS = ['closet', 'garment', 'edit', 'outfits', 'outfit', 'build', 'calendar', 'week', 'stats', 'more', 'welcome'];

export function parseRoute(hash) {
  const m = /^#\/([a-z]+)(?:\/([^/?#]*))?/.exec(hash || '');
  if (!m || !SCREENS.includes(m[1])) return { name: 'closet', arg: null };
  let arg = null;
  if (m[2]) {
    try {
      arg = decodeURIComponent(m[2]);
    } catch (e) {
      arg = m[2];
    }
  }
  return { name: m[1], arg };
}

export function buildHash(name, arg) {
  return '#/' + name + (arg ? '/' + encodeURIComponent(arg) : '');
}

const depthOf = (st) => (st && typeof st.depth === 'number' ? st.depth : null);

export function createRouter(onChange) {
  const router = {
    current: parseRoute(location.hash),
    depth: 0,
    pending: null,
    onHashChange() {
      const known = depthOf(history.state);
      if (known !== null) router.depth = known;
      else {
        router.depth = router.pending !== null ? router.pending : router.depth + 1;
        history.replaceState({ depth: router.depth }, '', location.href);
      }
      router.pending = null;
      router.current = parseRoute(location.hash);
      onChange(router.current, { nav: true });
    },
    start() {
      const d = depthOf(history.state);
      router.depth = d === null ? 0 : d;
      if (d === null) history.replaceState({ depth: 0 }, '', location.href);
      window.addEventListener('hashchange', router.onHashChange);
      router.current = parseRoute(location.hash);
      onChange(router.current, { nav: true });
    },
    stop() {
      window.removeEventListener('hashchange', router.onHashChange);
    },
    go(name, arg, opts) {
      const hash = buildHash(name, arg);
      if (opts && opts.replace) {
        history.replaceState({ depth: router.depth }, '', location.pathname + location.search + hash);
        router.current = parseRoute(hash);
        onChange(router.current, { nav: true });
        return;
      }
      if (location.hash === hash) {
        onChange(router.current, { nav: true });
        return;
      }
      router.pending = router.depth + 1;
      location.hash = hash;
    },
    back(fallback) {
      if (router.depth > 0) history.back();
      else router.go(fallback || 'closet', null, { replace: true });
    },
    refresh() {
      onChange(router.current, { nav: false });
    }
  };
  return router;
}
